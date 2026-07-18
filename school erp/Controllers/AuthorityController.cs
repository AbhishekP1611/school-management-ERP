using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AuthorityController : ControllerBase
{
    private readonly AppDbContext _db;
    public AuthorityController(AppDbContext db) => _db = db;

    // The permission-controlled modules (kept in sync with the sidebar + controllers).
    private static readonly string[] MODULE_NAMES =
        { "Dashboard", "Students", "Teachers", "Classes", "Academics", "Fees", "Library",
          "Attendance", "Transport", "Events", "Notices", "Users", "Monitor", "Units", "Calendar", "Gate", "Finance", "Promotion", "StudentLookup", "Inventory" };

    private async Task EnsureModulesSeeded()
    {
        var existing = await _db.Modules.Select(m => m.ModuleName).ToListAsync();
        var missing = MODULE_NAMES.Where(n => !existing.Contains(n)).ToList();
        if (missing.Count > 0)
        {
            int order = (await _db.Modules.MaxAsync(m => (int?)m.SortOrder) ?? 0) + 10;
            _db.Modules.AddRange(missing.Select(n => new ModuleMaster { ModuleName = n, DisplayName = n, SortOrder = order += 10 }));
            await _db.SaveChangesAsync();
        }
    }

    // GET api/authority/modules  — full module list (ordered), for the permission grid
    // and the Modules-management window. Master data: no unit/year scoping.
    [HttpGet("modules")]
    public async Task<IActionResult> GetModules()
    {
        await EnsureModulesSeeded();
        var list = await _db.Modules
            .OrderBy(m => m.SortOrder).ThenBy(m => m.ModuleId)
            .Select(m => new ModuleDto
            {
                ModuleId    = m.ModuleId,
                ModuleName  = m.ModuleName,
                DisplayName = m.DisplayName,
                Route       = m.Route,
                Icon        = m.Icon,
                SortOrder   = m.SortOrder,
                IsActive    = m.IsActive
            })
            .ToListAsync();
        return Ok(list);
    }

    // GET api/authority/nav — active modules (ordered) that the current user can VIEW.
    // Drives the sidebar and the default-landing route. Purely permission-based.
    [HttpGet("nav")]
    public async Task<IActionResult> GetNav()
    {
        await EnsureModulesSeeded();
        var userIdStr = User.FindFirstValue("userId");
        int.TryParse(userIdStr, out int userId);

        var modules = await _db.Modules
            .Where(m => m.IsActive && m.Route != null)
            .OrderBy(m => m.SortOrder).ThenBy(m => m.ModuleId)
            .ToListAsync();
        var viewable = await _db.Authorities
            .Where(a => a.UserId == userId && a.CanView)
            .Select(a => a.ModuleId)
            .ToListAsync();

        var nav = modules
            .Where(m => viewable.Contains(m.ModuleId))
            .Select(m => new ModuleDto
            {
                ModuleId    = m.ModuleId,
                ModuleName  = m.ModuleName,
                DisplayName = m.DisplayName ?? m.ModuleName,
                Route       = m.Route,
                Icon        = m.Icon,
                SortOrder   = m.SortOrder,
                IsActive    = m.IsActive
            }).ToList();
        return Ok(nav);
    }

    // POST api/authority/modules — create a module (needs Users:edit).
    [HttpPost("modules")]
    [RequirePermission("Users", PermAction.Edit)]
    public async Task<IActionResult> CreateModule([FromBody] SaveModuleDto dto)
    {
        var name = (dto.ModuleName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Module name (RBAC key) is required." });
        if (await _db.Modules.AnyAsync(m => m.ModuleName == name))
            return BadRequest(new { message = "A module with that name already exists." });

        int nextOrder = (await _db.Modules.MaxAsync(m => (int?)m.SortOrder) ?? 0) + 10;
        var module = new ModuleMaster
        {
            ModuleName  = name,
            DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? name : dto.DisplayName!.Trim(),
            Route       = string.IsNullOrWhiteSpace(dto.Route) ? null : dto.Route!.Trim(),
            Icon        = string.IsNullOrWhiteSpace(dto.Icon) ? null : dto.Icon!.Trim(),
            SortOrder   = nextOrder,
            IsActive    = dto.IsActive
        };
        _db.Modules.Add(module);
        await _db.SaveChangesAsync();
        return Ok(new { module.ModuleId });
    }

    // PUT api/authority/modules/5 — edit a module (needs Users:edit).
    [HttpPut("modules/{id}")]
    [RequirePermission("Users", PermAction.Edit)]
    public async Task<IActionResult> UpdateModule(int id, [FromBody] SaveModuleDto dto)
    {
        var module = await _db.Modules.FindAsync(id);
        if (module == null) return NotFound();

        var name = (dto.ModuleName ?? "").Trim();
        if (string.IsNullOrWhiteSpace(name))
            return BadRequest(new { message = "Module name (RBAC key) is required." });
        if (await _db.Modules.AnyAsync(m => m.ModuleName == name && m.ModuleId != id))
            return BadRequest(new { message = "A module with that name already exists." });

        module.ModuleName  = name;
        module.DisplayName = string.IsNullOrWhiteSpace(dto.DisplayName) ? name : dto.DisplayName!.Trim();
        module.Route       = string.IsNullOrWhiteSpace(dto.Route) ? null : dto.Route!.Trim();
        module.Icon        = string.IsNullOrWhiteSpace(dto.Icon) ? null : dto.Icon!.Trim();
        module.IsActive    = dto.IsActive;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // POST api/authority/modules/reorder — save new top-to-bottom order (needs Users:edit).
    [HttpPost("modules/reorder")]
    [RequirePermission("Users", PermAction.Edit)]
    public async Task<IActionResult> ReorderModules([FromBody] ReorderModulesDto dto)
    {
        var modules = await _db.Modules.ToListAsync();
        int order = 10;
        foreach (var id in dto.OrderedIds)
        {
            var m = modules.FirstOrDefault(x => x.ModuleId == id);
            if (m != null) { m.SortOrder = order; order += 10; }
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = "Order saved." });
    }

    // DELETE api/authority/modules/5 — remove a module + its authority rows (needs Users:edit).
    [HttpDelete("modules/{id}")]
    [RequirePermission("Users", PermAction.Delete)]
    public async Task<IActionResult> DeleteModule(int id)
    {
        var module = await _db.Modules.FindAsync(id);
        if (module == null) return NotFound();
        var auths = await _db.Authorities.Where(a => a.ModuleId == id).ToListAsync();
        _db.Authorities.RemoveRange(auths);
        _db.Modules.Remove(module);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET api/authority/my-permissions — the logged-in user's permission map.
    // Pure ID-based: read the Authority table for this user. No role hardcoding.
    [HttpGet("my-permissions")]
    public async Task<IActionResult> MyPermissions()
    {
        await EnsureModulesSeeded();
        var userIdStr = User.FindFirstValue("userId");
        int.TryParse(userIdStr, out int userId);

        var modules = await _db.Modules.OrderBy(m => m.ModuleId).ToListAsync();
        var auths = await _db.Authorities.Where(a => a.UserId == userId).ToListAsync();

        var result = modules.ToDictionary(
            m => m.ModuleName,
            m =>
            {
                var a = auths.FirstOrDefault(x => x.ModuleId == m.ModuleId);
                // Pure RBAC: access is ONLY what the Authority table grants — no module
                // (not even Dashboard) is visible by default. No access row = no access.
                return new
                {
                    canView   = a?.CanView   ?? false,
                    canCreate = a?.CanCreate ?? false,
                    canEdit   = a?.CanEdit   ?? false,
                    canDelete = a?.CanDelete ?? false
                };
            });
        return Ok(result);
    }

    // GET api/authority/user/5 — grid for a specific user (needs Users:view).
    [HttpGet("user/{userId}")]
    [RequirePermission("Users", PermAction.View)]
    public async Task<IActionResult> GetForUser(int userId)
    {
        await EnsureModulesSeeded();
        var modules = await _db.Modules.OrderBy(m => m.ModuleId).ToListAsync();
        var auths = await _db.Authorities.Where(a => a.UserId == userId).ToListAsync();

        var rows = modules.Select(m =>
        {
            var a = auths.FirstOrDefault(x => x.ModuleId == m.ModuleId);
            return new AuthorityRowDto
            {
                ModuleId   = m.ModuleId,
                ModuleName = m.ModuleName,
                CanView    = a?.CanView   ?? false,
                CanCreate  = a?.CanCreate ?? false,
                CanEdit    = a?.CanEdit   ?? false,
                CanDelete  = a?.CanDelete ?? false
            };
        }).ToList();
        return Ok(rows);
    }

    // POST api/authority/save — bulk upsert a user's permission grid (needs Users:edit).
    [HttpPost("save")]
    [RequirePermission("Users", PermAction.Edit)]
    public async Task<IActionResult> Save([FromBody] SaveAuthorityDto dto)
    {
        // Guard: you can only set permissions for a user whose unit is in your
        // active scope — no granting rights to users in units you can't access
        // (and no editing users outside your reach). Prevents privilege escalation.
        var target = await _db.Users.FindAsync(dto.UserId);
        if (target == null) return NotFound(new { message = "User not found." });
        if (!User.InScope(HttpContext, target.UnitId)) return Forbid();

        var existing = await _db.Authorities.Where(a => a.UserId == dto.UserId).ToListAsync();

        foreach (var row in dto.Permissions)
        {
            var a = existing.FirstOrDefault(x => x.ModuleId == row.ModuleId);
            if (a == null)
            {
                _db.Authorities.Add(new Authority
                {
                    UserId    = dto.UserId,
                    ModuleId  = row.ModuleId,
                    CanView   = row.CanView,
                    CanCreate = row.CanCreate,
                    CanEdit   = row.CanEdit,
                    CanDelete = row.CanDelete
                });
            }
            else
            {
                a.CanView   = row.CanView;
                a.CanCreate = row.CanCreate;
                a.CanEdit   = row.CanEdit;
                a.CanDelete = row.CanDelete;
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = "Permissions saved." });
    }
}
