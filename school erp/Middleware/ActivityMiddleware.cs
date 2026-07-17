using System.Security.Claims;
using school_erp.Data;
using school_erp.Models;

namespace school_erp.Middleware;

// Logs every meaningful action, tracks "last seen", and enforces the block flag.
public class ActivityMiddleware
{
    private readonly RequestDelegate _next;
    public ActivityMiddleware(RequestDelegate next) => _next = next;

    // Map a URL path segment to a friendly module name.
    private static string ModuleFromPath(string path)
    {
        // /api/students/... → Students
        var parts = path.Split('/', StringSplitOptions.RemoveEmptyEntries);
        var seg = parts.Length >= 2 && parts[0].Equals("api", StringComparison.OrdinalIgnoreCase)
            ? parts[1] : (parts.Length > 0 ? parts[0] : "");
        return seg switch
        {
            "students"   => "Students",
            "teachers"   => "Teachers",
            "classes"    => "Classes",
            "subjects" or "exams" or "results" => "Academics",
            "library"    => "Library",
            "attendance" => "Attendance",
            "buses"      => "Transport",
            "events"     => "Events",
            "fees"       => "Fees",
            "users" or "authority" => "Users",
            "auth"       => "Auth",
            _            => seg.Length > 0 ? char.ToUpper(seg[0]) + seg[1..] : "System"
        };
    }

    private static string ActionFromMethod(string method) => method switch
    {
        "POST"   => "Create",
        "PUT"    => "Update",
        "DELETE" => "Delete",
        _        => "View"
    };

    public async Task Invoke(HttpContext ctx, AppDbContext db)
    {
        var userIdClaim = ctx.User.FindFirst("userId")?.Value;
        int.TryParse(userIdClaim, out int userId);

        // ── Enforce block flag (authenticated users only) ──
        if (userId > 0)
        {
            var user = await db.Users.FindAsync(userId);
            if (user != null && (user.IsBlocked || !user.IsActive))
            {
                ctx.Response.StatusCode = StatusCodes.Status403Forbidden;
                ctx.Response.ContentType = "application/json";
                await ctx.Response.WriteAsJsonAsync(new { message = "Your account has been blocked. Contact the administrator.", blocked = true });
                return;
            }

            // ── Update "last seen" on the active session (throttled) ──
            var session = db.UserSessions
                .Where(s => s.UserId == userId && s.LogoutAt == null)
                .OrderByDescending(s => s.SessionId)
                .FirstOrDefault();
            if (session != null && (DateTime.UtcNow - session.LastSeenAt).TotalSeconds > 20)
            {
                session.LastSeenAt = DateTime.UtcNow;
                await db.SaveChangesAsync();
            }
        }

        await _next(ctx);

        // ── Log successful mutations (after the request ran) ──
        var method = ctx.Request.Method;
        var path = ctx.Request.Path.Value ?? "";
        bool isMutation = method is "POST" or "PUT" or "DELETE";
        bool ok = ctx.Response.StatusCode is >= 200 and < 300;
        bool isAuthPath = path.Contains("/auth/", StringComparison.OrdinalIgnoreCase);

        if (userId > 0 && isMutation && ok && !isAuthPath)
        {
            db.ActivityLogs.Add(new ActivityLog
            {
                UserId   = userId,
                Username = ctx.User.FindFirst(ClaimTypes.Name)?.Value ?? "",
                Role     = ctx.User.FindFirst(ClaimTypes.Role)?.Value ?? "",
                Module   = ModuleFromPath(path),
                Action   = ActionFromMethod(method),
                Detail   = $"{method} {path}"
            });
            await db.SaveChangesAsync();
        }
    }
}
