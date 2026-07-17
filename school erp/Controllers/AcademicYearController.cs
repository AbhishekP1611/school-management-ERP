using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;

namespace school_erp.Controllers;

[ApiController]
[Route("api/academic-years")]
[Authorize]
public class AcademicYearController : ControllerBase
{
    private readonly AppDbContext _db;
    public AcademicYearController(AppDbContext db) => _db = db;

    // GET api/academic-years  — the year options for the global filter.
    // Auto-generates a window around "now" (past 3 … current … next 1) and merges
    // in any distinct years that actually exist in the data, so nothing is missed.
    [HttpGet]
    public async Task<IActionResult> GetYears()
    {
        var current = AcademicYearHelper.Current();
        int startYear = int.Parse(current.Split('-')[0]);

        var years = new HashSet<string>();
        for (int y = startYear - 3; y <= startYear + 1; y++)
            years.Add($"{y}-{(y + 1) % 100:D2}");

        // Merge distinct years present in real data (students/classes/fees).
        var fromStudents = await _db.Students.Select(s => s.AcademicYear).Distinct().ToListAsync();
        var fromClasses  = await _db.Classes.Select(c => c.AcademicYear).Distinct().ToListAsync();
        foreach (var y in fromStudents.Concat(fromClasses))
            if (!string.IsNullOrWhiteSpace(y)) years.Add(y);

        // newest first
        var ordered = years.OrderByDescending(y => y).ToList();
        return Ok(new { current, years = ordered });
    }
}
