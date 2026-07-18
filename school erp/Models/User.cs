namespace school_erp.Models;

public class User
{
    public int UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string Role { get; set; } = "Student";
    public string? Email { get; set; }
    public bool IsActive { get; set; } = true;
    public bool IsBlocked { get; set; } = false;   // admin can block login access
    public bool EmailNotifications { get; set; } = true;  // send this user emails? (login alerts, notices)
    public int? UnitId { get; set; }               // which unit this user belongs to
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Teacher? Teacher { get; set; }
    public Student? Student { get; set; }
    // Every unit this user may access (multi-unit). Home unit (UnitId) is included.
    public ICollection<UserUnit> UserUnits { get; set; } = new List<UserUnit>();
}
