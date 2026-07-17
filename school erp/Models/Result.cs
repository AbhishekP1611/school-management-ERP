namespace school_erp.Models;

// A single mark record = (exam-subject × student).
public class Result
{
    public int ResultId { get; set; }
    public int ExamSubjectId { get; set; }
    public int StudentId { get; set; }
    public decimal? MarksObtained { get; set; }
    public bool IsAbsent { get; set; } = false;

    // Navigation
    public ExamSubject? ExamSubject { get; set; }
    public Student? Student { get; set; }
}
