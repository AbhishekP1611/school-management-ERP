namespace school_erp.Models;

// One row per login. LogoutAt null = currently active session.
public class UserSession
{
    public int SessionId { get; set; }
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public DateTime LoginAt { get; set; } = DateTime.UtcNow;
    public DateTime? LogoutAt { get; set; }
    public string? LogoutReason { get; set; }   // "self" / "forced" / "blocked" / null
    public string? IpAddress { get; set; }
    public string? DeviceId { get; set; }        // browser/device fingerprint — same device = same session
    public DateTime LastSeenAt { get; set; } = DateTime.UtcNow;

    public User? User { get; set; }
}
