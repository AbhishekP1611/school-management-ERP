namespace school_erp.Models;

// A school unit / branch. All data is scoped to a unit; a user belongs to one unit.
public class Unit
{
    public int UnitId { get; set; }
    public string UnitName { get; set; } = string.Empty;
    public string? GstNo { get; set; }
    public string? RegistrationNo { get; set; }      // affiliation / registration
    public string? PrincipalName { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? Pincode { get; set; }
    public string? Phone { get; set; }
    public string? Email { get; set; }
    public string? LogoUrl { get; set; }             // base64 / url — shown on prints
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
