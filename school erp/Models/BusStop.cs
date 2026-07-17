namespace school_erp.Models;

// An ordered stop on a bus route, with map coordinates.
public class BusStop
{
    public int StopId { get; set; }
    public int BusId { get; set; }
    public string StopName { get; set; } = string.Empty;
    public int StopOrder { get; set; }
    public string? StopTime { get; set; }      // "HH:mm"
    public double Latitude { get; set; }
    public double Longitude { get; set; }

    public Bus? Bus { get; set; }
    public ICollection<BusAssignment> Assignments { get; set; } = new List<BusAssignment>();
}
