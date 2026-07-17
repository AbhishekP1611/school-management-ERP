namespace school_erp.Models;

// The list of permission-controlled modules (Students, Teachers, ...).
// This table now also drives the sidebar/navigation — order, label, route and icon
// all live here so modules can be added/reordered from the Modules window (no hardcode).
public class ModuleMaster
{
    public int ModuleId { get; set; }
    public string ModuleName { get; set; } = string.Empty;   // RBAC key (matches [RequirePermission])
    public string? DisplayName { get; set; }                 // sidebar label (falls back to ModuleName)
    public string? Route { get; set; }                       // app path e.g. "/students"
    public string? Icon { get; set; }                        // lucide icon name e.g. "Users"
    public int SortOrder { get; set; }                       // nav + default-landing priority (lower = higher)
    public bool IsActive { get; set; } = true;               // show in nav / gate routes

    public ICollection<Authority> Authorities { get; set; } = new List<Authority>();
}
