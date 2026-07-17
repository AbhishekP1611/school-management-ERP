namespace school_erp.Models;

public class Teacher
{
    public int TeacherId { get; set; }
    public int? UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Designation { get; set; }
    public string? Specialization { get; set; }
    public decimal Salary { get; set; }
    public DateOnly? DateOfJoining { get; set; }
    public string? Address { get; set; }
    public string? Gender { get; set; }
    public bool IsActive { get; set; } = true;
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ── Extended profile fields ──
    public string? PhotoUrl        { get; set; }   // base64 data-url like students
    public string? Qualification   { get; set; }   // e.g. M.Sc, B.Ed
    public DateOnly? DateOfBirth    { get; set; }
    public int?    ExperienceYears { get; set; }
    public string? BloodGroup      { get; set; }
    public string? MaritalStatus   { get; set; }
    public string? Religion        { get; set; }
    public string? Category        { get; set; }   // General / OBC / SC-ST
    public string? EmergencyContact { get; set; }
    public string? AadharNo        { get; set; }

    // Navigation
    public User? User { get; set; }
    public ICollection<Class> Classes { get; set; } = new List<Class>();

    public string FullName => $"{FirstName} {LastName}";
}
