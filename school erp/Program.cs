using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using school_erp.Data;
using school_erp.Helpers;

var builder = WebApplication.CreateBuilder(args);

// ── Secrets (env vars override appsettings; never commit real secrets) ──
// In production set:  SCHOOLERP_DB_CONNECTION  and  SCHOOLERP_JWT_KEY
// In local dev they come from appsettings.Development.json (git-ignored).
var connString = Environment.GetEnvironmentVariable("SCHOOLERP_DB_CONNECTION")
                 ?? builder.Configuration.GetConnectionString("DefaultConnection");
var jwtSettings = builder.Configuration.GetSection("JwtSettings");
var jwtKey = Environment.GetEnvironmentVariable("SCHOOLERP_JWT_KEY")
             ?? jwtSettings["SecretKey"];

if (string.IsNullOrWhiteSpace(connString))
    throw new InvalidOperationException("Database connection string is not configured. Set SCHOOLERP_DB_CONNECTION or ConnectionStrings:DefaultConnection.");
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException("JWT secret key is missing or too short (min 32 chars). Set SCHOOLERP_JWT_KEY or JwtSettings:SecretKey.");

// ── Database ──────────────────────────────────────────────────
builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlServer(connString));

// ── JWT Auth ──────────────────────────────────────────────────
var secretKey = Encoding.UTF8.GetBytes(jwtKey);

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer           = true,
            ValidateAudience         = true,
            ValidateLifetime         = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer              = jwtSettings["Issuer"],
            ValidAudience            = jwtSettings["Audience"],
            IssuerSigningKey         = new SymmetricSecurityKey(secretKey),
            ClockSkew                = TimeSpan.Zero
        };
    });

builder.Services.AddAuthorization();

// ── CORS (allow React dev server) ─────────────────────────────
builder.Services.AddCors(options =>
{
    options.AddPolicy("ReactApp", policy =>
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials());
});

// ── DI ────────────────────────────────────────────────────────
builder.Services.AddSingleton<JwtHelper>();
builder.Services.AddScoped<EmailHelper>();
builder.Services.AddControllers();
builder.Services.AddOpenApi();

// ── Remove old WeatherForecast ────────────────────────────────
var app = builder.Build();

// ── Seed DB ───────────────────────────────────────────────────
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    await DbSeeder.SeedAsync(db);
}

// ── Global exception handler — clean JSON, no leaked stack traces ─────
app.UseExceptionHandler(errApp =>
{
    errApp.Run(async context =>
    {
        var feature = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        var ex = feature?.Error;

        // Log full detail server-side; return a safe message to the client.
        var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("GlobalError");
        logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);

        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new
        {
            message = "Something went wrong. Please try again."
        });
    });
});

// ── Middleware Pipeline ───────────────────────────────────────
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseCors("ReactApp");
app.UseHttpsRedirection();
app.UseAuthentication();
app.UseAuthorization();

// Activity logging + block enforcement (after auth so the user is known)
app.UseMiddleware<school_erp.Middleware.ActivityMiddleware>();

app.MapControllers();

app.Run();
