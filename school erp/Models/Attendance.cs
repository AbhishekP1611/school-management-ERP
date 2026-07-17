namespace school_erp.Models;

public class Attendance
{
    public int AttendanceId { get; set; }
    public int ReferenceId { get; set; }           // StudentId or TeacherId
    public string ReferenceType { get; set; } = "Student";  // "Student" | "Teacher"
    public DateOnly AttendanceDate { get; set; }
    public string Status { get; set; } = "Present"; // Present | Absent | Late | Leave
    public string? Remarks { get; set; }
    public int? MarkedBy { get; set; }
    public int? UnitId { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? MarkedByUser { get; set; }
}
