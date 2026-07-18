using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MonitoringController : ControllerBase
{
    private readonly AppDbContext _db;
    public MonitoringController(AppDbContext db) => _db = db;

    // A session is "active" if not logged out and seen in the last 2 minutes.
    private static readonly TimeSpan OnlineWindow = TimeSpan.FromMinutes(2);

    // GET api/monitoring/sessions-by-user?date=yyyy-MM-dd  — ONE row per user for the day,
    // with how many times they logged in and their online status. Click → detail endpoint.
    [HttpGet("sessions-by-user")]
    [RequirePermission("Monitor", PermAction.View)]
    public async Task<IActionResult> SessionsByUser([FromQuery] string? date)
    {
        var cutoff = DateTime.UtcNow - OnlineWindow;
        DateTime day = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date) && DateTime.TryParse(date, out var d)) day = d.Date;
        var next = day.AddDays(1);

        var sessions = await _db.UserSessions
            .Where(s => s.LoginAt >= day && s.LoginAt < next)
            .ToListAsync();

        var userIds = sessions.Select(s => s.UserId).Distinct().ToList();
        var blocked = await _db.Users.Where(u => userIds.Contains(u.UserId))
            .Select(u => new { u.UserId, u.IsBlocked, u.IsActive })
            .ToDictionaryAsync(u => u.UserId, u => u);

        var rows = sessions
            .GroupBy(s => new { s.UserId, s.Username })
            .Select(g =>
            {
                var online = g.Any(s => s.LogoutAt == null && s.LastSeenAt >= cutoff);
                var lastLogin = g.Max(s => s.LoginAt);
                var totalMins = g.Sum(s => (int)Math.Max(0, ((s.LogoutAt ?? DateTime.UtcNow) - s.LoginAt).TotalMinutes));
                blocked.TryGetValue(g.Key.UserId, out var u);
                return new
                {
                    g.Key.UserId,
                    g.Key.Username,
                    loginCount = g.Count(),
                    lastLoginAt = lastLogin.ToString("yyyy-MM-dd HH:mm:ss"),
                    totalMinutes = totalMins,
                    online,
                    isBlocked = u != null && u.IsBlocked,
                    isActive = u == null || u.IsActive,
                    status = online ? "Online" : "Offline"
                };
            })
            .OrderByDescending(x => x.online).ThenByDescending(x => x.lastLoginAt)
            .ToList();

        return Ok(new { date = day.ToString("yyyy-MM-dd"), users = rows });
    }

    // GET api/monitoring/user-sessions?userId=&date=  — a user's individual sessions on a day.
    [HttpGet("user-sessions")]
    [RequirePermission("Monitor", PermAction.View)]
    public async Task<IActionResult> UserSessions([FromQuery] int userId, [FromQuery] string? date)
    {
        var cutoff = DateTime.UtcNow - OnlineWindow;
        DateTime day = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date) && DateTime.TryParse(date, out var d)) day = d.Date;
        var next = day.AddDays(1);

        var list = await _db.UserSessions
            .Where(s => s.UserId == userId && s.LoginAt >= day && s.LoginAt < next)
            .OrderByDescending(s => s.SessionId)
            .Select(s => new
            {
                s.SessionId,
                loginAt = s.LoginAt.ToString("HH:mm:ss"),
                logoutAt = s.LogoutAt == null ? null : s.LogoutAt.Value.ToString("HH:mm:ss"),
                durationMinutes = (int)Math.Max(0, ((s.LogoutAt ?? DateTime.UtcNow) - s.LoginAt).TotalMinutes),
                status = s.LogoutAt != null ? "Logged out" : (s.LastSeenAt >= cutoff ? "Online" : "Idle"),
                logoutReason = s.LogoutReason,
                ip = s.IpAddress
            })
            .ToListAsync();
        return Ok(list);
    }

    // GET api/monitoring/sessions?activeOnly=true  (legacy — kept for compatibility)
    [HttpGet("sessions")]
    [RequirePermission("Monitor", PermAction.View)]
    public async Task<IActionResult> Sessions([FromQuery] bool activeOnly = false)
    {
        var cutoff = DateTime.UtcNow - OnlineWindow;

        var q = _db.UserSessions.AsQueryable();
        if (activeOnly) q = q.Where(s => s.LogoutAt == null);

        var sessions = await q
            .OrderByDescending(s => s.SessionId)
            .Take(500)
            .ToListAsync();

        // pull block flags in one shot
        var userIds = sessions.Select(s => s.UserId).Distinct().ToList();
        var blocked = await _db.Users
            .Where(u => userIds.Contains(u.UserId))
            .Select(u => new { u.UserId, u.IsBlocked })
            .ToDictionaryAsync(u => u.UserId, u => u.IsBlocked);

        var result = sessions.Select(s =>
        {
            bool online = s.LogoutAt == null && s.LastSeenAt >= cutoff;
            var end = s.LogoutAt ?? DateTime.UtcNow;
            var mins = (int)Math.Max(0, (end - s.LoginAt).TotalMinutes);
            return new
            {
                s.SessionId,
                s.UserId,
                s.Username,
                s.Role,
                loginAt   = s.LoginAt.ToString("yyyy-MM-dd HH:mm:ss"),
                logoutAt  = s.LogoutAt?.ToString("yyyy-MM-dd HH:mm:ss"),
                lastSeen  = s.LastSeenAt.ToString("yyyy-MM-dd HH:mm:ss"),
                durationMinutes = mins,
                status    = s.LogoutAt != null ? "Logged out" : (online ? "Online" : "Idle"),
                logoutReason = s.LogoutReason,
                ip        = s.IpAddress,
                isBlocked = blocked.TryGetValue(s.UserId, out var b) && b
            };
        }).ToList();

        return Ok(result);
    }

    // GET api/monitoring/activity?userId=&module=&take=200
    [HttpGet("activity")]
    [RequirePermission("Monitor", PermAction.View)]
    public async Task<IActionResult> Activity([FromQuery] int? userId, [FromQuery] string? module, [FromQuery] int take = 200)
    {
        var q = _db.ActivityLogs.AsQueryable();
        if (userId.HasValue) q = q.Where(a => a.UserId == userId);
        if (!string.IsNullOrWhiteSpace(module)) q = q.Where(a => a.Module == module);

        var logs = await q
            .OrderByDescending(a => a.LogId)
            .Take(Math.Clamp(take, 1, 1000))
            .Select(a => new
            {
                a.LogId, a.UserId, a.Username, a.Role, a.Module, a.Action, a.Detail,
                at = a.CreatedAt.ToString("yyyy-MM-dd HH:mm:ss")
            })
            .ToListAsync();

        return Ok(logs);
    }

    // POST api/monitoring/force-logout/5  — end a user's active sessions now.
    [HttpPost("force-logout/{userId}")]
    [RequirePermission("Monitor", PermAction.Edit)]
    public async Task<IActionResult> ForceLogout(int userId)
    {
        var sessions = await _db.UserSessions
            .Where(s => s.UserId == userId && s.LogoutAt == null)
            .ToListAsync();
        foreach (var s in sessions)
        {
            s.LogoutAt = DateTime.UtcNow;
            s.LogoutReason = "forced";
        }
        // Note: the block flag is what actually kicks them on their next request.
        await _db.SaveChangesAsync();
        return Ok(new { message = "User sessions ended.", count = sessions.Count });
    }

    // POST api/monitoring/block/5    — block = deactivate the account (IsActive=false).
    // The user can log in again once an admin re-activates them in Users & Access.
    [HttpPost("block/{userId}")]
    [RequirePermission("Monitor", PermAction.Edit)]
    public async Task<IActionResult> Block(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        // Lockout guard (pure-permission): don't block the last active user-manager.
        if (await IsLastUserManager(user))
            return BadRequest(new { message = "Cannot block the last user who can manage Users — you'd lock everyone out." });

        user.IsActive = false;      // block == inactive
        user.IsBlocked = true;      // kept in sync for existing UI/labels
        // also close active sessions so they're kicked immediately
        var sessions = await _db.UserSessions.Where(s => s.UserId == userId && s.LogoutAt == null).ToListAsync();
        foreach (var s in sessions) { s.LogoutAt = DateTime.UtcNow; s.LogoutReason = "blocked"; }
        await _db.SaveChangesAsync();
        return Ok(new { message = "User blocked (deactivated). Re-activate them in Users & Access to allow login." });
    }

    // POST api/monitoring/unblock/5  — re-activate the account.
    [HttpPost("unblock/{userId}")]
    [RequirePermission("Monitor", PermAction.Edit)]
    public async Task<IActionResult> Unblock(int userId)
    {
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();
        user.IsActive = true;
        user.IsBlocked = false;
        await _db.SaveChangesAsync();
        return Ok(new { message = "User re-activated." });
    }

    // True if this is the ONLY active user who can manage the Users module
    // (has Users edit/create). Removing/blocking them would lock everyone out.
    private async Task<bool> IsLastUserManager(User user)
    {
        bool isManager = await HasUsersManage(user.UserId);
        if (!isManager) return false;

        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Users");
        int modId = mod?.ModuleId ?? -1;
        var others = await _db.Users.Where(u => u.IsActive && u.UserId != user.UserId).ToListAsync();
        foreach (var o in others)
        {
            if (modId != -1 && await _db.Authorities.AnyAsync(a => a.UserId == o.UserId && a.ModuleId == modId && (a.CanEdit || a.CanCreate)))
                return false;
        }
        return true;
    }

    private async Task<bool> HasUsersManage(int userId)
    {
        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Users");
        if (mod == null) return false;
        return await _db.Authorities.AnyAsync(a => a.UserId == userId && a.ModuleId == mod.ModuleId && (a.CanEdit || a.CanCreate));
    }
}
