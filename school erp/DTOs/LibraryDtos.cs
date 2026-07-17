namespace school_erp.DTOs;

public class BookDto
{
    public int     BookId      { get; set; }
    public string  BookName    { get; set; } = string.Empty;
    public string? Author      { get; set; }
    public decimal Price       { get; set; }
    public bool    IsAvailable { get; set; }
    public string? UsableUntil { get; set; }
}

public class CreateBookDto
{
    public string  BookName    { get; set; } = string.Empty;
    public string? Author      { get; set; }
    public decimal Price       { get; set; }
    public string? UsableUntil { get; set; }
}

public class IssuedBookDto
{
    public int     IssueId     { get; set; }
    public int     BookId      { get; set; }
    public string? BookName    { get; set; }
    public int     StudentId   { get; set; }
    public string? StudentName { get; set; }
    public string? AdmissionNo { get; set; }
    public string  IssueDate   { get; set; } = string.Empty;
    public string  DueDate     { get; set; } = string.Empty;
    public string? ReturnDate  { get; set; }
    public int     DaysOverdue { get; set; }
}

public class IssueBookDto
{
    public int     BookId    { get; set; }
    public int     StudentId { get; set; }
    public string? DueDate   { get; set; }   // optional; defaults to +7 days
}

public class CollectBookDto
{
    public int     IssueId    { get; set; }
    public decimal FineAmount { get; set; }
    public string? Remarks    { get; set; }
}

public class FineDto
{
    public int     FineId      { get; set; }
    public int     StudentId   { get; set; }
    public string? StudentName { get; set; }
    public string? BookName    { get; set; }
    public decimal FineAmount  { get; set; }
    public string? Remarks     { get; set; }
    public string? Date        { get; set; }
}
