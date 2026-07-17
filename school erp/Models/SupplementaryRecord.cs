namespace school_erp.Models;

// A student who got a supplementary (compartment) in a subject. Kept as a permanent
// record; a teacher/user later marks Pass/Fail after the supplementary exam.
public class SupplementaryRecord
{
    public int SupplementaryId { get; set; }
    public int StudentId { get; set; }
    public int? SubjectId { get; set; }
    public string? SubjectName { get; set; }
    public string FromClass { get; set; } = string.Empty;   // class they were in
    public string AcademicYear { get; set; } = string.Empty; // year of the supplementary
    public decimal? MarksObtained { get; set; }              // original (failed) exam marks
    public decimal? SuppMarks { get; set; }                  // marks in the supplementary exam
    public decimal? PassingMarks { get; set; }
    public string Status { get; set; } = "Pending";          // Pending | Pass | Fail
    public string? Remarks { get; set; }
    public int? MarkedBy { get; set; }                        // userId who set Pass/Fail
    public DateTime? DecidedAt { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Student? Student { get; set; }
}
