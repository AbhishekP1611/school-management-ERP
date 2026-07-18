using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;
using System.Security.Claims;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class EventsController : ControllerBase
{
    private readonly AppDbContext _db;

    public EventsController(AppDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission("Events", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] string? type)
    {
        var query = _db.Events.Where(e => e.IsPublished).AsQueryable();
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(e => e.UnitId != null && units.Contains(e.UnitId.Value));
        if (!string.IsNullOrWhiteSpace(type)) query = query.Where(e => e.EventType == type);

        var list = await query.OrderBy(e => e.EventDate)
            .Select(e => new EventDto
            {
                EventId     = e.EventId,
                EventTitle  = e.EventTitle,
                Description = e.Description,
                EventDate   = e.EventDate.ToString("yyyy-MM-dd"),
                EndDate     = e.EndDate != null ? e.EndDate.Value.ToString("yyyy-MM-dd") : null,
                Venue       = e.Venue,
                EventType   = e.EventType,
                IsPublished = e.IsPublished
            }).ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    [RequirePermission("Events", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateEventDto dto)
    {
        var userId = int.Parse(User.FindFirstValue("userId") ?? "0");

        var ev = new Event
        {
            EventTitle  = dto.EventTitle,
            Description = dto.Description,
            EventDate   = DateOnly.Parse(dto.EventDate),
            EndDate     = dto.EndDate != null ? DateOnly.Parse(dto.EndDate) : null,
            Venue       = dto.Venue,
            EventType   = dto.EventType,
            IsPublished = dto.IsPublished,
            CreatedBy   = userId > 0 ? userId : null,
            UnitId      = User.ActiveUnitId(HttpContext)
        };

        _db.Events.Add(ev);
        await _db.SaveChangesAsync();
        return Ok(ev);
    }

    [HttpPut("{id}")]
    [RequirePermission("Events", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateEventDto dto)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        if (!User.InScope(HttpContext, ev.UnitId)) return Forbid();

        ev.EventTitle  = dto.EventTitle;
        ev.Description = dto.Description;
        ev.EventDate   = DateOnly.Parse(dto.EventDate);
        ev.EndDate     = dto.EndDate != null ? DateOnly.Parse(dto.EndDate) : null;
        ev.Venue       = dto.Venue;
        ev.EventType   = dto.EventType;
        ev.IsPublished = dto.IsPublished;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Events", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var ev = await _db.Events.FindAsync(id);
        if (ev == null) return NotFound();
        if (!User.InScope(HttpContext, ev.UnitId)) return Forbid();
        ev.IsPublished = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
