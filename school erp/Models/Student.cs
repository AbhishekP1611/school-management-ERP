namespace school_erp.Models;

public class Student
{
    public int StudentId { get; set; }
    public int? UserId { get; set; }
    public string AdmissionNo { get; set; } = string.Empty;
    public string? RollNo { get; set; }
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public DateOnly? DateOfBirth { get; set; }
    public string? Gender { get; set; }
    public string? BloodGroup { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public int? ClassId { get; set; }
    public string? ParentName { get; set; }
    public string? ParentPhone { get; set; }
    public string? ParentEmail { get; set; }
    public DateOnly? AdmissionDate { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public bool IsActive { get; set; } = true;
    public string? PhotoUrl { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // ── Extended profile fields (brought over from the legacy module) ──
    public string? Religion { get; set; }
    public string? Category { get; set; }          // General / OBC / SC-ST
    public string? AadharNo { get; set; }
    public string? FatherName { get; set; }
    public string? MotherName { get; set; }
    public string? FatherOccupation { get; set; }
    public string? MotherOccupation { get; set; }
    public string? EmergencyContact { get; set; }
    // NOTE: a student's bus is NOT stored here — BusAssignment is the single source
    // of truth (student + bus + stop). Derive the bus via a BusAssignments join.

    // ── Year-end promotion tracking ──
    public string? PromotionStatus { get; set; }    // Promoted / Detained / Supplementary / Passed-Out / null
    public string? ExitReason { get; set; }         // Left / TC / null  (set with IsActive=false)

    // Navigation
    public User? User { get; set; }
    public Class? Class { get; set; }
    public ICollection<Fee> Fees { get; set; } = new List<Fee>();
    public ICollection<StudentHistory> History { get; set; } = new List<StudentHistory>();

    public string FullName => $"{FirstName} {LastName}";
}
