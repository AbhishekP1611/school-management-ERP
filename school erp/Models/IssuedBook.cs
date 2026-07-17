namespace school_erp.Models;

// A book issued to a student. Active issue = ReturnDate is null.
public class IssuedBook
{
    public int IssueId { get; set; }
    public int BookId { get; set; }
    public int StudentId { get; set; }
    public DateOnly IssueDate { get; set; }
    public DateOnly DueDate { get; set; }
    public DateOnly? ReturnDate { get; set; }

    // Navigation
    public Book? Book { get; set; }
    public Student? Student { get; set; }
}
