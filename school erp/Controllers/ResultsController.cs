using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ResultsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ResultsController(AppDbContext db) => _db = db;

    // GET api/results/by-subject?examSubjectId=12
    // Returns the FULL class roster merged with any existing marks (grid for entry).
    [HttpGet("by-subject")]
    [RequirePermission("Academics", PermAction.View)]
    public async Task<IActionResult> GetBySubject([FromQuery] int examSubjectId)
    {
        var es = await _db.ExamSubjects
            .Include(x => x.Exam)
            .Include(x => x.Subject)
            .FirstOrDefaultAsync(x => x.ExamSubjectId == examSubjectId);
        if (es == null) return NotFound(new { message = "Exam subject not found." });

        // Unit guard: the exam-subject belongs to an exam owned by a unit.
        if (!User.InScope(HttpContext, es.Exam?.UnitId)) return Forbid();

        var classId = es.Exam!.ClassId;
        var students = await _db.Students
            .Where(s => s.IsActive && s.ClassId == classId)
            .OrderBy(s => s.RollNo).ThenBy(s => s.FirstName)
            .ToListAsync();

        var existing = await _db.Results
            .Where(r => r.ExamSubjectId == examSubjectId)
            .ToDictionaryAsync(r => r.StudentId);

        var rows = students.Select(s =>
        {
            existing.TryGetValue(s.StudentId, out var r);
            return new ResultRowDto
            {
                StudentId     = s.StudentId,
                StudentName   = $"{s.FirstName} {s.LastName}",
                AdmissionNo   = s.AdmissionNo,
                RollNo        = s.RollNo,
                MarksObtained = r?.MarksObtained,
                IsAbsent      = r?.IsAbsent ?? false
            };
        }).ToList();

        return Ok(new
        {
            examSubject = new ExamSubjectItemDto
            {
                ExamSubjectId = es.ExamSubjectId,
                SubjectId     = es.SubjectId,
                SubjectName   = es.Subject?.SubjectName,
                ExamDate      = es.ExamDate?.ToString("yyyy-MM-dd"),
                MaxMarks      = es.MaxMarks,
                PassingMarks  = es.PassingMarks
            },
            rows
        });
    }

    // POST api/results/save-subject  — bulk upsert marks for one exam-subject.
    [HttpPost("save-subject")]
    [RequirePermission("Academics", PermAction.Edit)]
    public async Task<IActionResult> SaveSubject([FromBody] SaveResultsDto dto)
    {
        // Unit guard: only allow writing marks for an exam-subject whose exam is in scope.
        var es = await _db.ExamSubjects
            .Include(x => x.Exam)
            .FirstOrDefaultAsync(x => x.ExamSubjectId == dto.ExamSubjectId);
        if (es == null) return NotFound(new { message = "Exam subject not found." });
        if (!User.InScope(HttpContext, es.Exam?.UnitId)) return Forbid();

        var existing = await _db.Results
            .Where(r => r.ExamSubjectId == dto.ExamSubjectId)
            .ToDictionaryAsync(r => r.StudentId);

        foreach (var row in dto.Rows)
        {
            if (existing.TryGetValue(row.StudentId, out var r))
            {
                r.MarksObtained = row.IsAbsent ? null : row.MarksObtained;
                r.IsAbsent      = row.IsAbsent;
            }
            else
            {
                _db.Results.Add(new Result
                {
                    ExamSubjectId = dto.ExamSubjectId,
                    StudentId     = row.StudentId,
                    MarksObtained = row.IsAbsent ? null : row.MarksObtained,
                    IsAbsent      = row.IsAbsent
                });
            }
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = "Results saved." });
    }

    // GET api/results/by-student?studentId=5  — marksheet grouped by exam.
    [HttpGet("by-student")]
    [RequirePermission("Academics", PermAction.View)]
    public async Task<IActionResult> GetByStudent([FromQuery] int studentId, [FromQuery] string? year)
    {
        // Unit filter: only marksheet rows whose exam belongs to an in-scope unit.
        var units = User.ScopeUnitIds(HttpContext);

        var resultsQ = _db.Results
            .Where(r => r.StudentId == studentId)
            .Where(r => r.ExamSubject!.Exam!.UnitId != null
                        && units.Contains(r.ExamSubject.Exam.UnitId.Value))
            .Include(r => r.ExamSubject).ThenInclude(es => es!.Exam)
            .Include(r => r.ExamSubject).ThenInclude(es => es!.Subject)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(year))
            resultsQ = resultsQ.Where(r => r.ExamSubject!.Exam!.AcademicYear == year);

        var results = await resultsQ.ToListAsync();

        var grouped = results
            .Where(r => r.ExamSubject?.Exam != null)
            .GroupBy(r => r.ExamSubject!.Exam!)
            .Select(g =>
            {
                var subjects = g.Select(r => new MarksheetSubjectDto
                {
                    SubjectName   = r.ExamSubject!.Subject?.SubjectName ?? "",
                    ExamDate      = r.ExamSubject.ExamDate?.ToString("yyyy-MM-dd"),
                    MaxMarks      = r.ExamSubject.MaxMarks,
                    PassingMarks  = r.ExamSubject.PassingMarks,
                    MarksObtained = r.MarksObtained,
                    IsAbsent      = r.IsAbsent,
                    Result        = r.IsAbsent ? "Absent"
                                    : (r.MarksObtained ?? 0) >= r.ExamSubject.PassingMarks ? "Pass" : "Fail"
                }).ToList();

                decimal totalMax = subjects.Sum(s => s.MaxMarks);
                decimal totalObt = subjects.Sum(s => s.MarksObtained ?? 0);
                decimal pct = totalMax > 0 ? Math.Round(totalObt / totalMax * 100, 2) : 0;

                return new MarksheetExamDto
                {
                    ExamId        = g.Key.ExamId,
                    ExamName      = g.Key.ExamName,
                    TotalMax      = totalMax,
                    TotalObtained = totalObt,
                    Percentage    = pct,
                    Grade         = GradeFor(pct),
                    Subjects      = subjects
                };
            })
            .OrderByDescending(x => x.ExamId)
            .ToList();

        return Ok(grouped);
    }

    private static string GradeFor(decimal pct) => pct switch
    {
        >= 90 => "A+",
        >= 80 => "A",
        >= 70 => "B",
        >= 60 => "C",
        >= 50 => "D",
        >= 35 => "E",
        _     => "F"
    };
}
