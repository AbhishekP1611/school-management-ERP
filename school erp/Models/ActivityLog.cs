namespace school_erp.Models;

// One row per meaningful action (create/edit/delete/login/logout).
public class ActivityLog
{
    public int LogId { get; set; }
    public int? UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string Module { get; set; } = string.Empty;   // Students, Fees, ...
    public string Action { get; set; } = string.Empty;   // Create / Update / Delete / Login / Logout
    public string? Detail { get; set; }                  // free-text, e.g. "POST /api/students"
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
