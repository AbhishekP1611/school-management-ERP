using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using school_erp.Models;

namespace school_erp.Helpers;

public class JwtHelper
{
    private readonly IConfiguration _config;

    public JwtHelper(IConfiguration config)
    {
        _config = config;
    }

    // absoluteExpiry = the hard "login time + 8h" cap. When omitted (null),
    // falls back to now + ExpiryHours (used only for edge cases).
    // allowedUnitIds = every unit this user may access (multi-unit). Baked into
    // the token as a comma-separated "unitIds" claim so scoping needs no DB hit.
    public string GenerateToken(User user, DateTime? absoluteExpiry = null, IEnumerable<int>? allowedUnitIds = null)
    {
        var jwtSettings = _config.GetSection("JwtSettings");
        var secret = Environment.GetEnvironmentVariable("SCHOOLERP_JWT_KEY") ?? jwtSettings["SecretKey"]!;
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var absExp = absoluteExpiry
            ?? DateTime.UtcNow.AddHours(double.Parse(jwtSettings["ExpiryHours"] ?? "8"));
        var absExpUnix = new DateTimeOffset(absExp, TimeSpan.Zero).ToUnixTimeSeconds();

        // Every unit the user may access, as "1,2,3". Falls back to the home
        // unit if no explicit list was supplied.
        var unitList = (allowedUnitIds != null && allowedUnitIds.Any())
            ? allowedUnitIds.Distinct()
            : (user.UnitId.HasValue ? new[] { user.UnitId.Value } : Array.Empty<int>());
        var unitIdsCsv = string.Join(",", unitList);

        var claims = new[]
        {
            new Claim(JwtRegisteredClaimNames.Sub,  user.UserId.ToString()),
            new Claim(JwtRegisteredClaimNames.Email, user.Email ?? ""),
            new Claim(ClaimTypes.Name,               user.Username),
            new Claim(ClaimTypes.Role,               user.Role),
            new Claim("userId",                      user.UserId.ToString()),
            new Claim("unitId",                      user.UnitId?.ToString() ?? ""),   // home unit
            new Claim("unitIds",                     unitIdsCsv),                       // all accessible units
            new Claim("absExp",                      absExpUnix.ToString()),   // hard login+8h cap
            new Claim(JwtRegisteredClaimNames.Jti,  Guid.NewGuid().ToString())
        };

        // The token itself expires at the absolute cap, so it dies exactly
        // 8 hours after login even if the tab stays open.
        var token = new JwtSecurityToken(
            issuer:             jwtSettings["Issuer"],
            audience:           jwtSettings["Audience"],
            claims:             claims,
            expires:            absExp,
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}
