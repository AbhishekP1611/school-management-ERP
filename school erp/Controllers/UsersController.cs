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
        // Unit admin sees only their unit's users; SuperAdmin sees all.
        if (!User.IsSuperAdmin())
        {
            var myUnit = User.UnitId();
            q = q.Where(u => u.UnitId == myUnit);
        }

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
                UnitName = _db.Units.Where(un => un.UnitId == u.UnitId).Select(un => un.UnitName).FirstOrDefault()
            }).ToListAsync();
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

        // Non-SuperAdmin can't create a SuperAdmin, and new users are forced into the creator's unit.
        var role = dto.Role;
        if (!User.IsSuperAdmin() && role == "SuperAdmin") role = "Admin";
        int? unitId = User.IsSuperAdmin() ? dto.UnitId : User.UnitId();

        var user = new User
        {
            Username     = dto.Username,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password),
            Role         = role,
            Email        = dto.Email,
            IsActive     = dto.IsActive,
            EmailNotifications = dto.EmailNotifications,
            UnitId       = unitId
        };
        _db.Users.Add(user);
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
        user.Role     = (!User.IsSuperAdmin() && dto.Role == "SuperAdmin") ? user.Role : dto.Role;
        user.Email    = dto.Email;
        user.IsActive = dto.IsActive;
        user.EmailNotifications = dto.EmailNotifications;
        if (User.IsSuperAdmin() && dto.UnitId.HasValue) user.UnitId = dto.UnitId;   // only SA moves users between units
        if (!string.IsNullOrWhiteSpace(dto.Password))
            user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(dto.Password);

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Users", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var user = await _db.Users.FindAsync(id);
        if (user == null) return NotFound();

        // Lockout protection (pure-permission, not role-based): don't allow removing the
        // LAST active user who can manage the Users module — otherwise nobody could ever
        // add/edit users again. SuperAdmins count as user-managers.
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
    // (SuperAdmin, or has Users edit/create permission). Removing them would lock everyone out.
    private async Task<bool> IsLastUserManager(User user)
    {
        // is THIS user a user-manager?
        bool isManager = user.Role == "SuperAdmin" || await HasUsersManagePermission(user.UserId);
        if (!isManager) return false;   // not a manager → safe to delete

        // count OTHER active user-managers
        var others = await _db.Users.Where(u => u.IsActive && u.UserId != user.UserId).ToListAsync();
        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Users");
        int modId = mod?.ModuleId ?? -1;
        foreach (var o in others)
        {
            if (o.Role == "SuperAdmin") return false;   // another manager exists
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
