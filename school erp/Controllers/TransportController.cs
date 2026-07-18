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
public class TransportController : ControllerBase
{
    private readonly AppDbContext _db;
    public TransportController(AppDbContext db) => _db = db;

    // Haversine distance in km between two lat/lng points.
    private static double Haversine(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371;
        double dLat = (lat2 - lat1) * Math.PI / 180;
        double dLon = (lon2 - lon1) * Math.PI / 180;
        double a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                   Math.Cos(lat1 * Math.PI / 180) * Math.Cos(lat2 * Math.PI / 180) *
                   Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        return R * 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    }

    private static double RouteDistanceKm(List<BusStop> stops)
    {
        double total = 0;
        var ordered = stops.OrderBy(s => s.StopOrder).ToList();
        for (int i = 1; i < ordered.Count; i++)
            total += Haversine(ordered[i - 1].Latitude, ordered[i - 1].Longitude, ordered[i].Latitude, ordered[i].Longitude);
        return Math.Round(total, 2);
    }

    // GET api/transport/routes  — all buses with stops + live counts + distance/ETA.
    [HttpGet("routes")]
    [RequirePermission("Transport", PermAction.View)]
    public async Task<IActionResult> GetRoutes()
    {
        var units = User.ScopeUnitIds(HttpContext);
        var buses = await _db.Buses
            .Where(b => b.IsActive)
            .Where(b => b.UnitId != null && units.Contains(b.UnitId.Value))
            .Include(b => b.Stops)
            .Include(b => b.Assignments)
            .ToListAsync();

        var result = buses.Select(b =>
        {
            var dist = RouteDistanceKm(b.Stops.ToList());
            int assigned = b.Assignments.Count;
            return new BusRouteDto
            {
                BusId = b.BusId, BusNumber = b.BusNumber, DriverName = b.DriverName,
                DriverPhone = b.DriverPhone, Capacity = b.Capacity,
                StartLocation = b.StartLocation, Destination = b.Destination,
                AssignedCount = assigned, SeatsAvailable = Math.Max(0, b.Capacity - assigned),
                TotalDistanceKm = dist,
                EtaMinutes = (int)Math.Round(dist / 30.0 * 60),  // ~30 km/h avg
                Stops = b.Stops.OrderBy(s => s.StopOrder).Select(s => new BusStopDto
                {
                    StopId = s.StopId, StopName = s.StopName, StopOrder = s.StopOrder,
                    StopTime = s.StopTime, Latitude = s.Latitude, Longitude = s.Longitude
                }).ToList()
            };
        }).ToList();

        return Ok(result);
    }

    // POST api/transport/routes  — create/update a bus + its stops (replace stops).
    [HttpPost("routes")]
    [RequirePermission("Transport", PermAction.Edit)]
    public async Task<IActionResult> SaveRoute([FromBody] SaveBusRouteDto dto)
    {
        Bus bus;
        if (dto.BusId == 0)
        {
            if (await _db.Buses.AnyAsync(b => b.BusNumber == dto.BusNumber))
                return BadRequest(new { message = "Bus number already exists." });
            bus = new Bus { UnitId = User.ActiveUnitId(HttpContext) };
            _db.Buses.Add(bus);
        }
        else
        {
            bus = await _db.Buses.Include(b => b.Stops).FirstOrDefaultAsync(b => b.BusId == dto.BusId)
                  ?? throw new InvalidOperationException("Bus not found");
            if (!User.InScope(HttpContext, bus.UnitId)) return Forbid();
            // don't allow shrinking below assigned students
            int assigned = await _db.BusAssignments.CountAsync(a => a.BusId == bus.BusId);
            if (dto.Capacity < assigned)
                return BadRequest(new { message = $"Capacity can't be less than {assigned} (already assigned)." });
            _db.BusStops.RemoveRange(bus.Stops);   // replace stops
        }

        bus.BusNumber = dto.BusNumber;
        bus.DriverName = dto.DriverName;
        bus.DriverPhone = dto.DriverPhone;
        bus.Capacity = dto.Capacity;
        bus.StartLocation = dto.StartLocation;
        bus.Destination = dto.Destination;
        await _db.SaveChangesAsync();

        int order = 1;
        foreach (var s in dto.Stops)
        {
            _db.BusStops.Add(new BusStop
            {
                BusId = bus.BusId, StopName = s.StopName, StopOrder = order++,
                StopTime = s.StopTime, Latitude = s.Latitude, Longitude = s.Longitude
            });
        }
        await _db.SaveChangesAsync();
        return Ok(new { bus.BusId });
    }

    // DELETE api/transport/routes/5
    [HttpDelete("routes/{id}")]
    [RequirePermission("Transport", PermAction.Delete)]
    public async Task<IActionResult> DeleteRoute(int id)
    {
        var bus = await _db.Buses.FindAsync(id);
        if (bus == null) return NotFound();
        if (!User.InScope(HttpContext, bus.UnitId)) return Forbid();

        // Safe-delete: block if students are assigned; else soft-delete (consistent with Buses).
        int assigned = await _db.BusAssignments.CountAsync(a => a.BusId == id);
        if (assigned > 0)
            return BadRequest(new { message = $"Cannot delete — {assigned} student(s) are assigned to this bus. Unassign them first." });

        bus.IsActive = false;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Student assignments ──────────────────────────────────────
    [HttpGet("assignments")]
    [RequirePermission("Transport", PermAction.View)]
    public async Task<IActionResult> GetAssignments()
    {
        var units = User.ScopeUnitIds(HttpContext);
        var list = await _db.BusAssignments
            .Where(a => a.Bus != null && a.Bus.UnitId != null && units.Contains(a.Bus.UnitId.Value))
            .Include(a => a.Student).ThenInclude(s => s!.Class)
            .Include(a => a.Bus)
            .Include(a => a.Stop)
            .OrderBy(a => a.BusId).ThenBy(a => a.Stop!.StopOrder)
            .Select(a => new BusAssignmentDto
            {
                AssignmentId = a.AssignmentId,
                StudentId = a.StudentId,
                StudentName = a.Student != null ? a.Student.FirstName + " " + a.Student.LastName : "",
                AdmissionNo = a.Student != null ? a.Student.AdmissionNo : null,
                ClassName = a.Student != null && a.Student.Class != null ? a.Student.Class.ClassName + (a.Student.Class.Stream != null ? " " + a.Student.Class.Stream : "") + " (" + a.Student.Class.Section + ")" : null,
                BusId = a.BusId, BusNumber = a.Bus != null ? a.Bus.BusNumber : "",
                StopId = a.StopId, StopName = a.Stop != null ? a.Stop.StopName : ""
            })
            .ToListAsync();
        return Ok(list);
    }

    [HttpGet("unassigned-students")]
    [RequirePermission("Transport", PermAction.View)]
    public async Task<IActionResult> Unassigned()
    {
        var units = User.ScopeUnitIds(HttpContext);
        var assignedIds = await _db.BusAssignments.Select(a => a.StudentId).ToListAsync();
        var students = await _db.Students
            .Where(s => s.IsActive && !assignedIds.Contains(s.StudentId))
            .Where(s => s.UnitId != null && units.Contains(s.UnitId.Value))
            .Include(s => s.Class)
            .OrderBy(s => s.FirstName)
            .Select(s => new { s.StudentId, name = s.FirstName + " " + s.LastName, s.AdmissionNo,
                               className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "" })
            .ToListAsync();
        return Ok(students);
    }

    [HttpPost("assignments")]
    [RequirePermission("Transport", PermAction.Edit)]
    public async Task<IActionResult> Assign([FromBody] AssignStudentDto dto)
    {
        if (await _db.BusAssignments.AnyAsync(a => a.StudentId == dto.StudentId))
            return BadRequest(new { message = "Student is already assigned to a bus." });

        var bus = await _db.Buses.Include(b => b.Assignments).FirstOrDefaultAsync(b => b.BusId == dto.BusId);
        if (bus == null) return BadRequest(new { message = "Bus not found." });
        if (!User.InScope(HttpContext, bus.UnitId)) return Forbid();

        var student = await _db.Students.FirstOrDefaultAsync(s => s.StudentId == dto.StudentId);
        if (student == null) return BadRequest(new { message = "Student not found." });
        if (!User.InScope(HttpContext, student.UnitId)) return Forbid();

        if (bus.Assignments.Count >= bus.Capacity)
            return BadRequest(new { message = "Bus is full." });

        var stopBelongs = await _db.BusStops.AnyAsync(s => s.StopId == dto.StopId && s.BusId == dto.BusId);
        if (!stopBelongs) return BadRequest(new { message = "Selected stop does not belong to this bus." });

        // BusAssignment is the single source of truth for a student's bus.
        _db.BusAssignments.Add(new BusAssignment { StudentId = dto.StudentId, BusId = dto.BusId, StopId = dto.StopId });
        await _db.SaveChangesAsync();
        return Ok(new { message = "Student assigned." });
    }

    [HttpDelete("assignments/{id}")]
    [RequirePermission("Transport", PermAction.Delete)]
    public async Task<IActionResult> Unassign(int id)
    {
        var a = await _db.BusAssignments.Include(x => x.Bus).FirstOrDefaultAsync(x => x.AssignmentId == id);
        if (a == null) return NotFound();
        if (!User.InScope(HttpContext, a.Bus != null ? a.Bus.UnitId : null)) return Forbid();

        _db.BusAssignments.Remove(a);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
