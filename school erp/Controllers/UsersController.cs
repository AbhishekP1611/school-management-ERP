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
public class UsersController : ControllerBase
{
    private readonly AppDbContext _db;
    public UsersController(AppDbContext db) => _db = db;

    // GET api/users?includeInactive=true  — active users by default; pass the flag to
    // also see soft-deleted (inactive) users so they can be re-activated.
    [HttpGet]
    [RequirePermission("Users", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        var q = _db.Users.AsQueryable();
        if (!includeInactive) q = q.Where(u => u.IsActive);
        // Unit admin sees only their allowed units' users.
        var units = User.ScopeUnitIds(HttpContext);
        q = q.Where(u => u.UnitId != null && units.Contains(u.UnitId.Value));

        var list = await q
            .OrderBy(u => u.Username)
            .Select(u => new UserDto
            {
                UserId   = u.UserId,
                Username = u.Username,
                Role     = u.Role,
                Email    = u.Email,
                IsActive = u.IsActive,
                EmailNotifications = u.EmailNotifications,
                UnitId   = u.UnitId,
                UnitName = _db.Units.Where(un => un.UnitId == u.UnitId).Select(un => un.UnitName).FirstOrDefault(),
                // every unit this user may access (falls back to home unit if none set)
                UnitIds  = u.UserUnits.Select(x => x.UnitId).ToList()
            }).ToListAsync();
        // Backfill: a user with no explicit UserUnits rows is treated as having just their home unit.
        foreach (var d in list)
            if (d.UnitIds.Count == 0 && d.UnitId.HasValue) d.UnitIds.Add(d.UnitId.Value);
        return Ok(list);
    }

    [HttpPost]
    [RequirePermission("Users", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateUserDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Username))
            return BadRequest(new { message = "Username is required." });
        if (string.IsNullOrWhiteSpace(dto.Password))
            return BadRequest(new { message = "Password is required." });
        if (await _db.Users.AnyAsync(u => u.Username == dto.Username))
            return BadRequest(new { message = "Username already exists." });

        // Which units may this user access? Home unit = the chosen home (or first picked,
        // or the creator's own unit as a last resort).
        var allowed = NormalizeUnits(dto.UnitIds, dto.UnitId);
        if (allowed.Count == 0)
            return BadRequest(new { message = "Select at least one unit for this user." });
        int? homeUnit = (dto.UnitId.HasValue && allowed.Contains(dto.UnitId.Value)) ? dto.UnitId : allowed[0];

        var user = new User
        {
            Username     = dto.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role         = dto.Role,
            Email        = dto.Email,
            IsActive     = dto.IsActive,
            EmailNotifications = dto.EmailNotifications,
            UnitId       = homeUnit
        };
        _db.Users.Add(user);
        await _db.SaveChangesAsync();

        // Save the access list.
        foreach (var uid in allowed)
            _db.UserUnits.Add(new UserUnit { UserId = user.UserId, UnitId = uid });
        await _db.SaveChangesAsync();

        return Ok(new { user.UserId });
    }

    [HttpPut("{id}")]
    [RequirePermission("Users", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateUserDto dto)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        if (user.Username != dto.Username &&
            await _db.Users.AnyAsync(u => u.Username == dto.Username && u.UserId != id))
            return BadRequest(new { message = "Username already exists." });

        user.Username = dto.Username;
        user.Role     = dto.Role;
        user.Email    = dto.Email;
        user.IsActive = dto.IsActive;
        user.EmailNotifications = dto.EmailNotifications;
        if (!string.IsNullOrWhiteSpace(dto.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        // Update the unit access list (only when the caller sent one).
        var allowed = NormalizeUnits(dto.UnitIds, dto.UnitId);
        if (allowed.Count > 0)
        {
            int? homeUnit = (dto.UnitId.HasValue && allowed.Contains(dto.UnitId.Value)) ? dto.UnitId : allowed[0];
            user.UnitId = homeUnit;

            // replace the whole access set
            var existing = _db.UserUnits.Where(x => x.UserId == id);
            _db.UserUnits.RemoveRange(existing);
            foreach (var uid in allowed)
                _db.UserUnits.Add(new UserUnit { UserId = id, UnitId = uid });
        }
        else if (dto.UnitId.HasValue)
        {
            user.UnitId = dto.UnitId;
        }

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // Build the distinct list of units a user may access. Ensures the home unit
    // (if given) is always in the set. Ignores non-positive ids.
    private static List<int> NormalizeUnits(List<int>? unitIds, int? homeUnit)
    {
        var set = new HashSet<int>();
        if (unitIds != null)
            foreach (var u in unitIds) if (u > 0) set.Add(u);
        if (homeUnit.HasValue && homeUnit.Value > 0) set.Add(homeUnit.Value);
        return set.ToList();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Users", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Lockout protection (pure-permission, not role-based): don't allow removing the
        // LAST active user who can manage the Users module — otherwise nobody could ever
        // add/edit users again.
        if (await IsLastUserManager(user))
            return BadRequest(new { message = "Cannot delete the last user who can manage Users — you'd lock everyone out." });

        // Block if this login is linked to an active student/teacher (would orphan them).
        if (await _db.Students.AnyAsync(s => s.UserId == id && s.IsActive))
            return BadRequest(new { message = "Cannot delete — this login is linked to an active student." });
        if (await _db.Teachers.AnyAsync(t => t.UserId == id && t.IsActive))
            return BadRequest(new { message = "Cannot delete — this login is linked to an active teacher." });

        // HARD delete — remove the user and their dependent rows (permissions, sessions).
        // (Inactive = temporarily disabled; Delete = gone for good.)
        var auths = _db.Authorities.Where(a => a.UserId == id);
        _db.Authorities.RemoveRange(auths);
        var sessions = _db.UserSessions.Where(s => s.UserId == id);
        _db.UserSessions.RemoveRange(sessions);
        _db.Users.Remove(user);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // True if `user` is currently the ONLY active user who can manage the Users module
    // (has Users edit/create permission). Removing them would lock everyone out.
    private async Task<bool> IsLastUserManager(User user)
    {
        // is THIS user a user-manager?
        bool isManager = await HasUsersManagePermission(user.UserId);
        if (!isManager) return false;   // not a manager → safe to delete

        // count OTHER active user-managers
        var others = await _db.Users.Where(u => u.IsActive && u.UserId != user.UserId).ToListAsync();
        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Users");
        int modId = mod?.ModuleId ?? -1;
        foreach (var o in others)
        {
            if (modId != -1 && await _db.Authorities.AnyAsync(a => a.UserId == o.UserId && a.ModuleId == modId && (a.CanEdit || a.CanCreate)))
                return false;
        }
        return true;   // this is the last one
    }

    private async Task<bool> HasUsersManagePermission(int userId)
    {
        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Users");
        if (mod == null) return false;
        return await _db.Authorities.AnyAsync(a => a.UserId == userId && a.ModuleId == mod.ModuleId && (a.CanEdit || a.CanCreate));
    }
}
