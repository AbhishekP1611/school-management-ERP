namespace school_erp.Models;

// A single gate movement record. Covers Visitors, Students and Staff via PersonType.
// The record is "open" (person inside) until ExitAt is set.
public class GatePass
{
    public int GatePassId { get; set; }

    // Visitor | Student | Staff
    public string PersonType { get; set; } = "Visitor";

    // Direction/kind of pass: for students/staff we track In or Out movements;
    // for visitors it's always an In (entry) that gets an exit later.
    // Pass number for print (e.g. "GP-2026-0001").
    public string? PassNo { get; set; }

    // Common person info
    public string Name { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? PhotoUrl { get; set; }          // base64 data-url (optional)

    // Link to an existing student/staff (optional — for Student/Staff types)
    public int? StudentId { get; set; }
    public int? TeacherId { get; set; }
    public string? ReferenceNo { get; set; }        // AdmissionNo / EmployeeId / class shown

    // Visitor-specific
    public string? WhomToMeet { get; set; }
    public string? Purpose { get; set; }            // Meeting / Delivery / Enquiry / Event / Other

    // Student/Staff-specific
    public string? Reason { get; set; }             // Late arrival / Early leave / Half day / Official
    public string? ApprovedBy { get; set; }

    // Timing
    public DateTime EntryAt { get; set; } = DateTime.UtcNow;
    public DateTime? ExitAt { get; set; }
    public bool IsInside => ExitAt == null;

    public string? Remarks { get; set; }
    public int? RecordedBy { get; set; }            // userId of the gatekeeper
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Student? Student { get; set; }
    public Teacher? Teacher { get; set; }
}
