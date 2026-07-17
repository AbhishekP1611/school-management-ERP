using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

public class UnitDto
{
    public int     UnitId         { get; set; }
    public string  UnitName       { get; set; } = string.Empty;
    public string? GstNo          { get; set; }
    public string? RegistrationNo { get; set; }
    public string? PrincipalName  { get; set; }
    public string? Address        { get; set; }
    public string? City           { get; set; }
    public string? State          { get; set; }
    public string? Pincode        { get; set; }
    public string? Phone          { get; set; }
    public string? Email          { get; set; }
    public string? LogoUrl        { get; set; }
    public bool    IsActive       { get; set; } = true;
    public int     StudentCount   { get; set; }
    public int     UserCount      { get; set; }
}

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class UnitsController : ControllerBase
{
    private readonly AppDbContext _db;
    public UnitsController(AppDbContext db) => _db = db;

    // GET api/units  — SuperAdmin sees all; others see only their own unit.
    [HttpGet]
    public async Task<IActionResult> GetAll()
    {
        var q = _db.Units.AsQueryable();
        if (!User.IsSuperAdmin())
        {
            var myUnit = User.UnitId();
            q = q.Where(u => u.UnitId == myUnit);
        }

        var list = await q.OrderBy(u => u.UnitName).ToListAsync();

        var result = new List<UnitDto>();
        foreach (var u in list)
        {
            result.Add(new UnitDto
            {
                UnitId = u.UnitId, UnitName = u.UnitName, GstNo = u.GstNo,
                RegistrationNo = u.RegistrationNo, PrincipalName = u.PrincipalName,
                Address = u.Address, City = u.City, State = u.State, Pincode = u.Pincode,
                Phone = u.Phone, Email = u.Email, LogoUrl = u.LogoUrl, IsActive = u.IsActive,
                StudentCount = await _db.Students.CountAsync(s => s.UnitId == u.UnitId && s.IsActive),
                UserCount    = await _db.Users.CountAsync(x => x.UnitId == u.UnitId && x.IsActive)
            });
        }
        return Ok(result);
    }

    // GET api/units/current — the unit the logged-in user belongs to (for prints/header).
    [HttpGet("current")]
    public async Task<IActionResult> Current()
    {
        var unitId = User.UnitId();
        if (unitId == null)
        {
            // SuperAdmin without a unit → return the first/default unit for header
            var def = await _db.Units.OrderBy(u => u.UnitId).FirstOrDefaultAsync();
            if (def == null) return Ok(new { });
            unitId = def.UnitId;
        }
        var u = await _db.Units.FindAsync(unitId);
        if (u == null) return NotFound();
        return Ok(new UnitDto
        {
            UnitId = u.UnitId, UnitName = u.UnitName, GstNo = u.GstNo,
            RegistrationNo = u.RegistrationNo, PrincipalName = u.PrincipalName,
            Address = u.Address, City = u.City, State = u.State, Pincode = u.Pincode,
            Phone = u.Phone, Email = u.Email, LogoUrl = u.LogoUrl, IsActive = u.IsActive
        });
    }

    // POST api/units  — SuperAdmin only.
    [HttpPost]
    [RequirePermission("Units", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] UnitDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.UnitName))
            return BadRequest(new { message = "Unit name is required." });

        var unit = new Unit
        {
            UnitName = dto.UnitName, GstNo = dto.GstNo, RegistrationNo = dto.RegistrationNo,
            PrincipalName = dto.PrincipalName, Address = dto.Address, City = dto.City,
            State = dto.State, Pincode = dto.Pincode, Phone = dto.Phone, Email = dto.Email,
            LogoUrl = dto.LogoUrl, IsActive = dto.IsActive
        };
        _db.Units.Add(unit);
        await _db.SaveChangesAsync();
        return Ok(new { unit.UnitId });
    }

    // PUT api/units/5  — SuperAdmin edits any; a unit admin can edit their own basics.
    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UnitDto dto)
    {
        if (!User.IsSuperAdmin() && User.UnitId() != id)
            return Forbid();

        var u = await _db.Units.FindAsync(id);
        if (u == null) return NotFound();

        u.UnitName = dto.UnitName; u.GstNo = dto.GstNo; u.RegistrationNo = dto.RegistrationNo;
        u.PrincipalName = dto.PrincipalName; u.Address = dto.Address; u.City = dto.City;
        u.State = dto.State; u.Pincode = dto.Pincode; u.Phone = dto.Phone; u.Email = dto.Email;
        if (dto.LogoUrl != null) u.LogoUrl = dto.LogoUrl;
        if (User.IsSuperAdmin()) u.IsActive = dto.IsActive;   // only SA can deactivate a unit

        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/units/5  — SuperAdmin only; blocked if the unit has active users/students.
    [HttpDelete("{id}")]
    [RequirePermission("Units", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var u = await _db.Units.FindAsync(id);
        if (u == null) return NotFound();

        int students = await _db.Students.CountAsync(s => s.UnitId == id && s.IsActive);
        if (students > 0)
            return BadRequest(new { message = $"Cannot delete — {students} active student(s) belong to this unit." });
        int users = await _db.Users.CountAsync(x => x.UnitId == id && x.IsActive);
        if (users > 0)
            return BadRequest(new { message = $"Cannot delete — {users} active user(s) belong to this unit." });

        u.IsActive = false;   // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
