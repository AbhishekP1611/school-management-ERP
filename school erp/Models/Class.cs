namespace school_erp.Models;

public class Class
{
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string? Stream { get; set; }            // for Class 11 / 12
    public int? ClassTeacherId { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public string? RoomNumber { get; set; }
    public int? Capacity { get; set; }             // max strength (null = unlimited)
    public string? Shift { get; set; }             // Morning / Afternoon / Evening
    public bool IsDeleted { get; set; } = false;
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Teacher? ClassTeacher { get; set; }
    public ICollection<Student> Students { get; set; } = new List<Student>();
}
