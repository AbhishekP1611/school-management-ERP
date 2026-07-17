using System.Security.Claims;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;

namespace school_erp.Helpers;

// Pure ID-based access control. Reads the current user's Authority row for the
// given module and checks the requested action flag. No role hardcoding.
//
// Usage:  [RequirePermission("Students", PermAction.Create)]
//
// Emergency recovery: if a user has NO create/edit/delete rights on ANY module
// (i.e. they'd be totally locked out of management), the "Users" module is
// implicitly granted so the last standing admin can restore permissions.
public enum PermAction { View, Create, Edit, Delete }

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class RequirePermissionAttribute : Attribute, IAsyncActionFilter
{
    private readonly string _module;
    private readonly PermAction _action;

    public RequirePermissionAttribute(string module, PermAction action = PermAction.View)
    {
        _module = module;
        _action = action;
    }

    public async Task OnActionExecutionAsync(ActionExecutingContext ctx, ActionExecutionDelegate next)
    {
        var user = ctx.HttpContext.User;

        // Must be authenticated
        if (user?.Identity?.IsAuthenticated != true)
        {
            ctx.Result = new UnauthorizedObjectResult(new { message = "Not authenticated." });
            return;
        }

        var userIdStr = user.FindFirstValue("userId");
        if (!int.TryParse(userIdStr, out int userId))
        {
            ctx.Result = new UnauthorizedObjectResult(new { message = "Invalid session." });
            return;
        }

        var db = ctx.HttpContext.RequestServices.GetRequiredService<AppDbContext>();

        // Look up the module + the user's authority row for it
        var module = await db.Modules.FirstOrDefaultAsync(m => m.ModuleName == _module);
        if (module == null)
        {
            // Unknown module → deny (fail-closed), never 500
            ctx.Result = new ObjectResult(new { message = $"Module '{_module}' is not configured." }) { StatusCode = 403 };
            return;
        }

        var auth = await db.Authorities.FirstOrDefaultAsync(a => a.UserId == userId && a.ModuleId == module.ModuleId);

        bool allowed = _action switch
        {
            PermAction.View   => auth?.CanView   ?? false,
            PermAction.Create => auth?.CanCreate ?? false,
            PermAction.Edit   => auth?.CanEdit   ?? false,
            PermAction.Delete => auth?.CanDelete ?? false,
            _ => false
        };

        // ── Emergency recovery: never lock everyone out of Users management ──
        // If this is the Users module and NO active user in this unit has any
        // Users-create/edit right, grant it to whoever is asking (last admin standing).
        if (!allowed && _module == "Users")
        {
            var usersModuleId = module.ModuleId;
            bool anyoneCanManageUsers = await db.Authorities
                .Where(a => a.ModuleId == usersModuleId && (a.CanCreate || a.CanEdit || a.CanDelete))
                .Join(db.Users, a => a.UserId, u => u.UserId, (a, u) => u)
                .AnyAsync(u => u.IsActive && !u.IsBlocked);
            if (!anyoneCanManageUsers) allowed = true;
        }

        if (!allowed)
        {
            ctx.Result = new ObjectResult(new
            {
                message = $"You don't have permission to {_action.ToString().ToLower()} in {_module}."
            }) { StatusCode = 403 };
            return;
        }

        await next();
    }
}
