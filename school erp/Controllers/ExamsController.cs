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
public class ExamsController : ControllerBase
{
    private readonly AppDbContext _db;
    public ExamsController(AppDbContext db) => _db = db;

    // GET api/exams?classId=&examName=
    [HttpGet]
    [RequirePermission("Academics", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] int? classId, [FromQuery] string? examName, [FromQuery] string? year)
    {
        var query = _db.Exams
            .Where(e => !e.IsDeleted)
            .Include(e => e.Class)
            .Include(e => e.ExamSubjects).ThenInclude(es => es.Subject)
            .AsQueryable();

        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(e => e.UnitId != null && units.Contains(e.UnitId.Value));

        if (classId.HasValue) query = query.Where(e => e.ClassId == classId);
        if (!string.IsNullOrWhiteSpace(examName)) query = query.Where(e => e.ExamName == examName);
        if (!string.IsNullOrWhiteSpace(year)) query = query.Where(e => e.AcademicYear == year);

        var list = await query.OrderByDescending(e => e.ExamId).ToListAsync();

        var result = list.Select(e => new ExamDto
        {
            ExamId    = e.ExamId,
            ExamName  = e.ExamName,
            ClassId   = e.ClassId,
            ClassName = e.Class?.ClassName,
            Section   = e.Class?.Section,
            Subjects  = e.ExamSubjects.Select(es => new ExamSubjectItemDto
            {
                ExamSubjectId = es.ExamSubjectId,
                SubjectId     = es.SubjectId,
                SubjectName   = es.Subject?.SubjectName,
                ExamDate      = es.ExamDate?.ToString("yyyy-MM-dd"),
                MaxMarks      = es.MaxMarks,
                PassingMarks  = es.PassingMarks
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    // POST api/exams
    [HttpPost]
    [RequirePermission("Academics", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateExamDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.ExamName) || dto.ClassId == 0)
            return BadRequest(new { message = "Exam name and class are required." });
        if (dto.Subjects == null || dto.Subjects.Count == 0)
            return BadRequest(new { message = "Add at least one subject with an exam date." });

        var exam = new Exam { ExamName = dto.ExamName, ClassId = dto.ClassId, AcademicYear = AcademicYearHelper.Current(), UnitId = User.ActiveUnitId(HttpContext) };
        _db.Exams.Add(exam);
        await _db.SaveChangesAsync();

        foreach (var s in dto.Subjects)
        {
            _db.ExamSubjects.Add(new ExamSubject
            {
                ExamId       = exam.ExamId,
                SubjectId    = s.SubjectId,
                ExamDate     = s.ExamDate != null ? DateOnly.Parse(s.ExamDate) : null,
                MaxMarks     = s.MaxMarks,
                PassingMarks = s.PassingMarks
            });
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = "Exam created successfully.", examId = exam.ExamId });
    }

    // DELETE api/exams/subject/12  (remove one subject from an exam)
    [HttpDelete("subject/{examSubjectId}")]
    [RequirePermission("Academics", PermAction.Delete)]
    public async Task<IActionResult> DeleteSubject(int examSubjectId)
    {
        var es = await _db.ExamSubjects.Include(x => x.Exam).FirstOrDefaultAsync(x => x.ExamSubjectId == examSubjectId);
        if (es == null) return NotFound();
        if (!User.InScope(HttpContext, es.Exam?.UnitId)) return Forbid();
        if (await _db.Results.AnyAsync(r => r.ExamSubjectId == examSubjectId))
            return BadRequest(new { message = "This exam has results — cannot delete." });
        _db.ExamSubjects.Remove(es);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/exams/5
    [HttpDelete("{id}")]
    [RequirePermission("Academics", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var exam = await _db.Exams.FindAsync(id);
        if (exam == null) return NotFound();
        if (!User.InScope(HttpContext, exam.UnitId)) return Forbid();
        exam.IsDeleted = true;   // soft delete — keeps subjects + entered results safe
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
