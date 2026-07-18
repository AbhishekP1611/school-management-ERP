using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

public record GateEntryDto(
    string PersonType,          // Visitor | Student | Staff
    string Name,
    string? Phone,
    string? PhotoUrl,
    int? StudentId,
    int? TeacherId,
    string? ReferenceNo,
    string? WhomToMeet,
    string? Purpose,
    string? Reason,
    string? ApprovedBy,
    string? Remarks
);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class GateController : ControllerBase
{
    private readonly AppDbContext _db;
    public GateController(AppDbContext db) => _db = db;

    private (int userId, string username) Me()
    {
        int.TryParse(User.FindFirst("userId")?.Value, out int id);
        return (id, User.FindFirst(ClaimTypes.Name)?.Value ?? "");
    }

    private IQueryable<GatePass> Scoped()
    {
        var q = _db.GatePasses.AsQueryable();
        var units = User.ScopeUnitIds(HttpContext);
        q = q.Where(g => g.UnitId != null && units.Contains(g.UnitId.Value));
        return q;
    }

    // GET api/gate/inside  — everyone currently on campus (not exited yet).
    [HttpGet("inside")]
    [RequirePermission("Gate", PermAction.View)]
    public async Task<IActionResult> Inside()
    {
        var list = await Scoped()
            .Where(g => g.ExitAt == null)
            .OrderByDescending(g => g.EntryAt)
            .Select(g => Project(g))
            .ToListAsync();
        return Ok(list);
    }

    // GET api/gate/log?date=yyyy-MM-dd&type=Visitor  — a day's full gate log.
    [HttpGet("log")]
    [RequirePermission("Gate", PermAction.View)]
    public async Task<IActionResult> Log([FromQuery] string? date, [FromQuery] string? type)
    {
        DateTime day = DateTime.UtcNow.Date;
        if (!string.IsNullOrWhiteSpace(date) && DateTime.TryParse(date, out var d)) day = d.Date;
        var next = day.AddDays(1);

        var q = Scoped().Where(g => g.EntryAt >= day && g.EntryAt < next);
        if (!string.IsNullOrWhiteSpace(type) && type != "All")
            q = q.Where(g => g.PersonType == type);

        var list = await q.OrderByDescending(g => g.EntryAt).Select(g => Project(g)).ToListAsync();
        return Ok(list);
    }

    // GET api/gate/stats  — quick counts for the dashboard header.
    [HttpGet("stats")]
    [RequirePermission("Gate", PermAction.View)]
    public async Task<IActionResult> Stats()
    {
        var today = DateTime.UtcNow.Date;
        var next = today.AddDays(1);
        var q = Scoped();

        var insideQ = q.Where(g => g.ExitAt == null);
        var todayQ  = q.Where(g => g.EntryAt >= today && g.EntryAt < next);

        return Ok(new
        {
            insideTotal    = await insideQ.CountAsync(),
            insideVisitors = await insideQ.CountAsync(g => g.PersonType == "Visitor"),
            insideStudents = await insideQ.CountAsync(g => g.PersonType == "Student"),
            insideStaff    = await insideQ.CountAsync(g => g.PersonType == "Staff"),
            todayEntries   = await todayQ.CountAsync(),
            todayExits     = await todayQ.CountAsync(g => g.ExitAt != null)
        });
    }

    // POST api/gate/entry  — log a new entry (person comes in).
    [HttpPost("entry")]
    [RequirePermission("Gate", PermAction.Create)]
    public async Task<IActionResult> Entry([FromBody] GateEntryDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Name))
            return BadRequest(new { message = "Name is required." });

        var type = string.IsNullOrWhiteSpace(dto.PersonType) ? "Visitor" : dto.PersonType;
        var (uid, _) = Me();
        var unitId = User.UnitId();

        // For Student/Staff, prevent a duplicate open "inside" record.
        if (type == "Student" && dto.StudentId.HasValue &&
            await Scoped().AnyAsync(g => g.StudentId == dto.StudentId && g.ExitAt == null))
            return BadRequest(new { message = "This student is already marked inside." });
        if (type == "Staff" && dto.TeacherId.HasValue &&
            await Scoped().AnyAsync(g => g.TeacherId == dto.TeacherId && g.ExitAt == null))
            return BadRequest(new { message = "This staff member is already marked inside." });

        var now = DateTime.UtcNow;
        var passNo = $"GP-{now:yyyyMMdd}-{Guid.NewGuid().ToString()[..4].ToUpper()}";

        var gp = new GatePass
        {
            PersonType = type,
            PassNo = passNo,
            Name = dto.Name.Trim(),
            Phone = dto.Phone,
            PhotoUrl = dto.PhotoUrl,
            StudentId = type == "Student" ? dto.StudentId : null,
            TeacherId = type == "Staff" ? dto.TeacherId : null,
            ReferenceNo = dto.ReferenceNo,
            WhomToMeet = dto.WhomToMeet,
            Purpose = dto.Purpose,
            Reason = dto.Reason,
            ApprovedBy = dto.ApprovedBy,
            Remarks = dto.Remarks,
            EntryAt = now,
            RecordedBy = uid,
            UnitId = unitId
        };
        _db.GatePasses.Add(gp);
        await _db.SaveChangesAsync();
        return Ok(new { gp.GatePassId, gp.PassNo, message = "Entry logged." });
    }

    // POST api/gate/exit/5  — mark a person as having left.
    [HttpPost("exit/{id}")]
    [RequirePermission("Gate", PermAction.Edit)]
    public async Task<IActionResult> Exit(int id)
    {
        var gp = await Scoped().FirstOrDefaultAsync(g => g.GatePassId == id);
        if (gp == null) return NotFound();
        if (gp.ExitAt != null) return BadRequest(new { message = "Already marked out." });
        gp.ExitAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = "Exit recorded." });
    }

    // Note: gate records are permanent (audit trail) — there is no delete endpoint.

    // ── Lookup helpers for the entry form (search a student / staff) ──
    [HttpGet("search-student")]
    [RequirePermission("Gate", PermAction.View)]
    public async Task<IActionResult> SearchStudent([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var sq = _db.Students.Where(s => s.IsActive &&
            (s.FirstName.Contains(q) || s.LastName.Contains(q) || s.AdmissionNo.Contains(q)));
        var units = User.ScopeUnitIds(HttpContext);
        sq = sq.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));
        var list = await sq.Include(s => s.Class).OrderBy(s => s.FirstName).Take(10)
            .Select(s => new
            {
                s.StudentId,
                name = s.FirstName + " " + s.LastName,
                refNo = s.AdmissionNo,
                className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "",
                phone = s.ParentPhone ?? s.Phone
            }).ToListAsync();
        return Ok(list);
    }

    [HttpGet("search-staff")]
    [RequirePermission("Gate", PermAction.View)]
    public async Task<IActionResult> SearchStaff([FromQuery] string q)
    {
        if (string.IsNullOrWhiteSpace(q)) return Ok(Array.Empty<object>());
        var tq = _db.Teachers.Where(t => t.IsActive &&
            (t.FirstName.Contains(q) || t.LastName.Contains(q) || t.EmployeeId.Contains(q)));
        var units = User.ScopeUnitIds(HttpContext);
        tq = tq.Where(t => t.UnitId != null && units.Contains(t.UnitId.Value));
        var list = await tq.OrderBy(t => t.FirstName).Take(10)
            .Select(t => new
            {
                t.TeacherId,
                name = t.FirstName + " " + t.LastName,
                refNo = t.EmployeeId,
                designation = t.Designation,
                phone = t.Phone
            }).ToListAsync();
        return Ok(list);
    }

    private static object Project(GatePass g) => new
    {
        g.GatePassId, g.PersonType, g.PassNo, g.Name, g.Phone, g.PhotoUrl,
        g.StudentId, g.TeacherId, g.ReferenceNo, g.WhomToMeet, g.Purpose,
        g.Reason, g.ApprovedBy, g.Remarks,
        entryAt = g.EntryAt.ToString("yyyy-MM-dd HH:mm:ss"),
        exitAt = g.ExitAt == null ? null : g.ExitAt.Value.ToString("yyyy-MM-dd HH:mm:ss"),
        isInside = g.ExitAt == null,
        durationMinutes = (int)Math.Max(0, ((g.ExitAt ?? DateTime.UtcNow) - g.EntryAt).TotalMinutes)
    };
}
