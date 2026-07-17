namespace school_erp.Models;

// Join of an exam × subject, with per-subject date and marks config.
public class ExamSubject
{
    public int ExamSubjectId { get; set; }
    public int ExamId { get; set; }
    public int SubjectId { get; set; }
    public DateOnly? ExamDate { get; set; }
    public decimal MaxMarks { get; set; } = 100;
    public decimal PassingMarks { get; set; } = 35;

    // Navigation
    public Exam? Exam { get; set; }
    public Subject? Subject { get; set; }
    public ICollection<Result> Results { get; set; } = new List<Result>();
}
