namespace school_erp.Models;

public class Book
{
    public int BookId { get; set; }
    public string BookName { get; set; } = string.Empty;
    public string? Author { get; set; }
    public decimal Price { get; set; }
    public bool IsAvailable { get; set; } = true;
    public bool IsDeleted { get; set; } = false;
    public DateOnly? UsableUntil { get; set; }   // condition-expiry cutoff
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<IssuedBook> IssuedBooks { get; set; } = new List<IssuedBook>();
}
