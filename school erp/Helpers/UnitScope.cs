using System.Security.Claims;

namespace school_erp.Helpers;

// Helper to read the current user's unit scope from the JWT.
// Super Admin sees ALL units; everyone else is scoped to their own unit.
public static class UnitScope
{
    public static bool IsSuperAdmin(this ClaimsPrincipal user)
        => user.FindFirstValue(ClaimTypes.Role) == "SuperAdmin";

    // The user's unit id (null for Super Admin or if unset).
    public static int? UnitId(this ClaimsPrincipal user)
    {
        var v = user.FindFirstValue("unitId");
        return int.TryParse(v, out int id) ? id : (int?)null;
    }
}
