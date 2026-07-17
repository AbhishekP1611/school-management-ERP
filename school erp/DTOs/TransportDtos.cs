namespace school_erp.DTOs;

public class BusStopDto
{
    public int    StopId    { get; set; }
    public string StopName  { get; set; } = string.Empty;
    public int    StopOrder { get; set; }
    public string? StopTime { get; set; }
    public double Latitude  { get; set; }
    public double Longitude { get; set; }
}

public class BusRouteDto
{
    public int    BusId       { get; set; }
    public string BusNumber   { get; set; } = string.Empty;
    public string DriverName  { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }
    public int    Capacity    { get; set; }
    public string? StartLocation { get; set; }
    public string? Destination   { get; set; }
    public int    AssignedCount { get; set; }
    public int    SeatsAvailable { get; set; }
    public double TotalDistanceKm { get; set; }
    public int    EtaMinutes    { get; set; }
    public List<BusStopDto> Stops { get; set; } = new();
}

public class SaveBusRouteDto
{
    public int    BusId       { get; set; }   // 0 = create
    public string BusNumber   { get; set; } = string.Empty;
    public string DriverName  { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }
    public int    Capacity    { get; set; } = 40;
    public string? StartLocation { get; set; }
    public string? Destination   { get; set; }
    public List<SaveStopDto> Stops { get; set; } = new();
}

public class SaveStopDto
{
    public string StopName  { get; set; } = string.Empty;
    public string? StopTime { get; set; }
    public double Latitude  { get; set; }
    public double Longitude { get; set; }
}

public class BusAssignmentDto
{
    public int    AssignmentId { get; set; }
    public int    StudentId    { get; set; }
    public string StudentName  { get; set; } = string.Empty;
    public string? AdmissionNo { get; set; }
    public string? ClassName   { get; set; }
    public int    BusId        { get; set; }
    public string BusNumber    { get; set; } = string.Empty;
    public int    StopId       { get; set; }
    public string StopName     { get; set; } = string.Empty;
}

public class AssignStudentDto
{
    public int StudentId { get; set; }
    public int BusId     { get; set; }
    public int StopId    { get; set; }
}
