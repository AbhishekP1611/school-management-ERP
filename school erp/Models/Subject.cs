namespace school_erp.Models;

// A subject belongs to a specific class (class-scoped).
public class Subject
{
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Class? Class { get; set; }
    public ICollection<ExamSubject> ExamSubjects { get; set; } = new List<ExamSubject>();
}
