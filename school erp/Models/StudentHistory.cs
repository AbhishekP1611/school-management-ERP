namespace school_erp.Models;

// Academic performance record of a student's previous classes/sessions.
public class StudentHistory
{
    public int HistoryId { get; set; }
    public int StudentId { get; set; }
    public string? ClassName { get; set; }     // e.g. "Class 5"
    public string? SessionYear { get; set; }   // e.g. "2023-2024"
    public decimal? TotalMarks { get; set; }
    public decimal? ObtainedMarks { get; set; }
    public decimal? Percentage { get; set; }
    public string? Result { get; set; }        // Pass / Fail
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Student? Student { get; set; }
}
