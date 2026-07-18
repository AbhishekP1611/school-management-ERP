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
public class BusesController : ControllerBase
{
    private readonly AppDbContext _db;

    public BusesController(AppDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission("Transport", PermAction.View)]
    public async Task<IActionResult> GetAll()
    {
        var query = _db.Buses.Where(b => b.IsActive);
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(b => b.UnitId != null && units.Contains(b.UnitId.Value));

        var list = await query
            .Select(b => new BusDto
            {
                BusId       = b.BusId,
                BusNumber   = b.BusNumber,
                DriverName  = b.DriverName,
                DriverPhone = b.DriverPhone,
                RCNumber    = b.RCNumber,
                Capacity    = b.Capacity,
                Route       = b.Route,
                IsActive    = b.IsActive
            }).ToListAsync();
        return Ok(list);
    }

    [HttpPost]
    [RequirePermission("Transport", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateBusDto dto)
    {
        if (await _db.Buses.AnyAsync(b => b.BusNumber == dto.BusNumber))
            return BadRequest(new { message = "Bus number already exists." });

        var bus = new Bus
        {
            BusNumber   = dto.BusNumber,
            DriverName  = dto.DriverName,
            DriverPhone = dto.DriverPhone,
            RCNumber    = dto.RCNumber,
            Capacity    = dto.Capacity,
            Route       = dto.Route,
            UnitId      = User.UnitId()
        };
        _db.Buses.Add(bus);
        await _db.SaveChangesAsync();
        return Ok(bus);
    }

    [HttpPut("{id}")]
    [RequirePermission("Transport", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateBusDto dto)
    {
        var bus = await _db.Buses.FindAsync(id);
        if (bus == null) return NotFound();

        bus.BusNumber   = dto.BusNumber;
        bus.DriverName  = dto.DriverName;
        bus.DriverPhone = dto.DriverPhone;
        bus.RCNumber    = dto.RCNumber;
        bus.Capacity    = dto.Capacity;
        bus.Route       = dto.Route;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Transport", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var bus = await _db.Buses.FindAsync(id);
        if (bus == null) return NotFound();

        // Safe-delete: block if students are assigned to this bus.
        int assigned = await _db.BusAssignments.CountAsync(a => a.BusId == id);
        if (assigned > 0)
            return BadRequest(new { message = $"Cannot delete — {assigned} student(s) are assigned to this bus. Unassign them first." });

        bus.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
