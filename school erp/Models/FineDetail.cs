namespace school_erp.Models;

// A fine raised on late book return.
public class FineDetail
{
    public int FineId { get; set; }
    public int IssueId { get; set; }
    public int StudentId { get; set; }
    public int BookId { get; set; }
    public decimal FineAmount { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public IssuedBook? IssuedBook { get; set; }
    public Student? Student { get; set; }
    public Book? Book { get; set; }
}
