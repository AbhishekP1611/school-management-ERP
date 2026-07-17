namespace school_erp.Models;

// An emergency / general notice sent to a target audience.
public class Notice
{
    public int NoticeId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string Priority { get; set; } = "Normal";   // Normal / Important / Emergency
    public string TargetRole { get; set; } = "All";     // All / Admin / Teacher / Student
    public int? CreatedBy { get; set; }
    public string? CreatedByName { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool EmailSent { get; set; } = false;
    public bool IsDeleted { get; set; } = false;

    public ICollection<NoticeRead> Reads { get; set; } = new List<NoticeRead>();
}

// Tracks which user has read/dismissed which notice (for the bell badge).
public class NoticeRead
{
    public int NoticeReadId { get; set; }
    public int NoticeId { get; set; }
    public int UserId { get; set; }
    public DateTime ReadAt { get; set; } = DateTime.UtcNow;

    public Notice? Notice { get; set; }
}
