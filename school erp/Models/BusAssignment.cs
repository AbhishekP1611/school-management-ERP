namespace school_erp.Models;

// A student assigned to a bus at a specific boarding stop.
public class BusAssignment
{
    public int AssignmentId { get; set; }
    public int BusId { get; set; }
    public int StudentId { get; set; }
    public int StopId { get; set; }
    public DateOnly AssignedDate { get; set; } = DateOnly.FromDateTime(DateTime.Today);

    // Navigation
    public Bus? Bus { get; set; }
    public Student? Student { get; set; }
    public BusStop? Stop { get; set; }
}
