using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

// One student's promotion decision coming back from the UI.
public record PromoteRowDto(
    int StudentId,
    string Decision,        // Promote | Detain | Supplementary | Left
    int? TargetClassId,     // required for Promote
    string? ExitReason      // for Left (Left / TC)
);
public record PromoteDto(string FromYear, string ToYear, List<PromoteRowDto> Rows);
public record SuppDecisionDto(string Status, decimal? NewMarks, string? Remarks);  // Pass | Fail + supp-exam marks
public record PromoteSuppDto(int StudentId, int TargetClassId, string ToYear);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class PromotionController : ControllerBase
{
    private readonly AppDbContext _db;
    public PromotionController(AppDbContext db) => _db = db;

    private int Uid() { int.TryParse(User.FindFirst("userId")?.Value, out int id); return id; }

    // ── GET api/promotion/preview?year=&classId=  ──────────────────────
    // Students of a class in `year`, each with an AUTO-computed result from their
    // exam marks: all subjects >= passing → Pass; 1–2 failed → Supplementary; 3+ → Fail.
    [HttpGet("preview")]
    [RequirePermission("Promotion", PermAction.View)]
    public async Task<IActionResult> Preview([FromQuery] string year, [FromQuery] int classId)
    {
        bool sa = User.IsSuperAdmin();
        var unit = User.UnitId();
        if (string.IsNullOrWhiteSpace(year)) year = AcademicYearHelper.Current();

        var cls = await _db.Classes.FirstOrDefaultAsync(c => c.ClassId == classId && !c.IsDeleted);
        if (cls == null) return NotFound(new { message = "Class not found." });
        var fromClassName = $"{cls.ClassName} {cls.Section}";

        var studentsQ = _db.Students.Where(s => s.IsActive && s.ClassId == classId && s.AcademicYear == year);
        if (!sa) studentsQ = studentsQ.Where(s => s.UnitId == unit);
        var students = await studentsQ
            .OrderBy(s => s.RollNo).ThenBy(s => s.FirstName)
            .Select(s => new { s.StudentId, s.AdmissionNo, s.RollNo, s.FirstName, s.LastName })
            .ToListAsync();

        // Pull every mark for this class+year in one shot: Result → ExamSubject → Exam(classId, year)
        var marks = await _db.Results
            .Where(r => r.ExamSubject!.Exam!.ClassId == classId && r.ExamSubject.Exam.AcademicYear == year)
            .Select(r => new
            {
                r.StudentId,
                r.ExamSubject!.SubjectId,
                r.MarksObtained,
                r.IsAbsent,
                r.ExamSubject.PassingMarks,
                r.ExamSubject.MaxMarks
            })
            .ToListAsync();

        // fee due for each student this year (for carry-forward hint)
        var feeDue = await _db.Fees
            .Where(f => !f.IsDeleted && f.AcademicYear == year && f.Student != null && f.Student.ClassId == classId)
            .GroupBy(f => f.StudentId)
            .Select(g => new { sid = g.Key, due = g.Sum(x => x.Amount - x.Discount - x.PaidAmount) })
            .ToListAsync();
        var dueMap = feeDue.ToDictionary(x => x.sid, x => x.due);

        var rows = students.Select(s =>
        {
            var myMarks = marks.Where(m => m.StudentId == s.StudentId).ToList();
            // per-subject worst result: fail if absent OR obtained < passing
            var subjResults = myMarks
                .GroupBy(m => m.SubjectId)
                .Select(g =>
                {
                    var best = g.OrderByDescending(x => x.MarksObtained ?? -1).First();
                    bool passed = !best.IsAbsent && (best.MarksObtained ?? 0) >= best.PassingMarks;
                    return new { g.Key, passed, best.MarksObtained, best.PassingMarks };
                }).ToList();

            int totalSubj = subjResults.Count;
            int failed = subjResults.Count(x => !x.passed);
            string autoResult;
            if (totalSubj == 0) autoResult = "NoData";       // no exam marks — leave for manual
            else if (failed == 0) autoResult = "Pass";
            else if (failed <= 2) autoResult = "Supplementary";
            else autoResult = "Fail";

            decimal obtained = subjResults.Sum(x => x.MarksObtained ?? 0);
            decimal max = myMarks.Sum(m => m.MaxMarks);
            double pct = max > 0 ? Math.Round((double)(obtained / max) * 100, 1) : 0;

            return new
            {
                s.StudentId,
                s.AdmissionNo,
                rollNo = s.RollNo,
                name = $"{s.FirstName} {s.LastName}",
                totalSubjects = totalSubj,
                failedSubjects = failed,
                percent = pct,
                autoResult,                       // Pass / Supplementary / Fail / NoData
                failedSubjectIds = subjResults.Where(x => !x.passed).Select(x => x.Key).ToList(),
                feeDue = dueMap.TryGetValue(s.StudentId, out var d) ? d : 0
            };
        }).ToList();

        return Ok(new { year, classId, fromClassName, count = rows.Count, students = rows });
    }

    // ── GET api/promotion/target-classes  ── classes available to promote INTO ──
    // Classes are master data (fixed, not year-scoped) — promotion just re-points the
    // student's ClassId to the next class and bumps their AcademicYear.
    [HttpGet("target-classes")]
    [RequirePermission("Promotion", PermAction.View)]
    public async Task<IActionResult> TargetClasses([FromQuery] string? year)
    {
        bool sa = User.IsSuperAdmin();
        var unit = User.UnitId();
        var q = _db.Classes.Where(c => !c.IsDeleted);
        if (!sa) q = q.Where(c => c.UnitId == unit);
        var list = await q.OrderBy(c => c.ClassName).ThenBy(c => c.Section)
            .Select(c => new { c.ClassId, name = c.ClassName + (c.Stream != null ? " " + c.Stream : "") + " (" + c.Section + ")", c.ClassName, c.Section })
            .ToListAsync();
        return Ok(list);
    }

    // ── POST api/promotion/promote  ── apply the bulk decisions (atomic) ──
    [HttpPost("promote")]
    [RequirePermission("Promotion", PermAction.Edit)]
    public async Task<IActionResult> Promote([FromBody] PromoteDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ToYear))
            return BadRequest(new { message = "Target academic year is required." });
        if (dto.Rows == null || dto.Rows.Count == 0)
            return BadRequest(new { message = "No students to promote." });

        int promoted = 0, detained = 0, supp = 0, left = 0;
        var uid = Uid();

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            foreach (var row in dto.Rows)
            {
                var student = await _db.Students.Include(s => s.Class)
                    .FirstOrDefaultAsync(s => s.StudentId == row.StudentId && s.IsActive);
                if (student == null) continue;
                if (!User.IsSuperAdmin() && student.UnitId != User.UnitId()) continue;

                var fromClassName = student.Class != null ? $"{student.Class.ClassName} {student.Class.Section}" : "";
                var fromYear = student.AcademicYear;

                // snapshot the finishing year into StudentHistory (permanent record)
                await AddHistory(student, fromClassName, fromYear);

                switch (row.Decision)
                {
                    case "Promote":
                        if (row.TargetClassId.HasValue)
                        {
                            var tgt = await _db.Classes.FirstOrDefaultAsync(c => c.ClassId == row.TargetClassId.Value);
                            if (tgt != null)
                            {
                                await CarryForwardFee(student, fromYear, dto.ToYear);
                                student.ClassId = tgt.ClassId;          // fixed next class
                                student.AcademicYear = dto.ToYear;      // the new session
                                student.RollNo = null;                  // reassigned in the new class
                                student.PromotionStatus = "Promoted";
                                promoted++;
                            }
                        }
                        break;

                    case "Detain":
                        // Classes are fixed — a detained student keeps the SAME class,
                        // only their academic year advances (they repeat that class).
                        await CarryForwardFee(student, fromYear, dto.ToYear);
                        student.AcademicYear = dto.ToYear;
                        student.RollNo = null;
                        student.PromotionStatus = "Detained";
                        detained++;
                        break;

                    case "Supplementary":
                        // record supplementary rows for the failed subjects; don't move the student yet
                        student.PromotionStatus = "Supplementary";
                        await AddSupplementaryRows(student, fromClassName, fromYear);
                        supp++;
                        break;

                    case "Left":
                        student.IsActive = false;
                        student.ExitReason = string.IsNullOrWhiteSpace(row.ExitReason) ? "Left" : row.ExitReason;
                        student.PromotionStatus = "Passed-Out";
                        left++;
                        break;
                }
            }

            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch
        {
            await tx.RollbackAsync();
            throw;
        }

        return Ok(new
        {
            message = $"Promotion done — {promoted} promoted, {detained} detained, {supp} supplementary, {left} left.",
            promoted, detained, supplementary = supp, left
        });
    }

    private async Task AddHistory(Student student, string className, string sessionYear)
    {
        // compute this year's overall % from results
        var marks = await _db.Results
            .Where(r => r.StudentId == student.StudentId
                     && r.ExamSubject!.Exam!.AcademicYear == sessionYear)
            .Select(r => new { r.MarksObtained, r.ExamSubject!.MaxMarks })
            .ToListAsync();
        decimal obtained = marks.Sum(m => m.MarksObtained ?? 0);
        decimal max = marks.Sum(m => m.MaxMarks);
        decimal? pct = max > 0 ? Math.Round(obtained / max * 100, 2) : null;

        _db.StudentHistories.Add(new StudentHistory
        {
            StudentId = student.StudentId,
            ClassName = className,
            SessionYear = sessionYear,
            TotalMarks = max > 0 ? max : null,
            ObtainedMarks = max > 0 ? obtained : null,
            Percentage = pct,
            Result = student.PromotionStatus == "Detained" ? "Fail" : "Pass"
        });
    }

    private async Task AddSupplementaryRows(Student student, string fromClass, string year)
    {
        // find failed subjects from this year's results
        var failed = await _db.Results
            .Where(r => r.StudentId == student.StudentId && r.ExamSubject!.Exam!.AcademicYear == year)
            .Select(r => new
            {
                r.ExamSubject!.SubjectId,
                subjectName = r.ExamSubject.Subject != null ? r.ExamSubject.Subject.SubjectName : null,
                r.MarksObtained, r.IsAbsent, r.ExamSubject.PassingMarks
            })
            .ToListAsync();

        foreach (var f in failed.Where(x => x.IsAbsent || (x.MarksObtained ?? 0) < x.PassingMarks))
        {
            // avoid duplicate open supp for the same subject/year
            bool exists = await _db.SupplementaryRecords.AnyAsync(s =>
                s.StudentId == student.StudentId && s.SubjectId == f.SubjectId
                && s.AcademicYear == year && s.Status == "Pending");
            if (exists) continue;
            _db.SupplementaryRecords.Add(new SupplementaryRecord
            {
                StudentId = student.StudentId,
                SubjectId = f.SubjectId,
                SubjectName = f.subjectName,
                FromClass = fromClass,
                AcademicYear = year,
                MarksObtained = f.MarksObtained,
                PassingMarks = f.PassingMarks,
                Status = "Pending",
                UnitId = student.UnitId
            });
        }
    }

    private async Task CarryForwardFee(Student student, string fromYear, string toYear)
    {
        var due = await _db.Fees
            .Where(f => !f.IsDeleted && f.StudentId == student.StudentId && f.AcademicYear == fromYear)
            .SumAsync(f => (decimal?)(f.Amount - f.Discount - f.PaidAmount)) ?? 0;
        if (due <= 0) return;
        _db.Fees.Add(new Fee
        {
            StudentId = student.StudentId,
            FeeType = "Previous Balance",
            Amount = due,
            Discount = 0,
            PaidAmount = 0,
            Status = "Pending",
            Remarks = $"Carried forward from {fromYear}",
            AcademicYear = toYear,
            UnitId = student.UnitId,
            DueDate = null
        });
    }

    // ── Supplementary management ───────────────────────────────────────
    // GET api/promotion/supplementary?year=&status=Pending
    [HttpGet("supplementary")]
    [RequirePermission("Promotion", PermAction.View)]
    public async Task<IActionResult> Supplementary([FromQuery] string? year, [FromQuery] string? status)
    {
        var q = _db.SupplementaryRecords.AsQueryable();
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); q = q.Where(s => s.UnitId == u); }
        if (!string.IsNullOrWhiteSpace(year)) q = q.Where(s => s.AcademicYear == year);
        if (!string.IsNullOrWhiteSpace(status) && status != "All") q = q.Where(s => s.Status == status);

        var list = await q
            .OrderByDescending(s => s.SupplementaryId)
            .Select(s => new
            {
                s.SupplementaryId, s.StudentId,
                studentName = s.Student != null ? s.Student.FirstName + " " + s.Student.LastName : "",
                admissionNo = s.Student != null ? s.Student.AdmissionNo : null,
                s.SubjectName, s.FromClass, s.AcademicYear,
                s.MarksObtained, s.SuppMarks, s.PassingMarks, s.Status, s.Remarks
            })
            .ToListAsync();
        return Ok(list);
    }

    // POST api/promotion/supplementary/5/decide  → record supp-exam marks + Pass/Fail
    [HttpPost("supplementary/{id}/decide")]
    [RequirePermission("Promotion", PermAction.Edit)]
    public async Task<IActionResult> DecideSupplementary(int id, [FromBody] SuppDecisionDto dto)
    {
        var rec = await _db.SupplementaryRecords.FindAsync(id);
        if (rec == null) return NotFound();
        if (!User.IsSuperAdmin() && rec.UnitId != User.UnitId()) return Forbid();

        var status = dto.Status == "Pass" ? "Pass" : dto.Status == "Fail" ? "Fail" : null;
        if (status == null) return BadRequest(new { message = "Status must be Pass or Fail." });

        rec.SuppMarks = dto.NewMarks;          // marks scored in the supplementary exam
        rec.Status = status;
        rec.Remarks = dto.Remarks;
        rec.MarkedBy = Uid();
        rec.DecidedAt = DateTime.UtcNow;
        await _db.SaveChangesAsync();
        return Ok(new { message = $"Supplementary marked {status}." });
    }

    // ── GET api/promotion/ready?year=  ── students whose supplementary is fully cleared ──
    // A student is "ready to promote" if they have supplementary rows for `year` and
    // NONE are still Pending and NONE are Fail (i.e. all their supp subjects passed).
    [HttpGet("ready")]
    [RequirePermission("Promotion", PermAction.View)]
    public async Task<IActionResult> ReadyToPromote([FromQuery] string year)
    {
        if (string.IsNullOrWhiteSpace(year)) year = AcademicYearHelper.Current();
        var q = _db.SupplementaryRecords.Where(s => s.AcademicYear == year);
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); q = q.Where(s => s.UnitId == u); }
        var recs = await q.ToListAsync();

        var byStudent = recs.GroupBy(s => s.StudentId).Select(g => new
        {
            studentId = g.Key,
            allDecided = g.All(x => x.Status != "Pending"),
            anyFail = g.Any(x => x.Status == "Fail"),
            subjects = g.Select(x => x.SubjectName).ToList()
        }).ToList();

        var readyIds = byStudent.Where(x => x.allDecided && !x.anyFail).Select(x => x.studentId).ToList();
        var failedIds = byStudent.Where(x => x.allDecided && x.anyFail).Select(x => x.studentId).ToList();

        var allIds = readyIds.Concat(failedIds).Distinct().ToList();
        var studentInfo = await _db.Students
            .Where(s => allIds.Contains(s.StudentId) && s.IsActive)
            .Include(s => s.Class)
            .Select(s => new { s.StudentId, name = s.FirstName + " " + s.LastName, s.AdmissionNo,
                               className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "",
                               s.PromotionStatus })
            .ToListAsync();
        var infoMap = studentInfo.ToDictionary(s => s.StudentId);

        var ready = readyIds.Where(infoMap.ContainsKey).Select(sid => new
        {
            infoMap[sid].StudentId, infoMap[sid].name, infoMap[sid].AdmissionNo, infoMap[sid].className,
            clearedSubjects = byStudent.First(x => x.studentId == sid).subjects
        }).ToList();

        var failed = failedIds.Where(infoMap.ContainsKey).Select(sid => new
        {
            infoMap[sid].StudentId, infoMap[sid].name, infoMap[sid].AdmissionNo, infoMap[sid].className
        }).ToList();

        return Ok(new { year, ready, failed });
    }

    // ── POST api/promotion/promote-supplementary  ── promote a cleared supp student ──
    [HttpPost("promote-supplementary")]
    [RequirePermission("Promotion", PermAction.Edit)]
    public async Task<IActionResult> PromoteSupplementary([FromBody] PromoteSuppDto dto)
    {
        var student = await _db.Students.Include(s => s.Class).FirstOrDefaultAsync(s => s.StudentId == dto.StudentId && s.IsActive);
        if (student == null) return NotFound();
        if (!User.IsSuperAdmin() && student.UnitId != User.UnitId()) return Forbid();

        // guard: all supp for this year must be cleared (pass, none pending/fail)
        var supp = await _db.SupplementaryRecords.Where(s => s.StudentId == student.StudentId && s.AcademicYear == student.AcademicYear).ToListAsync();
        if (supp.Count == 0) return BadRequest(new { message = "No supplementary records for this student." });
        if (supp.Any(s => s.Status == "Pending")) return BadRequest(new { message = "Some supplementary subjects are still pending." });
        if (supp.Any(s => s.Status == "Fail")) return BadRequest(new { message = "Student failed a supplementary subject — cannot promote." });

        var tgt = await _db.Classes.FirstOrDefaultAsync(c => c.ClassId == dto.TargetClassId && !c.IsDeleted);
        if (tgt == null) return BadRequest(new { message = "Target class not found." });

        var fromClassName = student.Class != null ? $"{student.Class.ClassName} {student.Class.Section}" : "";
        var fromYear = student.AcademicYear;

        using var tx = await _db.Database.BeginTransactionAsync();
        try
        {
            await AddHistory(student, fromClassName, fromYear);
            await CarryForwardFee(student, fromYear, dto.ToYear);
            student.ClassId = tgt.ClassId;
            student.AcademicYear = dto.ToYear;
            student.RollNo = null;
            student.PromotionStatus = "Promoted";
            await _db.SaveChangesAsync();
            await tx.CommitAsync();
        }
        catch { await tx.RollbackAsync(); throw; }

        return Ok(new { message = $"{student.FirstName} promoted after clearing supplementary." });
    }
}
