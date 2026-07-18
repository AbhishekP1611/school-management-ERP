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
public class SubjectsController : ControllerBase
{
    private readonly AppDbContext _db;
    public SubjectsController(AppDbContext db) => _db = db;

    // GET api/subjects/class/5
    [HttpGet("class/{classId}")]
    [RequirePermission("Academics", PermAction.View)]
    public async Task<IActionResult> GetByClass(int classId)
    {
        var query = _db.Subjects
            .Where(s => s.ClassId == classId && !s.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));

        var list = await query
            .OrderBy(s => s.SubjectName)
            .Select(s => new SubjectDto { SubjectId = s.SubjectId, SubjectName = s.SubjectName, ClassId = s.ClassId })
            .ToListAsync();
        return Ok(list);
    }

    // POST api/subjects
    [HttpPost]
    [RequirePermission("Academics", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateSubjectDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.SubjectName))
            return BadRequest(new { message = "Subject name is required." });
        if (await _db.Subjects.AnyAsync(s => s.ClassId == dto.ClassId && s.SubjectName == dto.SubjectName && !s.IsDeleted))
            return BadRequest(new { message = "This subject already exists for the class." });

        var subject = new Subject { SubjectName = dto.SubjectName.Trim(), ClassId = dto.ClassId, UnitId = User.ActiveUnitId(HttpContext) };
        _db.Subjects.Add(subject);
        await _db.SaveChangesAsync();
        return Ok(new SubjectDto { SubjectId = subject.SubjectId, SubjectName = subject.SubjectName, ClassId = subject.ClassId });
    }

    // DELETE api/subjects/9
    [HttpDelete("{id}")]
    [RequirePermission("Academics", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var subject = await _db.Subjects.FindAsync(id);
        if (subject == null) return NotFound();
        if (!User.InScope(HttpContext, subject.UnitId)) return Forbid();

        // Block if the subject is referenced by an exam
        if (await _db.ExamSubjects.AnyAsync(es => es.SubjectId == id))
            return BadRequest(new { message = "Cannot delete — this subject is used in an exam." });

        subject.IsDeleted = true;   // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
