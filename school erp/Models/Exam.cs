namespace school_erp.Models;

// An exam (e.g. "Unit Test 1", "Mid Term") for a class, with many subjects.
public class Exam
{
    public int ExamId { get; set; }
    public string ExamName { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? UnitId { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Class? Class { get; set; }
    public ICollection<ExamSubject> ExamSubjects { get; set; } = new List<ExamSubject>();
}
