using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

public record CreateNoticeDto(string Title, string Message, string Priority, string TargetRole);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class NoticesController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly EmailHelper _email;
    public NoticesController(AppDbContext db, EmailHelper email) { _db = db; _email = email; }

    private (int userId, string username, string role) Me()
    {
        int.TryParse(User.FindFirst("userId")?.Value, out int id);
        return (id, User.FindFirst(ClaimTypes.Name)?.Value ?? "", User.FindFirst(ClaimTypes.Role)?.Value ?? "");
    }

    // POST api/notices  — send a notice (Admin/Teacher). Also emails recipients.
    [HttpPost]
    [RequirePermission("Notices", PermAction.Create)]
    public async Task<IActionResult> Send([FromBody] CreateNoticeDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Title) || string.IsNullOrWhiteSpace(dto.Message))
            return BadRequest(new { message = "Title and message are required." });

        var (uid, uname, _) = Me();
        var unitId = User.UnitId();
        var schoolName = await _db.Units.Where(u => u.UnitId == unitId).Select(u => u.UnitName).FirstOrDefaultAsync()
                         ?? "School ERP";

        var notice = new Notice
        {
            Title      = dto.Title,
            Message    = dto.Message,
            Priority   = string.IsNullOrWhiteSpace(dto.Priority) ? "Normal" : dto.Priority,
            TargetRole = string.IsNullOrWhiteSpace(dto.TargetRole) ? "All" : dto.TargetRole,
            CreatedBy  = uid,
            CreatedByName = uname,
            UnitId     = unitId
        };
        _db.Notices.Add(notice);
        await _db.SaveChangesAsync();

        // ── Gather recipient emails by audience (within the sender's unit) ──
        // Teacher → Teachers table; Student → Students (own or parent email); All → both.
        var emails = new List<string>();

        if (notice.TargetRole == "Teacher" || notice.TargetRole == "All")
        {
            var tEmails = await _db.Teachers
                .Where(t => t.IsActive && t.UnitId == unitId && t.Email != null && t.Email != "")
                .Where(t => t.UserId == null || _db.Users.Any(u => u.UserId == t.UserId && u.EmailNotifications))
                .Select(t => t.Email!)
                .ToListAsync();
            emails.AddRange(tEmails);
        }
        if (notice.TargetRole == "Student" || notice.TargetRole == "All")
        {
            var sEmails = await _db.Students
                .Where(s => s.IsActive && s.UnitId == unitId)
                .Select(s => s.Email != null && s.Email != "" ? s.Email : s.ParentEmail)
                .Where(e => e != null && e != "")
                .Select(e => e!)
                .ToListAsync();
            emails.AddRange(sEmails);
        }
        emails = emails.Distinct().ToList();

        // ── Send email (best-effort; app works even if SMTP not set) ──
        int sent = 0;
        if (emails.Count > 0)
        {
            var priorityTag = notice.Priority == "Emergency" ? "🚨 EMERGENCY: " : notice.Priority == "Important" ? "❗ " : "";
            var html = $@"
                <div style='font-family:Segoe UI,Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden'>
                  <div style='background:linear-gradient(135deg,#2563eb,#3b82f6);color:#fff;padding:20px 26px'>
                    <div style='font-size:20px;font-weight:800'>{System.Net.WebUtility.HtmlEncode(schoolName)}</div>
                    <div style='font-size:12px;opacity:.85'>Official Notice</div>
                  </div>
                  <div style='padding:24px 26px'>
                    <h2 style='margin:0 0 6px;color:#1e293b'>{priorityTag}{System.Net.WebUtility.HtmlEncode(notice.Title)}</h2>
                    <div style='display:inline-block;background:{(notice.Priority=="Emergency"?"#fee2e2":notice.Priority=="Important"?"#fef9c3":"#dbeafe")};color:{(notice.Priority=="Emergency"?"#dc2626":notice.Priority=="Important"?"#ca8a04":"#2563eb")};padding:3px 12px;border-radius:20px;font-size:12px;font-weight:700;margin-bottom:14px'>{notice.Priority}</div>
                    <p style='color:#334155;font-size:15px;line-height:1.7;white-space:pre-wrap'>{System.Net.WebUtility.HtmlEncode(notice.Message)}</p>
                    <hr style='border:none;border-top:1px dashed #cbd5e1;margin:20px 0'/>
                    <div style='font-size:12px;color:#94a3b8'>Sent by {System.Net.WebUtility.HtmlEncode(uname)} · This is an automated notice from {System.Net.WebUtility.HtmlEncode(schoolName)}.</div>
                  </div>
                </div>";
            sent = await _email.SendBulkAsync(emails, $"{priorityTag}{notice.Title}", html);
        }

        notice.EmailSent = sent > 0;
        await _db.SaveChangesAsync();

        return Ok(new
        {
            noticeId = notice.NoticeId,
            recipients = emails.Count,
            emailsSent = sent,
            emailConfigured = _email.IsConfigured(),
            message = _email.IsConfigured()
                ? $"Notice posted. Emailed to {sent} recipient(s)."
                : "Notice posted to the bell. Email is not configured yet (add Gmail app-password to enable email)."
        });
    }

    // GET api/notices  — notices for the current user (bell list), with read state.
    [HttpGet]
    public async Task<IActionResult> MyNotices()
    {
        var (uid, _, role) = Me();

        var noticesQ = _db.Notices
            .Where(n => (n.TargetRole == "All" || n.TargetRole == role) && !n.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        noticesQ = noticesQ.Where(n => n.UnitId != null && units.Contains(n.UnitId.Value));

        var notices = await noticesQ
            .OrderByDescending(n => n.NoticeId)
            .Take(50)
            .ToListAsync();

        var readIds = await _db.NoticeReads
            .Where(r => r.UserId == uid)
            .Select(r => r.NoticeId)
            .ToListAsync();

        var result = notices.Select(n => new
        {
            n.NoticeId, n.Title, n.Message, n.Priority, n.TargetRole,
            createdBy = n.CreatedByName,
            at = n.CreatedAt.ToString("yyyy-MM-dd HH:mm"),
            isRead = readIds.Contains(n.NoticeId)
        }).ToList();

        return Ok(result);
    }

    // GET api/notices/unread-count  — for the bell badge.
    [HttpGet("unread-count")]
    public async Task<IActionResult> UnreadCount()
    {
        var (uid, _, role) = Me();
        var myNoticeIds = await _db.Notices
            .Where(n => (n.TargetRole == "All" || n.TargetRole == role) && !n.IsDeleted)
            .Select(n => n.NoticeId).ToListAsync();
        var readIds = await _db.NoticeReads.Where(r => r.UserId == uid).Select(r => r.NoticeId).ToListAsync();
        return Ok(new { count = myNoticeIds.Except(readIds).Count() });
    }

    // POST api/notices/mark-read  — mark all my notices as read.
    [HttpPost("mark-read")]
    public async Task<IActionResult> MarkRead()
    {
        var (uid, _, role) = Me();
        var myNoticeIds = await _db.Notices
            .Where(n => (n.TargetRole == "All" || n.TargetRole == role) && !n.IsDeleted)
            .Select(n => n.NoticeId).ToListAsync();
        var already = await _db.NoticeReads.Where(r => r.UserId == uid).Select(r => r.NoticeId).ToListAsync();

        var toAdd = myNoticeIds.Except(already).Select(nid => new NoticeRead { NoticeId = nid, UserId = uid });
        _db.NoticeReads.AddRange(toAdd);
        await _db.SaveChangesAsync();
        return Ok();
    }

    // DELETE api/notices/5  (Admin — remove a notice)
    [HttpDelete("{id}")]
    [RequirePermission("Notices", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var n = await _db.Notices.FindAsync(id);
        if (n == null) return NotFound();
        n.IsDeleted = true;   // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
