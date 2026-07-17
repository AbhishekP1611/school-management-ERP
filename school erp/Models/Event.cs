namespace school_erp.Models;

public class Event
{
    public int EventId { get; set; }
    public string EventTitle { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateOnly EventDate { get; set; }
    public DateOnly? EndDate { get; set; }
    public string? Venue { get; set; }
    public string? EventType { get; set; }
    public bool IsPublished { get; set; } = true;
    public int? CreatedBy { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public User? CreatedByUser { get; set; }
}
