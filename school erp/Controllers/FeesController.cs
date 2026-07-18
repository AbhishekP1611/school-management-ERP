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
public class FeesController : ControllerBase
{
    private readonly AppDbContext _db;

    public FeesController(AppDbContext db) => _db = db;

    [HttpGet]
    [RequirePermission("Fees", PermAction.View)]
    public async Task<IActionResult> GetAll([FromQuery] int? studentId, [FromQuery] string? status, [FromQuery] string? year)
    {
        var query = _db.Fees.Include(f => f.Student)
            .Where(f => !f.IsDeleted && f.Student != null && f.Student.IsActive)
            .AsQueryable();
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(f => f.UnitId != null && units.Contains(f.UnitId.Value));
        if (studentId.HasValue) query = query.Where(f => f.StudentId == studentId.Value);
        if (!string.IsNullOrWhiteSpace(status)) query = query.Where(f => f.Status == status);
        if (!string.IsNullOrWhiteSpace(year)) query = query.Where(f => f.AcademicYear == year);

        var list = await query.OrderByDescending(f => f.CreatedAt)
            .Select(f => new FeeDto
            {
                FeeId          = f.FeeId,
                StudentId      = f.StudentId,
                StudentName    = f.Student != null ? f.Student.FirstName + " " + f.Student.LastName : null,
                FeeType        = f.FeeType,
                Amount         = f.Amount,
                Discount       = f.Discount,
                PaidAmount     = f.PaidAmount,
                BalanceAmount  = f.Amount - f.Discount - f.PaidAmount,
                DueDate        = f.DueDate != null ? f.DueDate.Value.ToString("yyyy-MM-dd") : null,
                PaymentDate    = f.PaymentDate != null ? f.PaymentDate.Value.ToString("yyyy-MM-dd") : null,
                PaymentMode    = f.PaymentMode,
                TransactionRef = f.TransactionRef,
                Status         = f.Status,
                Remarks        = f.Remarks
            }).ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    [RequirePermission("Fees", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateFeeDto dto)
    {
        var dueDate     = dto.DueDate != null ? DateOnly.Parse(dto.DueDate) : (DateOnly?)null;
        var paymentDate = dto.PaymentDate != null ? DateOnly.Parse(dto.PaymentDate) : (DateOnly?)null;

        var fee = new Fee
        {
            StudentId      = dto.StudentId,
            FeeType        = dto.FeeType,
            Amount         = dto.Amount,
            Discount       = dto.Discount,
            PaidAmount     = dto.PaidAmount,
            DueDate        = dueDate,
            PaymentDate    = paymentDate,
            PaymentMode    = dto.PaymentMode,
            TransactionRef = dto.TransactionRef,
            Status         = dto.Status,
            Remarks        = dto.Remarks,
            AcademicYear   = AcademicYearHelper.FromDate(paymentDate ?? dueDate ?? DateOnly.FromDateTime(DateTime.UtcNow)),
            UnitId         = User.UnitId()
        };

        _db.Fees.Add(fee);
        await _db.SaveChangesAsync();
        return Ok(fee);
    }

    [HttpPut("{id}")]
    [RequirePermission("Fees", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateFeeDto dto)
    {
        var fee = await _db.Fees.FindAsync(id);
        if (fee == null) return NotFound();

        fee.FeeType        = dto.FeeType;
        fee.Amount         = dto.Amount;
        fee.Discount       = dto.Discount;
        fee.PaidAmount     = dto.PaidAmount;
        fee.DueDate        = dto.DueDate != null ? DateOnly.Parse(dto.DueDate) : null;
        fee.PaymentDate    = dto.PaymentDate != null ? DateOnly.Parse(dto.PaymentDate) : null;
        // Recompute academic year from the (possibly changed) payment/due date.
        fee.AcademicYear   = AcademicYearHelper.FromDate(fee.PaymentDate ?? fee.DueDate ?? DateOnly.FromDateTime(DateTime.UtcNow));
        fee.PaymentMode    = dto.PaymentMode;
        fee.TransactionRef = dto.TransactionRef;
        fee.Status         = dto.Status;
        fee.Remarks        = dto.Remarks;

        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    [RequirePermission("Fees", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var fee = await _db.Fees.FindAsync(id);
        if (fee == null) return NotFound();
        fee.IsDeleted = true;   // soft delete — financial record stays safe
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
