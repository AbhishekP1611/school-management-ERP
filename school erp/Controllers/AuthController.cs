using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly JwtHelper   _jwt;
    private readonly EmailHelper _email;

    public AuthController(AppDbContext db, JwtHelper jwt, EmailHelper email)
    {
        _db  = db;
        _jwt = jwt;
        _email = email;
    }

    // GET api/auth/units — public list of active units for the login screen dropdown.
    [HttpGet("units")]
    public async Task<IActionResult> LoginUnits()
    {
        var list = await _db.Units
            .Where(u => u.IsActive)
            .OrderBy(u => u.UnitName)
            .Select(u => new { u.UnitId, u.UnitName })
            .ToListAsync();
        return Ok(list);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Username == req.Username);

        if (user == null || !BCrypt.Net.BCrypt.Verify(req.Password, user.PasswordHash))
            return Unauthorized(new { message = "Invalid username or password." });

        // Block == deactivated. An inactive account can't log in until an admin
        // re-activates it in Users & Access.
        if (!user.IsActive || user.IsBlocked)
            return Unauthorized(new { message = "Your account is blocked. Contact the administrator to re-activate it." });

        // Every unit this user may access (multi-unit). Falls back to the home
        // unit for older accounts that have no UserUnits rows yet.
        var allowedUnits = await _db.UserUnits
            .Where(x => x.UserId == user.UserId)
            .Select(x => x.UnitId)
            .ToListAsync();
        if (allowedUnits.Count == 0 && user.UnitId.HasValue)
            allowedUnits.Add(user.UnitId.Value);

        // Unit gate: if a unit was selected on the login screen, it must be one
        // of the user's allowed units.
        if (req.UnitId.HasValue && !allowedUnits.Contains(req.UnitId.Value))
            return Unauthorized(new { message = "This user does not have access to the selected unit." });

        // ── Single-session gate ──────────────────────────────────────
        // A user may be logged in on only ONE device at a time. If there's a still-alive
        // session (heartbeat within 60s) from a DIFFERENT device, block this login.
        // Same device → allowed (multi-tab). Stale sessions (>60s no heartbeat) are dead → allowed.
        var loginAt = DateTime.UtcNow;
        var deviceId = req.DeviceId;
        var aliveCutoff = loginAt.AddSeconds(-60);
        var activeOther = await _db.UserSessions
            .Where(s => s.UserId == user.UserId && s.LogoutAt == null
                     && s.LastSeenAt >= aliveCutoff
                     && (deviceId == null || s.DeviceId != deviceId))
            .OrderByDescending(s => s.SessionId)
            .FirstOrDefaultAsync();
        if (activeOther != null)
        {
            return Conflict(new { message = "This account is already logged in on another device. Log out there first, or wait a minute and try again." });
        }

        // Same-device sessions: close old ones so we keep one clean session per device.
        if (deviceId != null)
        {
            var sameDevice = await _db.UserSessions
                .Where(s => s.UserId == user.UserId && s.LogoutAt == null && s.DeviceId == deviceId)
                .ToListAsync();
            foreach (var s in sameDevice) { s.LogoutAt = loginAt; s.LogoutReason = "re-login"; }
        }

        // ── Open a session + log the login ──
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        _db.UserSessions.Add(new Models.UserSession
        {
            UserId = user.UserId, Username = user.Username, Role = user.Role,
            LoginAt = loginAt, LastSeenAt = loginAt, IpAddress = ip, DeviceId = deviceId
        });
        _db.ActivityLogs.Add(new Models.ActivityLog
        {
            UserId = user.UserId, Username = user.Username, Role = user.Role,
            Module = "Auth", Action = "Login", Detail = $"Logged in from {ip}"
        });
        await _db.SaveChangesAsync();

        // The unit this user belongs to (for the email + display).
        var unitName = await _db.Units.Where(u => u.UnitId == user.UnitId)
            .Select(u => u.UnitName).FirstOrDefaultAsync() ?? "your school";

        // ── Login-alert email (best-effort; never blocks login) ──
        // Only if this user has email notifications enabled.
        if (user.EmailNotifications && !string.IsNullOrWhiteSpace(user.Email))
            await SendLoginEmail(user.Email!, user.Username, unitName, loginAt, ip);

        // Which unit is "active" for this session: the one chosen on the login
        // screen if given (and allowed), else the home unit, else the first allowed.
        int? activeUnit = (req.UnitId.HasValue && allowedUnits.Contains(req.UnitId.Value))
            ? req.UnitId
            : (user.UnitId.HasValue && allowedUnits.Contains(user.UnitId.Value) ? user.UnitId
               : (allowedUnits.Count > 0 ? allowedUnits[0] : (int?)null));

        // Brief list of the user's units for the header switcher.
        var unitBriefs = await _db.Units
            .Where(u => allowedUnits.Contains(u.UnitId))
            .OrderBy(u => u.UnitName)
            .Select(u => new UnitBrief(u.UnitId, u.UnitName))
            .ToListAsync();

        // Absolute session cap = login time + 8h. Refresh can renew the token but
        // never past this, so everyone is logged out 8 hours after login.
        var absoluteExpiry = loginAt.AddHours(8);
        var token = _jwt.GenerateToken(user, absoluteExpiry, allowedUnits);
        return Ok(new LoginResponse(token, user.Username, user.Role, user.UserId, user.Email, activeUnit, unitBriefs));
    }

    // Sends a "you just logged in" alert email. Swallows all errors.
    private async Task SendLoginEmail(string toEmail, string username, string unitName, DateTime loginAtUtc, string? ip)
    {
        try
        {
            var when = loginAtUtc.ToString("dd MMM yyyy, HH:mm 'UTC'");
            var html = $@"
                <div style='font-family:Segoe UI,Arial,sans-serif;max-width:560px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden'>
                  <div style='background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:20px 26px'>
                    <div style='font-size:20px;font-weight:800'>{System.Net.WebUtility.HtmlEncode(unitName)}</div>
                    <div style='font-size:12px;opacity:.85'>Sign-in notification</div>
                  </div>
                  <div style='padding:24px 26px'>
                    <h2 style='margin:0 0 6px;color:#1e293b'>✅ You're logged in</h2>
                    <p style='color:#334155;font-size:15px;line-height:1.7'>
                      Hi <b>{System.Net.WebUtility.HtmlEncode(username)}</b>, you just signed in to
                      <b>{System.Net.WebUtility.HtmlEncode(unitName)}</b>.
                    </p>
                    <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:13px;color:#475569'>
                      <div><b>Unit:</b> {System.Net.WebUtility.HtmlEncode(unitName)}</div>
                      <div><b>Time:</b> {when}</div>
                      {(string.IsNullOrWhiteSpace(ip) ? "" : $"<div><b>IP:</b> {System.Net.WebUtility.HtmlEncode(ip)}</div>")}
                    </div>
                    <p style='color:#94a3b8;font-size:12px;margin-top:16px'>
                      Wasn't you? Change your password and contact your administrator immediately.
                      Your session will automatically end 8 hours after login.
                    </p>
                  </div>
                </div>";
            await _email.SendAsync(toEmail, $"You logged in to {unitName}", html);
        }
        catch { /* email must never block or fail login */ }
    }

    // POST api/auth/logout — closes the current active session.
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout()
    {
        var userIdStr = User.FindFirst("userId")?.Value;
        if (!int.TryParse(userIdStr, out int userId)) return Ok();

        var session = await _db.UserSessions
            .Where(s => s.UserId == userId && s.LogoutAt == null)
            .OrderByDescending(s => s.SessionId)
            .FirstOrDefaultAsync();
        if (session != null)
        {
            session.LogoutAt = DateTime.UtcNow;
            session.LogoutReason = "self";
        }
        _db.ActivityLogs.Add(new Models.ActivityLog
        {
            UserId = userId, Username = User.FindFirst(System.Security.Claims.ClaimTypes.Name)?.Value ?? "",
            Role = User.FindFirst(System.Security.Claims.ClaimTypes.Role)?.Value ?? "",
            Module = "Auth", Action = "Logout", Detail = "Logged out"
        });
        await _db.SaveChangesAsync();
        return Ok();
    }

    // POST api/auth/refresh  — issues a fresh token for a still-valid session.
    // The client calls this before the current token expires (silent renewal).
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh()
    {
        var userIdStr = User.FindFirst("userId")?.Value;
        if (!int.TryParse(userIdStr, out int userId)) return Unauthorized();

        var user = await _db.Users.FirstOrDefaultAsync(u => u.UserId == userId && u.IsActive);
        if (user == null) return Unauthorized();

        // Enforce the absolute 8-hour-from-login cap carried in the current token.
        // If it's already past, refuse to renew → client logs out.
        var absExpStr = User.FindFirst("absExp")?.Value;
        DateTime absoluteExpiry;
        if (long.TryParse(absExpStr, out var absUnix))
        {
            absoluteExpiry = DateTimeOffset.FromUnixTimeSeconds(absUnix).UtcDateTime;
            if (absoluteExpiry <= DateTime.UtcNow)
                return Unauthorized(new { message = "Session expired (8-hour limit reached)." });
        }
        else
        {
            // Older token without the cap — cap from now as a fallback.
            absoluteExpiry = DateTime.UtcNow.AddHours(8);
        }

        // Reload the user's allowed units so unit-access changes take effect on refresh.
        var allowedUnits = await _db.UserUnits
            .Where(x => x.UserId == user.UserId)
            .Select(x => x.UnitId)
            .ToListAsync();
        if (allowedUnits.Count == 0 && user.UnitId.HasValue)
            allowedUnits.Add(user.UnitId.Value);

        var token = _jwt.GenerateToken(user, absoluteExpiry, allowedUnits);
        return Ok(new LoginResponse(token, user.Username, user.Role, user.UserId, user.Email));
    }

    // POST api/auth/change-password  — logged-in user changes their own password.
    [Microsoft.AspNetCore.Authorization.Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest req)
    {
        if (string.IsNullOrWhiteSpace(req.NewPassword) || req.NewPassword.Length < 6)
            return BadRequest(new { message = "New password must be at least 6 characters." });

        var userIdStr = User.FindFirst("userId")?.Value;
        if (!int.TryParse(userIdStr, out int userId))
            return Unauthorized();

        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        if (!BCrypt.Net.BCrypt.Verify(req.CurrentPassword, user.PasswordHash))
            return BadRequest(new { message = "Current password is incorrect." });

        user.PasswordHash = BCrypt.Net.BCrypt.HashPassword(req.NewPassword);
        await _db.SaveChangesAsync();
        return Ok(new { message = "Password changed successfully." });
    }
}
