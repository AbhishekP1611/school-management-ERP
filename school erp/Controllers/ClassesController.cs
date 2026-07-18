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
public class ClassesController : ControllerBase
{
    private readonly AppDbContext _db;

    public ClassesController(AppDbContext db) => _db = db;

    // Classes are MASTER DATA — created once, never year-scoped. The `year` param is
    // accepted for backward-compat but ignored: the same class list applies to all years.
    // (Which students are in a class in a given year comes from Student.AcademicYear.)
    [HttpGet]
    [RequirePermission("Classes", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] string? year)
    {
        var baseQ = _db.Classes.Where(c => !c.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        baseQ = baseQ.Where(c => c.UnitId != null && units.Contains(c.UnitId.Value));

        var list = await baseQ
            .Include(c => c.ClassTeacher)
            .Include(c => c.Students.Where(s => s.IsActive))
            .Select(c => new ClassDto
            {
                ClassId          = c.ClassId,
                ClassName        = c.ClassName,
                Section          = c.Section,
                Stream           = c.Stream,
                ClassTeacherId   = c.ClassTeacherId,
                ClassTeacherName = c.ClassTeacher != null ? c.ClassTeacher.FirstName + " " + c.ClassTeacher.LastName : null,
                AcademicYear     = c.AcademicYear,
                StudentCount     = c.Students.Count(s => s.IsActive),
                RoomNumber       = c.RoomNumber,
                Capacity         = c.Capacity,
                Shift            = c.Shift
            })
            .OrderBy(c => c.ClassName).ThenBy(c => c.Section)
            .ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    [RequirePermission("Classes", PermAction.View)]
    public async Task<IActionResult> GetById(int id)
    {
        var c = await _db.Classes
            .Include(x => x.ClassTeacher)
            .Include(x => x.Students.Where(s => s.IsActive))
            .FirstOrDefaultAsync(x => x.ClassId == id);

        if (c == null) return NotFound();
        if (!User.InScope(HttpContext, c.UnitId)) return Forbid();
        return Ok(new ClassDto
        {
            ClassId          = c.ClassId,
            ClassName        = c.ClassName,
            Section          = c.Section,
            Stream           = c.Stream,
            ClassTeacherId   = c.ClassTeacherId,
            ClassTeacherName = c.ClassTeacher?.FullName,
            AcademicYear     = c.AcademicYear,
            StudentCount     = c.Students.Count(s => s.IsActive),
            RoomNumber       = c.RoomNumber,
            Capacity         = c.Capacity,
            Shift            = c.Shift
        });
    }

    // GET api/classes/5/detail  — full class dossier: info + students + subjects + exams.
    [HttpGet("{id}/detail")]
    [RequirePermission("Classes", PermAction.View)]
    public async Task<IActionResult> GetDetail(int id)
    {
        var c = await _db.Classes
            .Include(x => x.ClassTeacher)
            .FirstOrDefaultAsync(x => x.ClassId == id);
        if (c == null) return NotFound();
        if (!User.InScope(HttpContext, c.UnitId)) return Forbid();

        var students = await _db.Students
            .Where(s => s.IsActive && s.ClassId == id)
            .OrderBy(s => s.RollNo).ThenBy(s => s.FirstName)
            .Select(s => new
            {
                s.StudentId, s.AdmissionNo, s.RollNo,
                name = s.FirstName + " " + s.LastName,
                s.Gender, s.Phone, s.PhotoUrl,
                parent = s.ParentName
            })
            .ToListAsync();

        var subjects = await _db.Subjects
            .Where(s => s.ClassId == id && !s.IsDeleted)
            .OrderBy(s => s.SubjectName)
            .Select(s => new { s.SubjectId, s.SubjectName })
            .ToListAsync();

        var exams = await _db.Exams
            .Where(e => e.ClassId == id && !e.IsDeleted)
            .OrderByDescending(e => e.ExamId)
            .Select(e => new { e.ExamId, e.ExamName, subjectCount = e.ExamSubjects.Count() })
            .ToListAsync();

        return Ok(new
        {
            cls = new ClassDto
            {
                ClassId = c.ClassId, ClassName = c.ClassName, Section = c.Section, Stream = c.Stream,
                ClassTeacherId = c.ClassTeacherId, ClassTeacherName = c.ClassTeacher?.FullName,
                AcademicYear = c.AcademicYear, StudentCount = students.Count,
                RoomNumber = c.RoomNumber, Capacity = c.Capacity, Shift = c.Shift
            },
            students,
            subjects,
            exams
        });
    }

    [HttpPost]
    [RequirePermission("Classes", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateClassDto dto)
    {
        // Classes are master data — unique by Name + Section + Stream (year-agnostic).
        // Stream distinguishes e.g. "Class 11 Science (A)" from "Class 11 Commerce (A)".
        if (await _db.Classes.AnyAsync(c =>
            c.ClassName == dto.ClassName &&
            c.Section == dto.Section    &&
            c.Stream == dto.Stream && !c.IsDeleted))
            return BadRequest(new { message = "This class + section + stream already exists." });

        // One teacher can be class-teacher of only ONE class.
        if (dto.ClassTeacherId.HasValue &&
            await _db.Classes.AnyAsync(c => c.ClassTeacherId == dto.ClassTeacherId))
            return BadRequest(new { message = "This teacher is already assigned as class teacher of another class." });

        var cls = new school_erp.Models.Class
        {
            ClassName      = dto.ClassName,
            Section        = dto.Section,
            Stream         = dto.Stream,
            ClassTeacherId = dto.ClassTeacherId,
            AcademicYear   = !string.IsNullOrWhiteSpace(dto.AcademicYear) ? dto.AcademicYear : AcademicYearHelper.Current(),
            RoomNumber     = dto.RoomNumber,
            Capacity       = dto.Capacity,
            Shift          = dto.Shift,
            UnitId         = User.ActiveUnitId(HttpContext)
        };

        _db.Classes.Add(cls);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = cls.ClassId }, cls);
    }

    [HttpPut("{id}")]
    [RequirePermission("Classes", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateClassDto dto)
    {
        var cls = await _db.Classes.FindAsync(id);
        if (cls == null) return NotFound();
        if (!User.InScope(HttpContext, cls.UnitId)) return Forbid();

        // One teacher can be class-teacher of only ONE class (exclude this class).
        if (dto.ClassTeacherId.HasValue &&
            await _db.Classes.AnyAsync(c => c.ClassTeacherId == dto.ClassTeacherId && c.ClassId != id))
            return BadRequest(new { message = "This teacher is already assigned as class teacher of another class." });

        cls.ClassName      = dto.ClassName;
        cls.Section        = dto.Section;
        cls.Stream         = dto.Stream;
        cls.ClassTeacherId = dto.ClassTeacherId;
        cls.AcademicYear   = dto.AcademicYear;
        cls.RoomNumber     = dto.RoomNumber;
        cls.Capacity       = dto.Capacity;
        cls.Shift          = dto.Shift;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Classes", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var cls = await _db.Classes.FindAsync(id);
        if (cls == null) return NotFound();
        if (!User.InScope(HttpContext, cls.UnitId)) return Forbid();

        // ── Safe-delete: block if active dependents exist ──
        int activeStudents = await _db.Students.CountAsync(s => s.ClassId == id && s.IsActive);
        if (activeStudents > 0)
            return BadRequest(new { message = $"Cannot delete — {activeStudents} active student(s) are in this class. Move or remove them first." });

        int subjects = await _db.Subjects.CountAsync(s => s.ClassId == id && !s.IsDeleted);
        if (subjects > 0)
            return BadRequest(new { message = $"Cannot delete — this class has {subjects} subject(s). Remove them first." });

        int exams = await _db.Exams.CountAsync(e => e.ClassId == id && !e.IsDeleted);
        if (exams > 0)
            return BadRequest(new { message = $"Cannot delete — this class has {exams} exam(s). Remove them first." });

        cls.IsDeleted = true;      // soft delete — data stays safe
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
