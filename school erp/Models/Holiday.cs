namespace school_erp.Models;

// A calendar holiday / school-declared day off. Regular weekly-offs (Sundays)
// are computed on the fly; only real/extra holidays are stored here.
public class Holiday
{
    public int HolidayId { get; set; }
    public string Title { get; set; } = string.Empty;
    public DateOnly Date { get; set; }
    public DateOnly? EndDate { get; set; }              // for multi-day holidays (optional)
    public string? Description { get; set; }
    public string HolidayType { get; set; } = "Holiday"; // Holiday / Festival / Emergency / Event
    public bool IsEmergency { get; set; }

    // Who this holiday applies to / who was notified: All / Teachers / Students / Class
    public string TargetType { get; set; } = "All";
    public int? TargetClassId { get; set; }             // when TargetType == "Class"

    public bool EmailSent { get; set; }
    public int EmailCount { get; set; }

    public int? CreatedBy { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Class? TargetClass { get; set; }
}
