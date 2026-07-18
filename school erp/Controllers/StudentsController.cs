using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.DTOs;
using school_erp.Helpers;
using school_erp.Models;
using System.Text.RegularExpressions;

namespace school_erp.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly AppDbContext _db;

    public StudentsController(AppDbContext db) => _db = db;

    // GET  api/students/next-admission-no
    [HttpGet("next-admission-no")]
    public async Task<IActionResult> GetNextAdmissionNo()
    {
        // Find max numeric suffix from all admission numbers matching ADM####
        var allNos = await _db.Students
            .Select(s => s.AdmissionNo)
            .ToListAsync();

        int maxNum = 0;
        foreach (var no in allNos)
        {
            var match = Regex.Match(no ?? "", @"^ADM(\d+)$");
            if (match.Success && int.TryParse(match.Groups[1].Value, out int num))
                if (num > maxNum) maxNum = num;
        }

        var nextNo = $"ADM{(maxNum + 1):D4}";
        return Ok(new { nextAdmissionNo = nextNo });
    }

    // GET  api/students/next-roll-no?classId=1
    // Roll No is scoped by CLASS NAME — section & stream do NOT matter.
    // e.g. "Class 1 (A)", "Class 1 (B)", "Class 11 Science (A)" all share one sequence
    // keyed on their class name. Returns that class's highest roll no + 1 (0001, 0002, …).
    [HttpGet("next-roll-no")]
    public async Task<IActionResult> GetNextRollNo([FromQuery] int classId)
    {
        var cls = await _db.Classes.FindAsync(classId);
        if (cls == null) return BadRequest(new { message = "Class not found" });

        // Every classId that shares this class name (all sections/streams of "Class 1").
        var siblingClassIds = await _db.Classes
            .Where(c => c.ClassName == cls.ClassName && !c.IsDeleted)
            .Select(c => c.ClassId)
            .ToListAsync();

        var rollNos = await _db.Students
            .Where(s => s.ClassId != null && siblingClassIds.Contains(s.ClassId.Value)
                        && s.RollNo != null)
            .Select(s => s.RollNo)
            .ToListAsync();

        int maxSeq = 0;
        foreach (var rn in rollNos)
        {
            if (int.TryParse((rn ?? "").Trim(), out int seq) && seq > maxSeq)
                maxSeq = seq;
        }

        var nextRollNo = $"{(maxSeq + 1):D4}";   // 0001, 0002, … within this class
        return Ok(new { nextRollNo });
    }

    // GET  api/students?search=&classId=&page=&pageSize=
    // Pagination is OPTIONAL — omit page/pageSize to get the full list (dropdowns etc.).
    [HttpGet]
    [RequirePermission("Students", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] int? classId,
        [FromQuery] int? page, [FromQuery] int? pageSize, [FromQuery] string? year)
    {
        var query = _db.Students
            .Include(s => s.Class)
            .Where(s => s.IsActive)
            .AsQueryable();

        // Unit scope: user sees only the students of the units they may access.
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(s => s.UnitId != null && units.Contains(s.UnitId.Value));

        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(s =>
                s.FirstName.Contains(search) ||
                s.LastName.Contains(search)  ||
                s.AdmissionNo.Contains(search));

        if (classId.HasValue)
            query = query.Where(s => s.ClassId == classId);

        if (!string.IsNullOrWhiteSpace(year))
            query = query.Where(s => s.AcademicYear == year);

        var ordered = query.OrderBy(s => s.FirstName);

        // Apply paging only when requested
        IQueryable<Student> paged = ordered;
        int total = 0;
        bool usePaging = page.HasValue && pageSize.HasValue && page > 0 && pageSize > 0;
        if (usePaging)
        {
            total = await query.CountAsync();
            paged = ordered.Skip((page!.Value - 1) * pageSize!.Value).Take(pageSize.Value);
        }

        var students = await paged
            .Select(s => new StudentDto
            {
                StudentId     = s.StudentId,
                AdmissionNo   = s.AdmissionNo,
                RollNo        = s.RollNo,
                FirstName     = s.FirstName,
                LastName      = s.LastName,
                DateOfBirth   = s.DateOfBirth != null ? s.DateOfBirth.Value.ToString("yyyy-MM-dd") : null,
                Gender        = s.Gender,
                BloodGroup    = s.BloodGroup,
                Email         = s.Email,
                Phone         = s.Phone,
                Address       = s.Address,
                ClassId       = s.ClassId,
                ClassName     = s.Class != null ? s.Class.ClassName : null,
                Section       = s.Class != null ? s.Class.Section : null,
                ParentName    = s.ParentName,
                ParentPhone   = s.ParentPhone,
                ParentEmail   = s.ParentEmail,
                AdmissionDate = s.AdmissionDate != null ? s.AdmissionDate.Value.ToString("yyyy-MM-dd") : null,
                AcademicYear  = s.AcademicYear,
                IsActive      = s.IsActive,
                PhotoUrl      = s.PhotoUrl
            })
            .ToListAsync();

        if (usePaging)
            return Ok(new { items = students, total, page = page!.Value, pageSize = pageSize!.Value });

        return Ok(students);
    }

    // GET  api/students/5
    [HttpGet("{id}")]
    [RequirePermission("Students", PermAction.View)]
    public async Task<IActionResult> GetById(int id)
    {
        var s = await _db.Students
            .Include(x => x.Class)
            .Include(x => x.Fees)
            .Include(x => x.History)
            .FirstOrDefaultAsync(x => x.StudentId == id);

        if (s == null) return NotFound();

        // A student's bus comes from BusAssignment (single source of truth).
        var busInfo = await _db.BusAssignments
            .Where(a => a.StudentId == id)
            .Select(a => new {
                a.BusId,
                busNumber = a.Bus != null ? a.Bus.BusNumber : null,
                a.StopId,
                stopName = a.Stop != null ? a.Stop.StopName : null
            })
            .FirstOrDefaultAsync();

        return Ok(new
        {
            student = new StudentDto
            {
                StudentId     = s.StudentId,
                AdmissionNo   = s.AdmissionNo,
                RollNo        = s.RollNo,
                FirstName     = s.FirstName,
                LastName      = s.LastName,
                DateOfBirth   = s.DateOfBirth?.ToString("yyyy-MM-dd"),
                Gender        = s.Gender,
                BloodGroup    = s.BloodGroup,
                Email         = s.Email,
                Phone         = s.Phone,
                Address       = s.Address,
                ClassId       = s.ClassId,
                ClassName     = s.Class?.ClassName,
                Section       = s.Class?.Section,
                ParentName    = s.ParentName,
                ParentPhone   = s.ParentPhone,
                ParentEmail   = s.ParentEmail,
                AdmissionDate = s.AdmissionDate?.ToString("yyyy-MM-dd"),
                AcademicYear  = s.AcademicYear,
                IsActive      = s.IsActive,
                PhotoUrl      = s.PhotoUrl,
                Religion         = s.Religion,
                Category         = s.Category,
                AadharNo         = s.AadharNo,
                FatherName       = s.FatherName,
                MotherName       = s.MotherName,
                FatherOccupation = s.FatherOccupation,
                MotherOccupation = s.MotherOccupation,
                EmergencyContact = s.EmergencyContact,
                BusId            = busInfo?.BusId,
                BusNumber        = busInfo?.busNumber,
                StopId           = busInfo?.StopId,
                StopName         = busInfo?.stopName
            },
            fees = s.Fees.Where(f => !f.IsDeleted).Select(f => new FeeDto
            {
                FeeId          = f.FeeId,
                StudentId      = f.StudentId,
                FeeType        = f.FeeType,
                Amount         = f.Amount,
                Discount       = f.Discount,
                PaidAmount     = f.PaidAmount,
                BalanceAmount  = f.BalanceAmount,
                DueDate        = f.DueDate?.ToString("yyyy-MM-dd"),
                PaymentDate    = f.PaymentDate?.ToString("yyyy-MM-dd"),
                PaymentMode    = f.PaymentMode,
                TransactionRef = f.TransactionRef,
                Status         = f.Status,
                Remarks        = f.Remarks
            }),
            history = s.History.OrderByDescending(h => h.HistoryId).Select(h => new StudentHistoryDto
            {
                HistoryId     = h.HistoryId,
                StudentId     = h.StudentId,
                ClassName     = h.ClassName,
                SessionYear   = h.SessionYear,
                TotalMarks    = h.TotalMarks,
                ObtainedMarks = h.ObtainedMarks,
                Percentage    = h.Percentage,
                Result        = h.Result
            })
        });
    }

    // POST api/students
    [HttpPost]
    [RequirePermission("Students", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateStudentDto dto)
    {
        if (await _db.Students.AnyAsync(s => s.AdmissionNo == dto.AdmissionNo))
            return BadRequest(new { message = "Admission number already exists." });

        var student = new Student
        {
            AdmissionNo   = dto.AdmissionNo,
            RollNo        = dto.RollNo,
            FirstName     = dto.FirstName,
            LastName      = dto.LastName,
            DateOfBirth   = dto.DateOfBirth != null ? DateOnly.Parse(dto.DateOfBirth) : null,
            Gender        = dto.Gender,
            BloodGroup    = dto.BloodGroup,
            Email         = dto.Email,
            Phone         = dto.Phone,
            Address       = dto.Address,
            ClassId       = dto.ClassId,
            ParentName    = dto.ParentName,
            ParentPhone   = dto.ParentPhone,
            ParentEmail   = dto.ParentEmail,
            AdmissionDate = dto.AdmissionDate != null ? DateOnly.Parse(dto.AdmissionDate) : DateOnly.FromDateTime(DateTime.Today),
            AcademicYear  = !string.IsNullOrWhiteSpace(dto.AcademicYear) ? dto.AcademicYear : AcademicYearHelper.Current(),
            PhotoUrl      = dto.PhotoUrl,
            // extended fields
            Religion         = dto.Religion,
            Category         = dto.Category,
            AadharNo         = dto.AadharNo,
            FatherName       = dto.FatherName,
            MotherName       = dto.MotherName,
            FatherOccupation = dto.FatherOccupation,
            MotherOccupation = dto.MotherOccupation,
            EmergencyContact = dto.EmergencyContact,
            IsActive         = dto.IsActive,
            UnitId           = User.UnitId()   // scope the new student to the creator's unit
        };
        // (bus is set via BusAssignment in SyncBusAssignment below, not on the student)

        _db.Students.Add(student);
        await _db.SaveChangesAsync();

        // ── Save nested fees (at least one required, enforced on the client) ──
        if (dto.Fees != null)
        {
            foreach (var f in dto.Fees)
            {
                var feeDueDate     = f.DueDate != null ? DateOnly.Parse(f.DueDate) : (DateOnly?)null;
                var feePaymentDate = f.PaymentDate != null ? DateOnly.Parse(f.PaymentDate) : (DateOnly?)null;
                _db.Fees.Add(new Fee
                {
                    StudentId      = student.StudentId,
                    FeeType        = f.FeeType,
                    Amount         = f.Amount,
                    Discount       = f.Discount,
                    PaidAmount     = f.PaidAmount,
                    DueDate        = feeDueDate,
                    PaymentDate    = feePaymentDate,
                    PaymentMode    = f.PaymentMode,
                    TransactionRef = f.TransactionRef,
                    Status         = f.Status,
                    Remarks        = f.Remarks,
                    AcademicYear   = AcademicYearHelper.FromDate(feePaymentDate ?? feeDueDate ?? DateOnly.FromDateTime(DateTime.UtcNow)),
                    UnitId         = student.UnitId
                });
            }
        }

        // ── Save nested academic history (optional) ──
        if (dto.History != null)
        {
            foreach (var h in dto.History)
            {
                _db.StudentHistories.Add(new StudentHistory
                {
                    StudentId     = student.StudentId,
                    ClassName     = h.ClassName,
                    SessionYear   = h.SessionYear,
                    TotalMarks    = h.TotalMarks,
                    ObtainedMarks = h.ObtainedMarks,
                    Percentage    = h.Percentage,
                    Result        = h.Result
                });
            }
        }

        if ((dto.Fees?.Count ?? 0) > 0 || (dto.History?.Count ?? 0) > 0)
            await _db.SaveChangesAsync();

        // Sync the Transport BusAssignment with the student's chosen bus + boarding stop.
        await SyncBusAssignment(student.StudentId, dto.BusId, dto.StopId);

        // Return a flat payload (not the tracked entity) — the entity's Fees/Student
        // navigations form a cycle that breaks JSON serialization.
        return CreatedAtAction(nameof(GetById), new { id = student.StudentId }, new
        {
            student.StudentId,
            student.AdmissionNo,
            student.FirstName,
            student.LastName
        });
    }

    // Create/update/remove the student's BusAssignment from the student form (bus + stop popup).
    // BusAssignment is the single source of truth. The stop chosen in the route popup is honored;
    // if none is given (or it doesn't belong to the bus) we fall back to the bus's first stop.
    private async Task SyncBusAssignment(int studentId, int? busId, int? stopId)
    {
        var existing = await _db.BusAssignments.FirstOrDefaultAsync(a => a.StudentId == studentId);

        if (busId == null)
        {
            if (existing != null) _db.BusAssignments.Remove(existing);
            await _db.SaveChangesAsync();
            return;
        }

        // resolve the boarding stop: use the chosen stop if it belongs to this bus, else the first stop
        int? resolvedStop = null;
        if (stopId != null)
            resolvedStop = await _db.BusStops
                .Where(s => s.StopId == stopId.Value && s.BusId == busId.Value)
                .Select(s => (int?)s.StopId).FirstOrDefaultAsync();
        resolvedStop ??= await _db.BusStops.Where(s => s.BusId == busId.Value)
            .OrderBy(s => s.StopOrder).Select(s => (int?)s.StopId).FirstOrDefaultAsync();
        if (resolvedStop == null) { await _db.SaveChangesAsync(); return; }   // bus has no stops yet

        if (existing == null)
        {
            _db.BusAssignments.Add(new BusAssignment { StudentId = studentId, BusId = busId.Value, StopId = resolvedStop.Value });
        }
        else
        {
            existing.BusId = busId.Value;
            existing.StopId = resolvedStop.Value;
        }
        await _db.SaveChangesAsync();
    }

    // PUT  api/students/5
    [HttpPut("{id}")]
    [RequirePermission("Students", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateStudentDto dto)
    {
        var student = await _db.Students.FindAsync(id);
        if (student == null) return NotFound();

        student.AdmissionNo   = dto.AdmissionNo;
        student.RollNo        = dto.RollNo;
        student.FirstName     = dto.FirstName;
        student.LastName      = dto.LastName;
        student.DateOfBirth   = dto.DateOfBirth != null ? DateOnly.Parse(dto.DateOfBirth) : null;
        student.Gender        = dto.Gender;
        student.BloodGroup    = dto.BloodGroup;
        student.Email         = dto.Email;
        student.Phone         = dto.Phone;
        student.Address       = dto.Address;
        student.ClassId       = dto.ClassId;
        student.ParentName    = dto.ParentName;
        student.ParentPhone   = dto.ParentPhone;
        student.ParentEmail   = dto.ParentEmail;
        student.AdmissionDate = dto.AdmissionDate != null ? DateOnly.Parse(dto.AdmissionDate) : student.AdmissionDate;
        student.AcademicYear  = dto.AcademicYear;
        if (dto.PhotoUrl != null) student.PhotoUrl = dto.PhotoUrl;
        // extended fields
        student.Religion         = dto.Religion;
        student.Category         = dto.Category;
        student.AadharNo         = dto.AadharNo;
        student.FatherName       = dto.FatherName;
        student.MotherName       = dto.MotherName;
        student.FatherOccupation = dto.FatherOccupation;
        student.MotherOccupation = dto.MotherOccupation;
        student.EmergencyContact = dto.EmergencyContact;
        student.IsActive         = dto.IsActive;
        // bus change handled by SyncBusAssignment (BusAssignment is the source of truth)

        await _db.SaveChangesAsync();

        // Keep the Transport BusAssignment in sync with the chosen bus.
        await SyncBusAssignment(id, dto.BusId, dto.StopId);

        return NoContent();
    }

    // DELETE api/students/5  (soft delete)
    [HttpDelete("{id}")]
    [RequirePermission("Students", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var student = await _db.Students.FindAsync(id);
        if (student == null) return NotFound();

        student.IsActive = false;   // soft delete
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Academic History ─────────────────────────────────────────

    // GET api/students/5/history
    [HttpGet("{id}/history")]
    [RequirePermission("Students", PermAction.View)]
    public async Task<IActionResult> GetHistory(int id)
    {
        var rows = await _db.StudentHistories
            .Where(h => h.StudentId == id)
            .OrderByDescending(h => h.HistoryId)
            .Select(h => new StudentHistoryDto
            {
                HistoryId     = h.HistoryId,
                StudentId     = h.StudentId,
                ClassName     = h.ClassName,
                SessionYear   = h.SessionYear,
                TotalMarks    = h.TotalMarks,
                ObtainedMarks = h.ObtainedMarks,
                Percentage    = h.Percentage,
                Result        = h.Result
            })
            .ToListAsync();

        return Ok(rows);
    }

    // POST api/students/history
    [HttpPost("history")]
    [RequirePermission("Students", PermAction.Create)]
    public async Task<IActionResult> AddHistory([FromBody] CreateStudentHistoryDto dto)
    {
        var exists = await _db.Students.AnyAsync(s => s.StudentId == dto.StudentId);
        if (!exists) return BadRequest(new { message = "Student not found." });

        var row = new StudentHistory
        {
            StudentId     = dto.StudentId,
            ClassName     = dto.ClassName,
            SessionYear   = dto.SessionYear,
            TotalMarks    = dto.TotalMarks,
            ObtainedMarks = dto.ObtainedMarks,
            Percentage    = dto.Percentage,
            Result        = dto.Result
        };

        _db.StudentHistories.Add(row);
        await _db.SaveChangesAsync();
        return Ok(new StudentHistoryDto
        {
            HistoryId     = row.HistoryId,
            StudentId     = row.StudentId,
            ClassName     = row.ClassName,
            SessionYear   = row.SessionYear,
            TotalMarks    = row.TotalMarks,
            ObtainedMarks = row.ObtainedMarks,
            Percentage    = row.Percentage,
            Result        = row.Result
        });
    }

    // DELETE api/students/history/9
    [HttpDelete("history/{historyId}")]
    [RequirePermission("Students", PermAction.Delete)]
    public async Task<IActionResult> DeleteHistory(int historyId)
    {
        var row = await _db.StudentHistories.FindAsync(historyId);
        if (row == null) return NotFound();

        _db.StudentHistories.Remove(row);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
