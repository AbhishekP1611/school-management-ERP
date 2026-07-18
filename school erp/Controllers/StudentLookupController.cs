using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;

namespace school_erp.Controllers;

// The chatbot's "student 360" lookup — everything about one student for a given year.
[ApiController]
[Route("api/student-lookup")]
[Authorize]
public class StudentLookupController : ControllerBase
{
    private readonly AppDbContext _db;
    public StudentLookupController(AppDbContext db) => _db = db;

    // GET api/student-lookup/search?q=&year=&classId=  — student picker with filters.
    // Any combination: text query, academic year, and/or class.
    [HttpGet("search")]
    [RequirePermission("StudentLookup", PermAction.View)]
    public async Task<IActionResult> Search([FromQuery] string? q, [FromQuery] string? year, [FromQuery] int? classId)
    {
        // need at least one filter so we don't dump the whole school
        if (string.IsNullOrWhiteSpace(q) && string.IsNullOrWhiteSpace(year) && !classId.HasValue)
            return Ok(Array.Empty<object>());

        var sq = _db.Students.AsQueryable();
        var units = User.ScopeUnitIds(HttpContext);
        sq = sq.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));
        if (!string.IsNullOrWhiteSpace(q))
            sq = sq.Where(s => s.FirstName.Contains(q) || s.LastName.Contains(q) || s.AdmissionNo.Contains(q));
        if (!string.IsNullOrWhiteSpace(year))
            sq = sq.Where(s => s.AcademicYear == year);
        if (classId.HasValue)
            sq = sq.Where(s => s.ClassId == classId.Value);

        var list = await sq.Include(s => s.Class).OrderBy(s => s.FirstName).Take(50)
            .Select(s => new
            {
                s.StudentId,
                name = s.FirstName + " " + s.LastName,
                s.AdmissionNo,
                className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "",
                s.AcademicYear,
                active = s.IsActive
            }).ToListAsync();
        return Ok(list);
    }

    // GET api/student-lookup/classes  — all classes for the class filter dropdown.
    // Classes are master data (not year-scoped); the year filter is applied to the
    // STUDENT search instead, not to the class list.
    [HttpGet("classes")]
    [RequirePermission("StudentLookup", PermAction.View)]
    public async Task<IActionResult> ClassesForYear([FromQuery] string? year)
    {
        var q = _db.Classes.Where(c => !c.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        q = q.Where(c => c.UnitId != null && units.Contains(c.UnitId.Value));
        var list = await q.OrderBy(c => c.ClassName).ThenBy(c => c.Section)
            .Select(c => new { c.ClassId, name = c.ClassName + (c.Stream != null ? " " + c.Stream : "") + " (" + c.Section + ")" }).ToListAsync();
        return Ok(list);
    }

    // GET api/student-lookup/years?studentId=  — the academic years this student has data in.
    [HttpGet("years")]
    [RequirePermission("StudentLookup", PermAction.View)]
    public async Task<IActionResult> Years([FromQuery] int studentId)
    {
        var years = new HashSet<string>();
        var s = await _db.Students.FirstOrDefaultAsync(x => x.StudentId == studentId);
        if (s == null) return NotFound();
        if (!User.CanAccessUnit(s.UnitId)) return Forbid();

        if (!string.IsNullOrWhiteSpace(s.AcademicYear)) years.Add(s.AcademicYear);
        foreach (var y in await _db.Fees.Where(f => f.StudentId == studentId).Select(f => f.AcademicYear).Distinct().ToListAsync())
            if (!string.IsNullOrWhiteSpace(y)) years.Add(y);
        foreach (var y in await _db.StudentHistories.Where(h => h.StudentId == studentId && h.SessionYear != null).Select(h => h.SessionYear!).Distinct().ToListAsync())
            years.Add(y);
        // years from exam results
        var exYears = await _db.Results.Where(r => r.StudentId == studentId)
            .Select(r => r.ExamSubject!.Exam!.AcademicYear).Distinct().ToListAsync();
        foreach (var y in exYears) if (!string.IsNullOrWhiteSpace(y)) years.Add(y);

        return Ok(years.OrderByDescending(y => y).ToList());
    }

    // GET api/student-lookup/detail?studentId=&year=2026-27  — the full 360 report.
    [HttpGet("detail")]
    [RequirePermission("StudentLookup", PermAction.View)]
    public async Task<IActionResult> Detail([FromQuery] int studentId, [FromQuery] string year)
    {
        var s = await _db.Students.Include(s => s.Class).FirstOrDefaultAsync(x => x.StudentId == studentId);
        if (s == null) return NotFound(new { message = "Student not found." });
        if (!User.CanAccessUnit(s.UnitId)) return Forbid();
        if (string.IsNullOrWhiteSpace(year)) year = AcademicYearHelper.Current();

        // ── Profile ──
        var profile = new
        {
            s.StudentId, name = s.FirstName + " " + s.LastName, s.AdmissionNo, s.RollNo,
            className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "—",
            currentYear = s.AcademicYear, s.Gender, s.BloodGroup,
            s.ParentName, s.ParentPhone, s.Phone, active = s.IsActive,
            s.PromotionStatus, s.ExitReason
        };

        // ── Exam results (this year) grouped by exam ──
        var resultRows = await _db.Results
            .Where(r => r.StudentId == studentId && r.ExamSubject!.Exam!.AcademicYear == year)
            .Select(r => new
            {
                examName = r.ExamSubject!.Exam!.ExamName,
                subject = r.ExamSubject.Subject != null ? r.ExamSubject.Subject.SubjectName : "—",
                marks = r.MarksObtained,
                max = r.ExamSubject.MaxMarks,
                passing = r.ExamSubject.PassingMarks,
                absent = r.IsAbsent
            })
            .ToListAsync();

        var exams = resultRows
            .GroupBy(r => r.examName)
            .Select(g => new
            {
                examName = g.Key,
                subjects = g.Select(x => new
                {
                    x.subject, x.marks, x.max, x.passing, x.absent,
                    passed = !x.absent && (x.marks ?? 0) >= x.passing
                }).ToList(),
                total = g.Sum(x => x.marks ?? 0),
                maxTotal = g.Sum(x => x.max),
                percent = g.Sum(x => x.max) > 0 ? Math.Round((double)(g.Sum(x => x.marks ?? 0) / g.Sum(x => x.max)) * 100, 1) : 0,
                failed = g.Count(x => x.absent || (x.marks ?? 0) < x.passing)
            }).ToList();

        // ── Fees (this year) ──
        var feeRows = await _db.Fees.Where(f => !f.IsDeleted && f.StudentId == studentId && f.AcademicYear == year)
            .Select(f => new
            {
                f.FeeType, f.Amount, f.Discount, f.PaidAmount,
                balance = f.Amount - f.Discount - f.PaidAmount,
                f.Status,
                paymentDate = f.PaymentDate == null ? null : f.PaymentDate.Value.ToString("yyyy-MM-dd"),
                f.PaymentMode
            }).ToListAsync();
        var fees = new
        {
            items = feeRows,
            totalAmount = feeRows.Sum(f => f.Amount - f.Discount),
            totalPaid = feeRows.Sum(f => f.PaidAmount),
            totalDue = feeRows.Sum(f => f.balance > 0 ? f.balance : 0)
        };

        // ── Library (issued books + fines). Books aren't year-scoped, so we show current. ──
        var books = await _db.IssuedBooks.Where(b => b.StudentId == studentId)
            .Include(b => b.Book)
            .OrderByDescending(b => b.IssueId)
            .Select(b => new
            {
                bookName = b.Book != null ? b.Book.BookName : "—",
                issueDate = b.IssueDate.ToString("yyyy-MM-dd"),
                dueDate = b.DueDate.ToString("yyyy-MM-dd"),
                returned = b.ReturnDate != null,
                returnDate = b.ReturnDate == null ? null : b.ReturnDate.Value.ToString("yyyy-MM-dd")
            }).ToListAsync();
        var fineRows = await _db.FineDetails.Where(f => f.StudentId == studentId).ToListAsync();
        var libraryFinesYear = fineRows.Where(f => AcademicYearHelper.FromDate(f.CreatedAt) == year).Sum(f => f.FineAmount);
        var library = new
        {
            issued = books,
            issuedCount = books.Count,
            notReturned = books.Count(b => !b.returned),
            finesThisYear = libraryFinesYear
        };

        // ── Transport (current bus assignment) ──
        var busAssign = await _db.BusAssignments.Where(a => a.StudentId == studentId)
            .Include(a => a.Bus).Include(a => a.Stop)
            .Select(a => new
            {
                busNumber = a.Bus != null ? a.Bus.BusNumber : null,
                driver = a.Bus != null ? a.Bus.DriverName : null,
                route = a.Bus != null ? a.Bus.Route : null,
                stop = a.Stop != null ? a.Stop.StopName : null
            }).FirstOrDefaultAsync();

        // ── Supplementary (this year) ──
        var supp = await _db.SupplementaryRecords.Where(x => x.StudentId == studentId && x.AcademicYear == year)
            .Select(x => new
            {
                x.SubjectName, x.FromClass, x.MarksObtained, x.SuppMarks, x.PassingMarks, x.Status
            }).ToListAsync();

        // ── Attendance summary (this year) ──
        var attRows = await _db.Attendances
            .Where(a => a.ReferenceType == "Student" && a.ReferenceId == studentId && a.AcademicYear == year)
            .Select(a => a.Status).ToListAsync();
        var attendance = new
        {
            total = attRows.Count,
            present = attRows.Count(x => x == "Present"),
            absent = attRows.Count(x => x == "Absent"),
            late = attRows.Count(x => x == "Late"),
            leave = attRows.Count(x => x == "Leave"),
            percent = attRows.Count > 0 ? Math.Round(attRows.Count(x => x == "Present") * 100.0 / attRows.Count, 1) : 0
        };

        return Ok(new { year, profile, exams, fees, library, transport = busAssign, supplementary = supp, attendance });
    }

    // GET api/student-lookup/weakness?studentId=&year=2026-27
    // Rule-based (no external AI) analysis of a student's yearly results:
    // which subjects they're weak in, HOW weak (vs class average), and the
    // per-exam trend (improving / declining). Returns a ready-to-render report.
    [HttpGet("weakness")]
    [RequirePermission("StudentLookup", PermAction.View)]
    public async Task<IActionResult> Weakness([FromQuery] int studentId, [FromQuery] string year)
    {
        var s = await _db.Students.Include(x => x.Class).FirstOrDefaultAsync(x => x.StudentId == studentId);
        if (s == null) return NotFound(new { message = "Student not found." });
        if (!User.CanAccessUnit(s.UnitId)) return Forbid();
        if (string.IsNullOrWhiteSpace(year)) year = AcademicYearHelper.Current();

        var name = s.FirstName + " " + s.LastName;

        // This student's results for the year (subject + which exam + marks).
        var mine = await _db.Results
            .Where(r => r.StudentId == studentId && r.ExamSubject!.Exam!.AcademicYear == year)
            .Select(r => new
            {
                subject  = r.ExamSubject!.Subject != null ? r.ExamSubject.Subject.SubjectName : "—",
                examName = r.ExamSubject.Exam!.ExamName,
                marks    = r.MarksObtained,
                max      = r.ExamSubject.MaxMarks,
                passing  = r.ExamSubject.PassingMarks,
                absent   = r.IsAbsent,
                classId  = r.ExamSubject.Exam.ClassId
            })
            .ToListAsync();

        if (mine.Count == 0)
            return Ok(new { studentId, name, year, hasData = false,
                message = $"No exam results found for {name} in {year}, so a weakness analysis can't be generated yet." });

        // The class this student sat exams in (for the class-average comparison).
        var classIds = mine.Select(m => m.classId).Distinct().ToList();

        // Class averages per subject: every student's result for the same subjects/year/class.
        var classRows = await _db.Results
            .Where(r => r.ExamSubject!.Exam!.AcademicYear == year
                     && classIds.Contains(r.ExamSubject.Exam.ClassId)
                     && !r.IsAbsent && r.MarksObtained != null)
            .Select(r => new
            {
                subject = r.ExamSubject!.Subject != null ? r.ExamSubject.Subject.SubjectName : "—",
                pct     = r.ExamSubject.MaxMarks > 0 ? (double)(r.MarksObtained!.Value / r.ExamSubject.MaxMarks) * 100 : 0
            })
            .ToListAsync();

        var classAvgBySubject = classRows
            .GroupBy(r => r.subject)
            .ToDictionary(g => g.Key, g => Math.Round(g.Average(x => x.pct), 1));

        // Per-subject rollup for THIS student (average % across the year's exams).
        var subjects = mine
            .GroupBy(m => m.subject)
            .Select(g =>
            {
                var taken = g.Where(x => !x.absent && x.marks != null && x.max > 0).ToList();
                double avgPct = taken.Count > 0
                    ? Math.Round(taken.Average(x => (double)(x.marks!.Value / x.max) * 100), 1) : 0;
                double classAvg = classAvgBySubject.TryGetValue(g.Key, out var ca) ? ca : 0;
                int absents = g.Count(x => x.absent);

                // Per-exam trend (chronological-ish by exam name order they appear).
                var trend = g.Where(x => !x.absent && x.marks != null && x.max > 0)
                             .Select(x => new { x.examName, pct = Math.Round((double)(x.marks!.Value / x.max) * 100, 1) })
                             .ToList();
                string trendDir = "steady";
                if (trend.Count >= 2)
                {
                    var diff = trend.Last().pct - trend.First().pct;
                    trendDir = diff <= -8 ? "declining" : diff >= 8 ? "improving" : "steady";
                }

                // Weakness level: absolute score + gap vs class average.
                double gap = Math.Round(avgPct - classAvg, 1);   // negative = below class
                string level;
                if (avgPct < 35) level = "critical";
                else if (avgPct < 50 || gap <= -20) level = "weak";
                else if (avgPct < 60 || gap <= -10) level = "borderline";
                else level = "ok";

                return new { subject = g.Key, avgPct, classAvg, gap, trend = trendDir, absents, level };
            })
            .OrderBy(x => x.avgPct)   // weakest first
            .ToList();

        var weak = subjects.Where(x => x.level == "critical" || x.level == "weak").ToList();
        var borderline = subjects.Where(x => x.level == "borderline").ToList();
        var strong = subjects.Where(x => x.avgPct >= 75).OrderByDescending(x => x.avgPct).ToList();

        double overallPct = Math.Round(subjects.Average(x => x.avgPct), 1);

        // Build human-readable suggestions.
        var tips = new List<string>();
        foreach (var w in weak)
        {
            var howMuch = w.gap <= -20 ? $"far below the class average ({w.classAvg}%)"
                        : w.gap < 0 ? $"below the class average ({w.classAvg}%)"
                        : "low overall";
            var trendNote = w.trend == "declining" ? " and the scores are dropping across exams" : "";
            tips.Add($"{w.subject}: {w.avgPct}% — {howMuch}{trendNote}. Needs focused practice.");
        }
        foreach (var b in borderline.Where(x => x.trend == "declining"))
            tips.Add($"{b.subject}: {b.avgPct}% and slipping — keep an eye on it before it drops further.");
        if (weak.Count == 0 && borderline.Count == 0)
            tips.Add("No weak subjects — the student is performing well across the board. Keep it up!");

        var summary = weak.Count > 0
            ? $"{name} is weakest in {string.Join(", ", weak.Take(3).Select(w => $"{w.subject} ({w.avgPct}%)"))}."
            : $"{name} has no seriously weak subjects this year (overall {overallPct}%).";

        return Ok(new
        {
            studentId, name, year, hasData = true,
            className = s.Class != null ? s.Class.ClassName + " (" + s.Class.Section + ")" : "—",
            overallPct,
            summary,
            weak, borderline, strong,
            allSubjects = subjects,
            suggestions = tips
        });
    }
}
