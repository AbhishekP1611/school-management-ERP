namespace school_erp.DTOs;

// ── Users ─────────────────────────────────────────────────────
public class UserDto
{
    public int     UserId   { get; set; }
    public string  Username { get; set; } = string.Empty;
    public string  Role     { get; set; } = "Student";
    public string? Email    { get; set; }
    public bool    IsActive { get; set; }
    public bool    EmailNotifications { get; set; } = true;
    public int?    UnitId   { get; set; }               // home unit
    public string? UnitName { get; set; }               // home unit name
    public List<int> UnitIds { get; set; } = new();     // every unit this user may access
}

public class CreateUserDto
{
    public string  Username { get; set; } = string.Empty;
    public string? Password { get; set; }               // required on create, optional on update
    public string  Role     { get; set; } = "Student";
    public string? Email    { get; set; }
    public bool    IsActive { get; set; } = true;
    public bool    EmailNotifications { get; set; } = true;
    public int?    UnitId   { get; set; }               // home unit (defaults to first of UnitIds)
    public List<int> UnitIds { get; set; } = new();     // units this user can access (multi-select)
}

// ── Modules / Authority ───────────────────────────────────────
public class ModuleDto
{
    public int     ModuleId    { get; set; }
    public string  ModuleName  { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? Route       { get; set; }
    public string? Icon        { get; set; }
    public int     SortOrder   { get; set; }
    public bool    IsActive    { get; set; }
}

// Create / edit a module from the Modules window.
public class SaveModuleDto
{
    public string  ModuleName  { get; set; } = string.Empty;   // RBAC key (unique)
    public string? DisplayName { get; set; }
    public string? Route       { get; set; }
    public string? Icon        { get; set; }
    public bool    IsActive    { get; set; } = true;
}

// Reorder payload: module ids in the new top-to-bottom order.
public class ReorderModulesDto
{
    public List<int> OrderedIds { get; set; } = new();
}

// One row of a user's permission grid.
public class AuthorityRowDto
{
    public int    ModuleId   { get; set; }
    public string ModuleName { get; set; } = string.Empty;
    public bool   CanView    { get; set; }
    public bool   CanCreate  { get; set; }
    public bool   CanEdit    { get; set; }
    public bool   CanDelete  { get; set; }
}

public class SaveAuthorityDto
{
    public int UserId { get; set; }
    public List<AuthorityRowDto> Permissions { get; set; } = new();
}
