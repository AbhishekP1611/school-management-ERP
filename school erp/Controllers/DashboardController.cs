using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class DashboardController : ControllerBase
{
    private readonly AppDbContext _db;

    public DashboardController(AppDbContext db) => _db = db;

    [HttpGet]
    public async Task<IActionResult> GetDashboard([FromQuery] string? year)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        var weekAgo = today.AddDays(-6);

        // Unit scope — SuperAdmin sees all-unit totals; others see their unit only.
        bool allUnits = User.IsSuperAdmin();
        int? unit = User.UnitId();

        // Optional academic-year scope — when provided, year-scoped stats filter by it.
        bool hasYear = !string.IsNullOrWhiteSpace(year);

        var totalStudents = await _db.Students.CountAsync(s => s.IsActive && (allUnits || s.UnitId == unit) && (!hasYear || s.AcademicYear == year));
        var totalTeachers = await _db.Teachers.CountAsync(t => t.IsActive && (allUnits || t.UnitId == unit));
        var totalClasses  = await _db.Classes.CountAsync(c => !c.IsDeleted && (allUnits || c.UnitId == unit) && (!hasYear || c.AcademicYear == year));
        var totalBuses    = await _db.Buses.CountAsync(b => b.IsActive && (allUnits || b.UnitId == unit));

        var todayStudentAttendance = await _db.Attendances
            .Where(a => a.ReferenceType == "Student" && a.AttendanceDate == today && (!hasYear || a.AcademicYear == year))
            .ToListAsync();

        var todayTeacherAttendance = await _db.Attendances
            .Where(a => a.ReferenceType == "Teacher" && a.AttendanceDate == today && (!hasYear || a.AcademicYear == year))
            .ToListAsync();

        // Only count fees of active students, excluding soft-deleted fee rows.
        var feeCollected = await _db.Fees
            .Where(f => !f.IsDeleted && f.Student != null && f.Student.IsActive && (allUnits || f.UnitId == unit) && (!hasYear || f.AcademicYear == year))
            .SumAsync(f => f.PaidAmount);
        var feePending   = await _db.Fees
            .Where(f => !f.IsDeleted && f.Student != null && f.Student.IsActive && f.Status != "Paid" && (allUnits || f.UnitId == unit) && (!hasYear || f.AcademicYear == year))
            .SumAsync(f => f.Amount - f.Discount - f.PaidAmount);

        // Last 7-day attendance trend
        // Group in the DB by date, then format the label in memory (EF can't
        // translate DateOnly.ToString("yyyy-MM-dd") into SQL).
        var trendRaw = await _db.Attendances
            .Where(a => a.ReferenceType == "Student"
                     && a.AttendanceDate >= weekAgo
                     && a.AttendanceDate <= today
                     && (allUnits || a.UnitId == unit)
                     && (!hasYear || a.AcademicYear == year))
            .GroupBy(a => a.AttendanceDate)
            .Select(g => new
            {
                Date    = g.Key,
                Present = g.Count(x => x.Status == "Present"),
                Absent  = g.Count(x => x.Status == "Absent")
            })
            .ToListAsync();

        var trend = trendRaw
            .OrderBy(x => x.Date)
            .Select(x => new AttendanceTrendDto
            {
                Date    = x.Date.ToString("yyyy-MM-dd"),
                Present = x.Present,
                Absent  = x.Absent
            })
            .ToList();

        var upcoming = await _db.Events
            .Where(e => e.EventDate >= today && e.IsPublished && (allUnits || e.UnitId == unit))
            .OrderBy(e => e.EventDate)
            .Take(5)
            .Select(e => new EventDto
            {
                EventId    = e.EventId,
                EventTitle = e.EventTitle,
                EventDate  = e.EventDate.ToString("yyyy-MM-dd"),
                EndDate    = e.EndDate != null ? e.EndDate.Value.ToString("yyyy-MM-dd") : null,
                Venue      = e.Venue,
                EventType  = e.EventType,
                IsPublished = e.IsPublished
            })
            .ToListAsync();

        return Ok(new DashboardDto
        {
            TotalStudents          = totalStudents,
            TotalTeachers          = totalTeachers,
            TotalClasses           = totalClasses,
            TotalBuses             = totalBuses,
            TodayPresentStudents   = todayStudentAttendance.Count(a => a.Status == "Present"),
            TodayPresentTeachers   = todayTeacherAttendance.Count(a => a.Status == "Present"),
            TotalFeeCollected      = feeCollected,
            TotalFeePending        = feePending,
            AttendanceTrend        = trend,
            UpcomingEvents         = upcoming
        });
    }

    // GET api/dashboard/advanced?year=2026-27  — the rich, everything-at-a-glance dashboard.
    [HttpGet("advanced")]
    public async Task<IActionResult> Advanced([FromQuery] string? year)
    {
        var today = DateOnly.FromDateTime(DateTime.Today);
        bool sa = User.IsSuperAdmin();
        int? unit = User.UnitId();
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        int curStart = int.Parse(y.Split('-')[0]);   // e.g. 2026 for "2026-27"

        // ── Headline counts ──
        var totalStudents = await _db.Students.CountAsync(s => s.IsActive && (sa || s.UnitId == unit));
        var totalTeachers = await _db.Teachers.CountAsync(t => t.IsActive && (sa || t.UnitId == unit));
        var totalClasses  = await _db.Classes.CountAsync(c => !c.IsDeleted && (sa || c.UnitId == unit));
        var totalBuses    = await _db.Buses.CountAsync(b => b.IsActive && (sa || b.UnitId == unit));

        // ── Today's attendance % (student + teacher) for the donut charts ──
        var sAtt = await _db.Attendances.Where(a => a.ReferenceType == "Student" && a.AttendanceDate == today && (sa || a.UnitId == unit)).ToListAsync();
        var tAtt = await _db.Attendances.Where(a => a.ReferenceType == "Teacher" && a.AttendanceDate == today && (sa || a.UnitId == unit)).ToListAsync();
        object AttStat(List<Models.Attendance> list, int total)
        {
            int present = list.Count(a => a.Status == "Present");
            int absent  = list.Count(a => a.Status == "Absent");
            int late    = list.Count(a => a.Status == "Late");
            int leave   = list.Count(a => a.Status == "Leave");
            int marked  = list.Count;
            double pct  = marked > 0 ? Math.Round(present * 100.0 / marked, 1) : 0;
            return new { present, absent, late, leave, marked, total, percent = pct };
        }

        // ── 5-year Profit / Loss (previous 4 + current) ──
        // Income = fees paid + fines (that fall in the year); Expense = Expenses table.
        var pl = new List<object>();
        // preload fine rows once (small) and expenses per year via query
        var fineRows = await (sa ? _db.FineDetails : _db.FineDetails.Where(f => f.Student != null && f.Student.UnitId == unit))
            .Select(f => new { f.FineAmount, f.CreatedAt }).ToListAsync();
        for (int i = 4; i >= 0; i--)
        {
            int ys = curStart - i;
            string yy = $"{ys}-{(ys + 1) % 100:D2}";
            var feesPaid = await _db.Fees.Where(f => !f.IsDeleted && f.AcademicYear == yy && (sa || f.UnitId == unit)).SumAsync(f => (decimal?)f.PaidAmount) ?? 0;
            var fines = fineRows.Where(f => AcademicYearHelper.FromDate(f.CreatedAt) == yy).Sum(f => f.FineAmount);
            var income = feesPaid + fines;
            var expense = await _db.Expenses.Where(e => e.AcademicYear == yy && (sa || e.UnitId == unit)).SumAsync(e => (decimal?)e.Amount) ?? 0;
            pl.Add(new { year = yy, income, expense, profit = income - expense, isCurrent = yy == y });
        }

        // ── Fees (current year) ──
        var feesQ = _db.Fees.Where(f => !f.IsDeleted && f.AcademicYear == y && (sa || f.UnitId == unit));
        var feeCollected = await feesQ.SumAsync(f => (decimal?)f.PaidAmount) ?? 0;
        var feeDue = await feesQ.SumAsync(f => (decimal?)(f.Amount - f.Discount - f.PaidAmount)) ?? 0;
        var feeTotal = feeCollected + (feeDue > 0 ? feeDue : 0);

        // ── Class-wise student distribution (top 6) ──
        var classDist = await _db.Students
            .Where(s => s.IsActive && (sa || s.UnitId == unit) && s.Class != null)
            .GroupBy(s => new { s.ClassId, s.Class!.ClassName, s.Class.Section, s.Class.Stream })
            .Select(g => new { name = g.Key.ClassName + (g.Key.Stream != null ? " " + g.Key.Stream : "") + " (" + g.Key.Section + ")", count = g.Count() })
            .OrderByDescending(g => g.count)
            .Take(6)
            .ToListAsync();

        // ── Gender split ──
        var boys  = await _db.Students.CountAsync(s => s.IsActive && (sa || s.UnitId == unit) && s.Gender == "Male");
        var girls = await _db.Students.CountAsync(s => s.IsActive && (sa || s.UnitId == unit) && s.Gender == "Female");

        // ── Currently inside campus (gate) ──
        var insideNow = await _db.GatePasses.CountAsync(g => g.ExitAt == null && (sa || g.UnitId == unit));

        // ── Library: issued & fines this year ──
        var booksIssued = await _db.IssuedBooks.CountAsync(b => b.ReturnDate == null);
        var finesYear = fineRows.Where(f => AcademicYearHelper.FromDate(f.CreatedAt) == y).Sum(f => f.FineAmount);

        // ── 7-day attendance trend (student present %) ──
        var weekAgo = today.AddDays(-6);
        var trendRaw = await _db.Attendances
            .Where(a => a.ReferenceType == "Student" && a.AttendanceDate >= weekAgo && a.AttendanceDate <= today && (sa || a.UnitId == unit))
            .GroupBy(a => a.AttendanceDate)
            .Select(g => new { Date = g.Key, Present = g.Count(x => x.Status == "Present"), Total = g.Count() })
            .ToListAsync();
        var trend = trendRaw.OrderBy(x => x.Date).Select(x => new
        {
            date = x.Date.ToString("dd MMM"),
            percent = x.Total > 0 ? Math.Round(x.Present * 100.0 / x.Total, 0) : 0
        }).ToList();

        // ── Upcoming events ──
        var events = await _db.Events
            .Where(e => e.EventDate >= today && e.IsPublished && (sa || e.UnitId == unit))
            .OrderBy(e => e.EventDate).Take(5)
            .Select(e => new { e.EventTitle, date = e.EventDate.ToString("yyyy-MM-dd"), e.Venue, e.EventType })
            .ToListAsync();

        return Ok(new
        {
            year = y,
            counts = new { totalStudents, totalTeachers, totalClasses, totalBuses, boys, girls, insideNow, booksIssued },
            attendanceToday = new
            {
                student = AttStat(sAtt, totalStudents),
                teacher = AttStat(tAtt, totalTeachers)
            },
            profitLoss = pl,
            fees = new { collected = feeCollected, due = feeDue > 0 ? feeDue : 0, total = feeTotal, finesCollected = finesYear },
            classDistribution = classDist,
            attendanceTrend = trend,
            upcomingEvents = events
        });
    }
}
