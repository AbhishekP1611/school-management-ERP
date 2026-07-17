namespace school_erp.DTOs;

// ── Auth ──────────────────────────────────────────────────────
public record LoginRequest(string Username, string Password, int? UnitId = null, string? DeviceId = null);

public record ChangePasswordRequest(string CurrentPassword, string NewPassword);

public record LoginResponse(
    string Token,
    string Username,
    string Role,
    int UserId,
    string? Email
);

// ── Student DTOs ──────────────────────────────────────────────
public class StudentDto
{
    public int     StudentId     { get; set; }
    public string  AdmissionNo   { get; set; } = string.Empty;
    public string? RollNo        { get; set; }
    public string  FirstName     { get; set; } = string.Empty;
    public string  LastName      { get; set; } = string.Empty;
    public string  FullName      => $"{FirstName} {LastName}";
    public string? DateOfBirth   { get; set; }
    public string? Gender        { get; set; }
    public string? BloodGroup    { get; set; }
    public string? Email         { get; set; }
    public string? Phone         { get; set; }
    public string? Address       { get; set; }
    public int?    ClassId       { get; set; }
    public string? ClassName     { get; set; }
    public string? Section       { get; set; }
    public string? ParentName    { get; set; }
    public string? ParentPhone   { get; set; }
    public string? ParentEmail   { get; set; }
    public string? AdmissionDate { get; set; }
    public string? AcademicYear  { get; set; } = "2025-26";
    public bool    IsActive      { get; set; } = true;
    public string? PhotoUrl      { get; set; }
    // Extended fields
    public string? Religion         { get; set; }
    public string? Category         { get; set; }
    public string? AadharNo         { get; set; }
    public string? FatherName       { get; set; }
    public string? MotherName       { get; set; }
    public string? FatherOccupation { get; set; }
    public string? MotherOccupation { get; set; }
    public string? EmergencyContact { get; set; }
    public int?    BusId            { get; set; }
    public string? BusNumber        { get; set; }
    public int?    StopId           { get; set; }
    public string? StopName         { get; set; }
}

public class CreateStudentDto
{
    public string  AdmissionNo   { get; set; } = string.Empty;
    public string? RollNo        { get; set; }
    public string  FirstName     { get; set; } = string.Empty;
    public string  LastName      { get; set; } = string.Empty;
    public string? DateOfBirth   { get; set; }
    public string? Gender        { get; set; }
    public string? BloodGroup    { get; set; }
    public string? Email         { get; set; }
    public string? Phone         { get; set; }
    public string? Address       { get; set; }
    public int?    ClassId       { get; set; }
    public string? ParentName    { get; set; }
    public string? ParentPhone   { get; set; }
    public string? ParentEmail   { get; set; }
    public string? AdmissionDate { get; set; }
    public string  AcademicYear  { get; set; } = "2025-26";
    public string? PhotoUrl      { get; set; }
    // Extended fields
    public string? Religion         { get; set; }
    public string? Category         { get; set; }
    public string? AadharNo         { get; set; }
    public string? FatherName       { get; set; }
    public string? MotherName       { get; set; }
    public string? FatherOccupation { get; set; }
    public string? MotherOccupation { get; set; }
    public string? EmergencyContact { get; set; }
    public int?    BusId            { get; set; }
    public int?    StopId           { get; set; }
    public bool    IsActive         { get; set; } = true;
    // Nested collections — saved together with the student on create
    public List<CreateFeeDto>?            Fees    { get; set; }
    public List<CreateStudentHistoryDto>? History { get; set; }
}

// ── Student History DTOs ──────────────────────────────────────
public class StudentHistoryDto
{
    public int      HistoryId     { get; set; }
    public int      StudentId     { get; set; }
    public string?  ClassName     { get; set; }
    public string?  SessionYear   { get; set; }
    public decimal? TotalMarks    { get; set; }
    public decimal? ObtainedMarks { get; set; }
    public decimal? Percentage    { get; set; }
    public string?  Result        { get; set; }
}

public class CreateStudentHistoryDto
{
    public int      StudentId     { get; set; }
    public string?  ClassName     { get; set; }
    public string?  SessionYear   { get; set; }
    public decimal? TotalMarks    { get; set; }
    public decimal? ObtainedMarks { get; set; }
    public decimal? Percentage    { get; set; }
    public string?  Result        { get; set; }
}

// ── Teacher DTOs ──────────────────────────────────────────────
public class TeacherDto
{
    public int      TeacherId      { get; set; }
    public string   EmployeeId     { get; set; } = string.Empty;
    public string   FirstName      { get; set; } = string.Empty;
    public string   LastName       { get; set; } = string.Empty;
    public string   FullName       => $"{FirstName} {LastName}";
    public string   Email          { get; set; } = string.Empty;
    public string?  Phone          { get; set; }
    public string?  Designation    { get; set; }
    public string?  Specialization { get; set; }
    public decimal  Salary         { get; set; }
    public string?  DateOfJoining  { get; set; }
    public string?  Address        { get; set; }
    public string?  Gender         { get; set; }
    public bool     IsActive       { get; set; } = true;
    // Extended fields
    public string?  PhotoUrl         { get; set; }
    public string?  Qualification    { get; set; }
    public string?  DateOfBirth      { get; set; }
    public int?     ExperienceYears  { get; set; }
    public string?  BloodGroup       { get; set; }
    public string?  MaritalStatus    { get; set; }
    public string?  Religion         { get; set; }
    public string?  Category         { get; set; }
    public string?  EmergencyContact { get; set; }
    public string?  AadharNo         { get; set; }
}

public class CreateTeacherDto
{
    public string   EmployeeId     { get; set; } = string.Empty;
    public string   FirstName      { get; set; } = string.Empty;
    public string   LastName       { get; set; } = string.Empty;
    public string   Email          { get; set; } = string.Empty;
    public string?  Phone          { get; set; }
    public string?  Designation    { get; set; }
    public string?  Specialization { get; set; }
    public decimal  Salary         { get; set; }
    public string?  DateOfJoining  { get; set; }
    public string?  Address        { get; set; }
    public string?  Gender         { get; set; }
    public bool     IsActive       { get; set; } = true;
    // Extended fields
    public string?  PhotoUrl         { get; set; }
    public string?  Qualification    { get; set; }
    public string?  DateOfBirth      { get; set; }
    public int?     ExperienceYears  { get; set; }
    public string?  BloodGroup       { get; set; }
    public string?  MaritalStatus    { get; set; }
    public string?  Religion         { get; set; }
    public string?  Category         { get; set; }
    public string?  EmergencyContact { get; set; }
    public string?  AadharNo         { get; set; }
}

// ── Class DTOs ────────────────────────────────────────────────
public class ClassDto
{
    public int     ClassId         { get; set; }
    public string  ClassName       { get; set; } = string.Empty;
    public string  Section         { get; set; } = string.Empty;
    public string? Stream          { get; set; }
    public int?    ClassTeacherId  { get; set; }
    public string? ClassTeacherName { get; set; }
    public string  AcademicYear    { get; set; } = "2025-26";
    public int     StudentCount    { get; set; }
    public string? RoomNumber      { get; set; }
    public int?    Capacity        { get; set; }
    public string? Shift           { get; set; }
}

public class CreateClassDto
{
    public string  ClassName      { get; set; } = string.Empty;
    public string  Section        { get; set; } = string.Empty;
    public string? Stream         { get; set; }
    public int?    ClassTeacherId { get; set; }
    public string  AcademicYear   { get; set; } = "2025-26";
    public string? RoomNumber     { get; set; }
    public int?    Capacity       { get; set; }
    public string? Shift          { get; set; }
}

// ── Fee DTOs ──────────────────────────────────────────────────
public class FeeDto
{
    public int      FeeId          { get; set; }
    public int      StudentId      { get; set; }
    public string?  StudentName    { get; set; }
    public string   FeeType        { get; set; } = string.Empty;
    public decimal  Amount         { get; set; }
    public decimal  Discount       { get; set; }
    public decimal  PaidAmount     { get; set; }
    public decimal  BalanceAmount  { get; set; }
    public string?  DueDate        { get; set; }
    public string?  PaymentDate    { get; set; }
    public string?  PaymentMode    { get; set; }
    public string?  TransactionRef { get; set; }
    public string   Status         { get; set; } = "Pending";
    public string?  Remarks        { get; set; }
}

public class CreateFeeDto
{
    public int      StudentId      { get; set; }
    public string   FeeType        { get; set; } = string.Empty;
    public decimal  Amount         { get; set; }
    public decimal  Discount       { get; set; }
    public decimal  PaidAmount     { get; set; }
    public string?  DueDate        { get; set; }
    public string?  PaymentDate    { get; set; }
    public string?  PaymentMode    { get; set; }
    public string?  TransactionRef { get; set; }
    public string   Status         { get; set; } = "Pending";
    public string?  Remarks        { get; set; }
}

// ── Attendance DTOs ───────────────────────────────────────────
public class AttendanceDto
{
    public int     AttendanceId   { get; set; }
    public int     ReferenceId    { get; set; }
    public string  ReferenceType  { get; set; } = "Student";
    public string  AttendanceDate { get; set; } = string.Empty;
    public string  Status         { get; set; } = "Present";
    public string? Remarks        { get; set; }
    public string? Name           { get; set; }  // Resolved name for display
}

public class BulkAttendanceDto
{
    public string            ReferenceType  { get; set; } = "Student";
    public string            AttendanceDate { get; set; } = string.Empty;
    public List<AttendanceEntry> Entries    { get; set; } = new();
}

public class AttendanceEntry
{
    public int     ReferenceId { get; set; }
    public string  Status      { get; set; } = "Present";
    public string? Remarks     { get; set; }
}

// ── Bus DTOs ──────────────────────────────────────────────────
public class BusDto
{
    public int     BusId       { get; set; }
    public string  BusNumber   { get; set; } = string.Empty;
    public string  DriverName  { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }
    public string? RCNumber    { get; set; }
    public int     Capacity    { get; set; }
    public string? Route       { get; set; }
    public bool    IsActive    { get; set; }
}

public class CreateBusDto
{
    public string  BusNumber   { get; set; } = string.Empty;
    public string  DriverName  { get; set; } = string.Empty;
    public string? DriverPhone { get; set; }
    public string? RCNumber    { get; set; }
    public int     Capacity    { get; set; } = 40;
    public string? Route       { get; set; }
}

// ── Event DTOs ────────────────────────────────────────────────
public class EventDto
{
    public int     EventId     { get; set; }
    public string  EventTitle  { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string  EventDate   { get; set; } = string.Empty;
    public string? EndDate     { get; set; }
    public string? Venue       { get; set; }
    public string? EventType   { get; set; }
    public bool    IsPublished { get; set; }
}

public class CreateEventDto
{
    public string  EventTitle  { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string  EventDate   { get; set; } = string.Empty;
    public string? EndDate     { get; set; }
    public string? Venue       { get; set; }
    public string? EventType   { get; set; }
    public bool    IsPublished { get; set; } = true;
}

// ── Dashboard DTO ─────────────────────────────────────────────
public class DashboardDto
{
    public int TotalStudents { get; set; }
    public int TotalTeachers { get; set; }
    public int TotalClasses  { get; set; }
    public int TotalBuses    { get; set; }
    public int TodayPresentStudents { get; set; }
    public int TodayPresentTeachers { get; set; }
    public decimal TotalFeeCollected { get; set; }
    public decimal TotalFeePending   { get; set; }
    public List<AttendanceTrendDto> AttendanceTrend { get; set; } = new();
    public List<EventDto>           UpcomingEvents  { get; set; } = new();
}

public class AttendanceTrendDto
{
    public string Date    { get; set; } = string.Empty;
    public int    Present { get; set; }
    public int    Absent  { get; set; }
}
