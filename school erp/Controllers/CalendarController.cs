using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

// DTO for creating a holiday from the frontend.
public record CreateHolidayDto(
    string Title,
    string Date,               // yyyy-MM-dd
    string? EndDate,           // yyyy-MM-dd (optional, multi-day)
    string? Description,
    string? HolidayType,       // Holiday / Festival / Emergency / Event
    bool IsEmergency,
    string? TargetType,        // All / Teachers / Students / Class
    int? TargetClassId,
    bool SendEmail
);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class CalendarController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EmailHelper _email;
    public CalendarController(AppDbContext db, EmailHelper email) { _db = db; _email = email; }

    private (int userId, string username) Me()
    {
        int.TryParse(User.FindFirst("userId")?.Value, out int id);
        return (id, User.FindFirst(ClaimTypes.Name)?.Value ?? "");
    }

    // GET api/calendar?year=2026  — holidays for the year (unit-scoped). Sundays are
    // computed on the client, so we only return the stored/declared holidays here.
    [HttpGet]
    [RequirePermission("Calendar", PermAction.View)]
    public async Task<IActionResult> GetHolidays([FromQuery] int? year)
    {
        int y = year ?? DateTime.UtcNow.Year;
        var from = new DateOnly(y, 1, 1);
        var to   = new DateOnly(y, 12, 31);

        var q = _db.Holidays.Where(h => h.Date >= from && h.Date <= to);
        var units = User.ScopeUnitIds(HttpContext);
        q = q.Where(h => h.UnitId != null && units.Contains(h.UnitId.Value));

        var list = await q
            .OrderBy(h => h.Date)
            .Select(h => new
            {
                h.HolidayId,
                h.Title,
                date = h.Date.ToString("yyyy-MM-dd"),
                endDate = h.EndDate == null ? null : h.EndDate.Value.ToString("yyyy-MM-dd"),
                h.Description,
                h.HolidayType,
                h.IsEmergency,
                h.TargetType,
                h.TargetClassId,
                targetClassName = h.TargetClass != null ? h.TargetClass.ClassName + (h.TargetClass.Stream != null ? " " + h.TargetClass.Stream : "") + " (" + h.TargetClass.Section + ")" : null,
                h.EmailSent,
                h.EmailCount
            })
            .ToListAsync();

        return Ok(list);
    }

    // POST api/calendar  — declare a holiday; optionally email the chosen audience.
    [HttpPost]
    [RequirePermission("Calendar", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateHolidayDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title))
            return BadRequest(new { message = "Title is required." });
        if (!DateOnly.TryParse(dto.Date, out var date))
            return BadRequest(new { message = "Valid date is required." });

        DateOnly? endDate = null;
        if (!string.IsNullOrWhiteSpace(dto.EndDate) && DateOnly.TryParse(dto.EndDate, out var ed))
            endDate = ed;

        var (uid, uname) = Me();
        var unitId = User.UnitId();
        var target = string.IsNullOrWhiteSpace(dto.TargetType) ? "All" : dto.TargetType;

        var holiday = new Holiday
        {
            Title = dto.Title.Trim(),
            Date = date,
            EndDate = endDate,
            Description = dto.Description,
            HolidayType = string.IsNullOrWhiteSpace(dto.HolidayType) ? "Holiday" : dto.HolidayType,
            IsEmergency = dto.IsEmergency,
            TargetType = target,
            TargetClassId = target == "Class" ? dto.TargetClassId : null,
            CreatedBy = uid,
            UnitId = unitId
        };
        _db.Holidays.Add(holiday);
        await _db.SaveChangesAsync();

        int emailed = 0;
        if (dto.SendEmail)
        {
            var emails = await GatherRecipientEmails(target, dto.TargetClassId, unitId);
            if (emails.Count > 0)
            {
                var schoolName = await _db.Units.Where(u => u.UnitId == unitId)
                    .Select(u => u.UnitName).FirstOrDefaultAsync() ?? "School";
                var html = BuildEmailHtml(holiday, schoolName, uname);
                var subject = (holiday.IsEmergency ? "🚨 Emergency Holiday: " : "🏫 Holiday: ") + holiday.Title;
                emailed = await _email.SendBulkAsync(emails, subject, html);
            }
            holiday.EmailSent = emailed > 0;
            holiday.EmailCount = emailed;
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            holiday.HolidayId,
            emailsSent = emailed,
            emailConfigured = _email.IsConfigured(),
            message = dto.SendEmail
                ? (_email.IsConfigured()
                    ? $"Holiday saved. Emailed to {emailed} recipient(s)."
                    : "Holiday saved. Email is not configured yet (add Gmail app-password to enable email).")
                : "Holiday saved to the calendar."
        });
    }

    // DELETE api/calendar/5
    [HttpDelete("{id}")]
    [RequirePermission("Calendar", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var h = await _db.Holidays.FindAsync(id);
        if (h == null) return NotFound();
        // unit guard: user can only delete holidays in units they may access
        if (!User.CanAccessUnit(h.UnitId))
            return Forbid();
        _db.Holidays.Remove(h);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Gather recipient emails by audience (within the sender's unit) ──
    private async Task<List<string>> GatherRecipientEmails(string target, int? classId, int? unitId)
    {
        var emails = new List<string>();
        var units = User.ScopeUnitIds(HttpContext);

        if (target == "Teachers" || target == "All")
        {
            var tq = _db.Teachers.Where(t => t.IsActive && t.Email != null && t.Email != "");
            tq = tq.Where(t => t.UnitId != null && units.Contains(t.UnitId.Value));
            // honor per-user email opt-out: skip teachers whose linked login has it off
            tq = tq.Where(t => t.UserId == null
                || _db.Users.Any(u => u.UserId == t.UserId && u.EmailNotifications));
            emails.AddRange(await tq.Select(t => t.Email!).ToListAsync());
        }

        if (target == "Students" || target == "All")
        {
            var sq = _db.Students.Where(s => s.IsActive);
            sq = sq.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));
            // student's own email OR parent's email (whichever is present)
            emails.AddRange(await sq
                .Select(s => s.Email != null && s.Email != "" ? s.Email : s.ParentEmail)
                .Where(e => e != null && e != "")
                .Select(e => e!)
                .ToListAsync());
        }

        if (target == "Class" && classId.HasValue)
        {
            var sq = _db.Students.Where(s => s.IsActive && s.ClassId == classId.Value);
            sq = sq.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));
            emails.AddRange(await sq
                .Select(s => s.Email != null && s.Email != "" ? s.Email : s.ParentEmail)
                .Where(e => e != null && e != "")
                .Select(e => e!)
                .ToListAsync());
        }

        return emails.Where(e => !string.IsNullOrWhiteSpace(e)).Distinct().ToList();
    }

    private static string BuildEmailHtml(Holiday h, string schoolName, string sender)
    {
        var dateStr = h.Date.ToString("dddd, dd MMM yyyy");
        var range = h.EndDate.HasValue && h.EndDate.Value != h.Date
            ? $"{h.Date:dd MMM} – {h.EndDate.Value:dd MMM yyyy}"
            : dateStr;
        var accent = h.IsEmergency ? "#dc2626" : "#2563eb";
        var badge = h.IsEmergency ? "EMERGENCY HOLIDAY" : h.HolidayType.ToUpper();

        return $@"
            <div style='font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden'>
              <div style='background:linear-gradient(135deg,{accent},#3b82f6);color:#fff;padding:20px 26px'>
                <div style='font-size:20px;font-weight:800'>{System.Net.WebUtility.HtmlEncode(schoolName)}</div>
                <div style='font-size:12px;opacity:.85'>Holiday Notice</div>
              </div>
              <div style='padding:24px 26px'>
                <div style='display:inline-block;background:{(h.IsEmergency ? "#fee2e2" : "#dbeafe")};color:{accent};padding:3px 12px;border-radius:20px;font-size:11px;font-weight:800;letter-spacing:.5px;margin-bottom:12px'>{badge}</div>
                <h2 style='margin:0 0 8px;color:#1e293b'>{System.Net.WebUtility.HtmlEncode(h.Title)}</h2>
                <div style='background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;font-size:14px;color:#334155;margin-bottom:14px'>
                  <b>📅 {range}</b>
                </div>
                {(string.IsNullOrWhiteSpace(h.Description) ? "" : $"<p style='color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap'>{System.Net.WebUtility.HtmlEncode(h.Description)}</p>")}
                <hr style='border:none;border-top:1px dashed #cbd5e1;margin:20px 0'/>
                <div style='font-size:12px;color:#94a3b8'>Declared by {System.Net.WebUtility.HtmlEncode(sender)} · Automated notice from {System.Net.WebUtility.HtmlEncode(schoolName)}.</div>
              </div>
            </div>";
    }
}
