namespace school_erp.Models;

public class Bus
{
    public int BusId { get; set; }
    public string BusNumber { get; set; } = string.Empty;
    public string DriverName { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }
    public string? RCNumber { get; set; }
    public int Capacity { get; set; } = 40;
    public string? Route { get; set; }
    public string? StartLocation { get; set; } = "School";
    public string? Destination { get; set; }
    public bool IsActive { get; set; } = true;
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public ICollection<BusStop> Stops { get; set; } = new List<BusStop>();
    public ICollection<BusAssignment> Assignments { get; set; } = new List<BusAssignment>();
}
