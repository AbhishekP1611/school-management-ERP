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
public class TeachersController : ControllerBase
{
    private readonly AppDbContext _db;

    public TeachersController(AppDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission("Teachers", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] string? search)
    {
        var query = _db.Teachers.Where(t => t.IsActive).AsQueryable();

        if (!User.IsSuperAdmin())
        {
            var unit = User.UnitId();
            query = query.Where(t => t.UnitId == unit);
        }

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(t =>
                t.FirstName.Contains(search) ||
                t.LastName.Contains(search)  ||
                t.EmployeeId.Contains(search));

        var list = await query.OrderBy(t => t.FirstName)
            .Select(t => new TeacherDto
            {
                TeacherId      = t.TeacherId,
                EmployeeId     = t.EmployeeId,
                FirstName      = t.FirstName,
                LastName       = t.LastName,
                Email          = t.Email,
                Phone          = t.Phone,
                Designation    = t.Designation,
                Specialization = t.Specialization,
                Salary         = t.Salary,
                DateOfJoining  = t.DateOfJoining != null ? t.DateOfJoining.Value.ToString("yyyy-MM-dd") : null,
                Address        = t.Address,
                Gender         = t.Gender,
                IsActive       = t.IsActive,
                PhotoUrl         = t.PhotoUrl,
                Qualification    = t.Qualification,
                DateOfBirth      = t.DateOfBirth != null ? t.DateOfBirth.Value.ToString("yyyy-MM-dd") : null,
                ExperienceYears  = t.ExperienceYears,
                BloodGroup       = t.BloodGroup,
                MaritalStatus    = t.MaritalStatus,
                Religion         = t.Religion,
                Category         = t.Category,
                EmergencyContact = t.EmergencyContact,
                AadharNo         = t.AadharNo
            }).ToListAsync();

        return Ok(list);
    }

    [HttpGet("{id}")]
    [RequirePermission("Teachers", PermAction.View)]
    public async Task<IActionResult> GetById(int id)
    {
        var t = await _db.Teachers.FindAsync(id);
        if (t == null) return NotFound();

        return Ok(new TeacherDto
        {
            TeacherId      = t.TeacherId,
            EmployeeId     = t.EmployeeId,
            FirstName      = t.FirstName,
            LastName       = t.LastName,
            Email          = t.Email,
            Phone          = t.Phone,
            Designation    = t.Designation,
            Specialization = t.Specialization,
            Salary         = t.Salary,
            DateOfJoining  = t.DateOfJoining?.ToString("yyyy-MM-dd"),
            Address        = t.Address,
            Gender         = t.Gender,
            IsActive       = t.IsActive,
            PhotoUrl         = t.PhotoUrl,
            Qualification    = t.Qualification,
            DateOfBirth      = t.DateOfBirth?.ToString("yyyy-MM-dd"),
            ExperienceYears  = t.ExperienceYears,
            BloodGroup       = t.BloodGroup,
            MaritalStatus    = t.MaritalStatus,
            Religion         = t.Religion,
            Category         = t.Category,
            EmergencyContact = t.EmergencyContact,
            AadharNo         = t.AadharNo
        });
    }

    // GET api/teachers/next-employee-id
    [HttpGet("next-employee-id")]
    public async Task<IActionResult> GetNextEmployeeId()
    {
        var allIds = await _db.Teachers.Select(t => t.EmployeeId).ToListAsync();
        int maxNum = 0;
        foreach (var id in allIds)
        {
            var m = System.Text.RegularExpressions.Regex.Match(id ?? "", @"^EMP(\d+)$");
            if (m.Success && int.TryParse(m.Groups[1].Value, out int n) && n > maxNum) maxNum = n;
        }
        return Ok(new { nextEmployeeId = $"EMP{(maxNum + 1):D3}" });
    }

    [HttpPost]
    [RequirePermission("Teachers", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateTeacherDto dto)
    {
        if (await _db.Teachers.AnyAsync(t => t.EmployeeId == dto.EmployeeId))
            return BadRequest(new { message = "Employee ID already exists." });

        var teacher = new Teacher
        {
            EmployeeId     = dto.EmployeeId,
            FirstName      = dto.FirstName,
            LastName       = dto.LastName,
            Email          = dto.Email,
            Phone          = dto.Phone,
            Designation    = dto.Designation,
            Specialization = dto.Specialization,
            Salary         = dto.Salary,
            DateOfJoining  = dto.DateOfJoining != null ? DateOnly.Parse(dto.DateOfJoining) : null,
            Address        = dto.Address,
            Gender         = dto.Gender,
            IsActive       = dto.IsActive,
            PhotoUrl         = dto.PhotoUrl,
            Qualification    = dto.Qualification,
            DateOfBirth      = dto.DateOfBirth != null ? DateOnly.Parse(dto.DateOfBirth) : null,
            ExperienceYears  = dto.ExperienceYears,
            BloodGroup       = dto.BloodGroup,
            MaritalStatus    = dto.MaritalStatus,
            Religion         = dto.Religion,
            Category         = dto.Category,
            EmergencyContact = dto.EmergencyContact,
            AadharNo         = dto.AadharNo,
            UnitId           = User.UnitId()
        };

        _db.Teachers.Add(teacher);
        await _db.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new { id = teacher.TeacherId }, teacher);
    }

    [HttpPut("{id}")]
    [RequirePermission("Teachers", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateTeacherDto dto)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();

        teacher.EmployeeId     = dto.EmployeeId;
        teacher.FirstName      = dto.FirstName;
        teacher.LastName       = dto.LastName;
        teacher.Email          = dto.Email;
        teacher.Phone          = dto.Phone;
        teacher.Designation    = dto.Designation;
        teacher.Specialization = dto.Specialization;
        teacher.Salary         = dto.Salary;
        teacher.DateOfJoining  = dto.DateOfJoining != null ? DateOnly.Parse(dto.DateOfJoining) : teacher.DateOfJoining;
        teacher.Address        = dto.Address;
        teacher.Gender         = dto.Gender;
        teacher.IsActive       = dto.IsActive;
        if (dto.PhotoUrl != null) teacher.PhotoUrl = dto.PhotoUrl;
        teacher.Qualification    = dto.Qualification;
        teacher.DateOfBirth      = dto.DateOfBirth != null ? DateOnly.Parse(dto.DateOfBirth) : teacher.DateOfBirth;
        teacher.ExperienceYears  = dto.ExperienceYears;
        teacher.BloodGroup       = dto.BloodGroup;
        teacher.MaritalStatus    = dto.MaritalStatus;
        teacher.Religion         = dto.Religion;
        teacher.Category         = dto.Category;
        teacher.EmergencyContact = dto.EmergencyContact;
        teacher.AadharNo         = dto.AadharNo;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Teachers", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var teacher = await _db.Teachers.FindAsync(id);
        if (teacher == null) return NotFound();

        // Safe-delete: block if this teacher is a class teacher of an active class.
        var cls = await _db.Classes.FirstOrDefaultAsync(c => c.ClassTeacherId == id && !c.IsDeleted);
        if (cls != null)
            return BadRequest(new { message = $"Cannot delete — this teacher is the class teacher of {cls.ClassName} {cls.Section}. Reassign first." });

        teacher.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
