namespace school_erp.Models;

// Per-user per-module permission row (RBAC join).
public class Authority
{
    public int AuthorityId { get; set; }
    public int UserId { get; set; }
    public int ModuleId { get; set; }
    public bool CanView { get; set; } = false;
    public bool CanCreate { get; set; } = false;
    public bool CanEdit { get; set; } = false;
    public bool CanDelete { get; set; } = false;

    // Navigation
    public User? User { get; set; }
    public ModuleMaster? Module { get; set; }
}
