using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;
using System.Security.Claims;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class AttendanceController : ControllerBase
{
    private readonly AppDbContext _db;

    public AttendanceController(AppDbContext db) => _db = db;

    // Which teacherId is this logged-in user? (null for admin / non-teacher)
    private async Task<int?> CurrentTeacherId()
    {
        if (!int.TryParse(User.FindFirstValue("userId"), out int userId)) return null;
        var t = await _db.Teachers.FirstOrDefaultAsync(x => x.UserId == userId && x.IsActive);
        return t?.TeacherId;
    }

    // Pure-permission "full attendance manager" check: a user who holds Attendance:Edit
    // manages ALL classes; anyone else is limited to the class(es)
    // they class-teach. Replaces the old role == "Admin" gate.
    private async Task<bool> IsAttendanceManager()
    {
        if (!int.TryParse(User.FindFirstValue("userId"), out int userId)) return false;
        var mod = await _db.Modules.FirstOrDefaultAsync(m => m.ModuleName == "Attendance");
        if (mod == null) return false;
        return await _db.Authorities.AnyAsync(a => a.UserId == userId && a.ModuleId == mod.ModuleId && a.CanEdit);
    }

    // GET api/attendance/my-classes — classes this user can take attendance for.
    // Classes are master data (not year-scoped). Admin → all active classes.
    // Teacher → only the class(es) they class-teach.
    [HttpGet("my-classes")]
    public async Task<IActionResult> MyClasses()
    {
        var q = _db.Classes.Where(c => !c.IsDeleted);
        // unit-scope: restrict to units this user may access
        var units = User.ScopeUnitIds(HttpContext);
        q = q.Where(c => c.UnitId != null && units.Contains(c.UnitId.Value));

        if (!await IsAttendanceManager())
        {
            var teacherId = await CurrentTeacherId();
            if (teacherId == null) return Ok(new List<object>());   // not a class teacher
            q = q.Where(c => c.ClassTeacherId == teacherId);
        }

        var list = await q
            .OrderBy(c => c.ClassName).ThenBy(c => c.Section)
            .Select(c => new { c.ClassId, className = c.ClassName + (c.Stream != null ? " " + c.Stream : "") + " (" + c.Section + ")" })
            .ToListAsync();
        return Ok(list);
    }

    // GET api/attendance?referenceType=Student&date=...&classId=...
    // NOTE: attendance is looked up by an exact DATE, so we deliberately ignore any
    // academic-year filter here — the date itself already fixes the year. Filtering by
    // the topbar's selected year would wrongly hide records for a date in another year.
    [HttpGet]
    public async Task<IActionResult> GetByDate(
        [FromQuery] string referenceType = "Student",
        [FromQuery] string? date = null,
        [FromQuery] int? classId = null)
    {
        var targetDate = date != null
            ? DateOnly.Parse(date)
            : DateOnly.FromDateTime(DateTime.Today);

        // A class-teacher can only view their own class's student attendance;
        // a full attendance manager (Attendance:Edit) sees all.
        if (referenceType == "Student" && !await IsAttendanceManager())
        {
            var teacherId = await CurrentTeacherId();
            var myClassIds = teacherId == null
                ? new List<int>()
                : await _db.Classes.Where(c => c.ClassTeacherId == teacherId && !c.IsDeleted).Select(c => c.ClassId).ToListAsync();

            if (classId == null || !myClassIds.Contains(classId.Value))
                return Ok(new List<AttendanceDto>());   // not allowed → empty
        }

        var today = DateOnly.FromDateTime(DateTime.Today);

        // Future dates: attendance can't be taken ahead of time → always empty.
        if (targetDate > today)
            return Ok(new List<AttendanceDto>());

        var attendance = await _db.Attendances
            .Where(a => a.ReferenceType == referenceType && a.AttendanceDate == targetDate)
            .ToListAsync();

        // Past dates with no marked attendance stay empty (view-only history —
        // we don't surface a full roster to back-fill an old day). Today always
        // shows the roster so it can be marked.
        if (targetDate < today && attendance.Count == 0)
            return Ok(new List<AttendanceDto>());

        // Enrich with names
        List<AttendanceDto> result;

        if (referenceType == "Student")
        {
            var studentsQ = _db.Students.Where(s => s.IsActive);
            if (classId.HasValue) studentsQ = studentsQ.Where(s => s.ClassId == classId.Value);
            var students = await studentsQ
                .OrderBy(s => s.RollNo).ThenBy(s => s.FirstName)
                .Select(s => new { s.StudentId, s.FirstName, s.LastName })
                .ToListAsync();

            result = students.Select(s =>
            {
                var rec = attendance.FirstOrDefault(a => a.ReferenceId == s.StudentId);
                return new AttendanceDto
                {
                    AttendanceId   = rec?.AttendanceId ?? 0,
                    ReferenceId    = s.StudentId,
                    ReferenceType  = "Student",
                    AttendanceDate = targetDate.ToString("yyyy-MM-dd"),
                    Status         = rec?.Status ?? "Present",
                    Remarks        = rec?.Remarks,
                    Name           = $"{s.FirstName} {s.LastName}"
                };
            }).ToList();
        }
        else
        {
            var teachers = await _db.Teachers
                .Where(t => t.IsActive)
                .Select(t => new { t.TeacherId, t.FirstName, t.LastName })
                .ToListAsync();

            result = teachers.Select(t =>
            {
                var rec = attendance.FirstOrDefault(a => a.ReferenceId == t.TeacherId);
                return new AttendanceDto
                {
                    AttendanceId   = rec?.AttendanceId ?? 0,
                    ReferenceId    = t.TeacherId,
                    ReferenceType  = "Teacher",
                    AttendanceDate = targetDate.ToString("yyyy-MM-dd"),
                    Status         = rec?.Status ?? "Present",
                    Remarks        = rec?.Remarks,
                    Name           = $"{t.FirstName} {t.LastName}"
                };
            }).ToList();
        }

        return Ok(result);
    }

    // GET api/attendance/summary?referenceType=Student&month=6&year=2025
    [HttpGet("summary")]
    public async Task<IActionResult> GetMonthlySummary(
        [FromQuery] string referenceType = "Student",
        [FromQuery] int month = 0,
        [FromQuery] int year = 0,
        [FromQuery] string? academicYear = null)
    {
        if (month == 0) month = DateTime.Today.Month;
        if (year  == 0) year  = DateTime.Today.Year;

        var from = new DateOnly(year, month, 1);
        var to   = from.AddMonths(1).AddDays(-1);

        var summaryQ = _db.Attendances
            .Where(a => a.ReferenceType == referenceType
                     && a.AttendanceDate >= from
                     && a.AttendanceDate <= to);

        if (!string.IsNullOrWhiteSpace(academicYear))
            summaryQ = summaryQ.Where(a => a.AcademicYear == academicYear);

        var records = await summaryQ
            .GroupBy(a => a.ReferenceId)
            .Select(g => new
            {
                ReferenceId = g.Key,
                Present = g.Count(x => x.Status == "Present"),
                Absent  = g.Count(x => x.Status == "Absent"),
                Late    = g.Count(x => x.Status == "Late"),
                Leave   = g.Count(x => x.Status == "Leave"),
                Total   = g.Count()
            })
            .ToListAsync();

        return Ok(records);
    }

    // POST api/attendance/bulk
    [HttpPost("bulk")]
    [RequirePermission("Attendance", PermAction.Edit)]
    public async Task<IActionResult> SaveBulk([FromBody] BulkAttendanceDto dto)
    {
        var markedBy = int.Parse(User.FindFirstValue("userId") ?? "0");
        var date = DateOnly.Parse(dto.AttendanceDate);

        // Attendance can't be marked for a future date.
        if (date > DateOnly.FromDateTime(DateTime.Today))
            return BadRequest(new { message = "Attendance cannot be marked for a future date." });

        // Security: a class-teacher can only save attendance for students of their
        // own class; a full attendance manager (Attendance:Edit) any class.
        if (dto.ReferenceType == "Student" && !await IsAttendanceManager())
        {
            var teacherId = await CurrentTeacherId();
            var myClassIds = teacherId == null
                ? new List<int>()
                : await _db.Classes.Where(c => c.ClassTeacherId == teacherId && !c.IsDeleted).Select(c => c.ClassId).ToListAsync();

            var studentIds = dto.Entries.Select(e => e.ReferenceId).ToList();
            var studentClassMap = await _db.Students
                .Where(s => studentIds.Contains(s.StudentId))
                .Select(s => new { s.StudentId, s.ClassId }).ToListAsync();

            if (studentClassMap.Any(s => s.ClassId == null || !myClassIds.Contains(s.ClassId.Value)))
                return Forbid();
        }

        foreach (var entry in dto.Entries)
        {
            var existing = await _db.Attendances.FirstOrDefaultAsync(a =>
                a.ReferenceId == entry.ReferenceId &&
                a.ReferenceType == dto.ReferenceType &&
                a.AttendanceDate == date);

            if (existing != null)
            {
                existing.Status  = entry.Status;
                existing.Remarks = entry.Remarks;
                existing.AcademicYear = AcademicYearHelper.FromDate(date);
            }
            else
            {
                _db.Attendances.Add(new Attendance
                {
                    ReferenceId    = entry.ReferenceId,
                    ReferenceType  = dto.ReferenceType,
                    AttendanceDate = date,
                    Status         = entry.Status,
                    Remarks        = entry.Remarks,
                    AcademicYear   = AcademicYearHelper.FromDate(date),
                    MarkedBy       = markedBy > 0 ? markedBy : null,
                    UnitId         = User.UnitId()
                });
            }
        }

        await _db.SaveChangesAsync();
        return Ok(new { message = "Attendance saved successfully." });
    }
}
