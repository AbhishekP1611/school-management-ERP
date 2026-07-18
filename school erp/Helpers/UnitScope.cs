using System.Security.Claims;

namespace school_erp.Helpers;

// Multi-tenant unit scoping — PURELY unit-based, no special roles.
//
// Every user may access one OR MORE units (their "allowed units", carried in the
// JWT "unitIds" claim as "1,2,3"). There is NO SuperAdmin bypass: a user only
// ever sees the data of the units they are assigned to. Access to features is
// decided separately by the Authority table (per-module permissions).
public static class UnitScope
{
    // The user's home unit (where they were created; new records are stamped with it).
    public static int? UnitId(this ClaimsPrincipal user)
    {
        var v = user.FindFirstValue("unitId");
        return int.TryParse(v, out int id) ? id : (int?)null;
    }

    // Every unit this user may access. Reads the "unitIds" claim ("1,2,3").
    // Falls back to the single home unit if the list claim is absent (older tokens).
    public static List<int> AllowedUnitIds(this ClaimsPrincipal user)
    {
        var csv = user.FindFirstValue("unitIds");
        if (!string.IsNullOrWhiteSpace(csv))
        {
            return csv.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                      .Select(s => int.TryParse(s, out var id) ? id : (int?)null)
                      .Where(id => id.HasValue)
                      .Select(id => id!.Value)
                      .Distinct()
                      .ToList();
        }
        var home = user.UnitId();
        return home.HasValue ? new List<int> { home.Value } : new List<int>();
    }

    // True if the given unit id is one the user may access.
    public static bool CanAccessUnit(this ClaimsPrincipal user, int? unitId)
        => unitId.HasValue && user.AllowedUnitIds().Contains(unitId.Value);

    // The unit(s) whose data the current REQUEST should see. If the caller sent
    // an "X-Unit-Id" header (the active unit chosen in the header switcher) AND
    // that unit is one the user may access, scope to JUST that unit. Otherwise
    // fall back to ALL of the user's allowed units.
    // This is what controllers use for tenant filtering, so switching the active
    // unit re-scopes the whole app without touching every controller.
    public static List<int> ScopeUnitIds(this ClaimsPrincipal user, HttpContext? http)
    {
        var allowed = user.AllowedUnitIds();
        var header = http?.Request.Headers["X-Unit-Id"].FirstOrDefault();
        if (int.TryParse(header, out var active) && allowed.Contains(active))
            return new List<int> { active };
        return allowed;
    }
}
