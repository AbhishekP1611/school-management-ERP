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
public class InventoryController : ControllerBase
{
    private readonly AppDbContext _db;
    public InventoryController(AppDbContext db) => _db = db;

    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.Today);

    // ── List all assets (optionally filter by category / condition / search) ──
    [HttpGet("assets")]
    [RequirePermission("Inventory", PermAction.View)]
    public async Task<IActionResult> GetAssets([FromQuery] string? category, [FromQuery] string? condition, [FromQuery] string? search)
    {
        var query = _db.Assets.Where(a => !a.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(a => a.UnitId != null && units.Contains(a.UnitId.Value));
        if (!string.IsNullOrWhiteSpace(category)) query = query.Where(a => a.Category == category);
        if (!string.IsNullOrWhiteSpace(condition)) query = query.Where(a => a.Condition == condition);
        if (!string.IsNullOrWhiteSpace(search))
            query = query.Where(a => a.AssetName.Contains(search) || (a.AssetCode != null && a.AssetCode.Contains(search)) || (a.Vendor != null && a.Vendor.Contains(search)));

        var list = await query.OrderByDescending(a => a.AssetId).ToListAsync();

        var result = list.Select(a => new AssetDto
        {
            AssetId        = a.AssetId,
            AssetName      = a.AssetName,
            AssetCode      = a.AssetCode,
            Category       = a.Category,
            Quantity       = a.Quantity,
            UnitPrice      = a.UnitPrice,
            TotalValue     = a.Quantity * a.UnitPrice,
            PurchaseDate   = a.PurchaseDate?.ToString("yyyy-MM-dd"),
            Vendor         = a.Vendor,
            InvoiceNo      = a.InvoiceNo,
            BillImageUrl   = a.BillImageUrl,
            WarrantyMonths = a.WarrantyMonths,
            WarrantyUntil  = a.WarrantyUntil?.ToString("yyyy-MM-dd"),
            LifespanYears  = a.LifespanYears,
            Condition      = a.Condition,
            Location       = a.Location,
            Remarks        = a.Remarks,
            WarrantyExpired  = a.WarrantyUntil != null && a.WarrantyUntil < Today,
            WarrantyDaysLeft = a.WarrantyUntil != null ? a.WarrantyUntil.Value.DayNumber - Today.DayNumber : (int?)null,
        }).ToList();

        return Ok(result);
    }

    // ── Summary for the stat cards ──
    [HttpGet("summary")]
    [RequirePermission("Inventory", PermAction.View)]
    public async Task<IActionResult> GetSummary()
    {
        var query = _db.Assets.Where(a => !a.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(a => a.UnitId != null && units.Contains(a.UnitId.Value));
        var list = await query.ToListAsync();

        var totalItems   = list.Sum(a => a.Quantity);
        var totalValue   = list.Sum(a => a.Quantity * a.UnitPrice);
        var categories   = list.Select(a => a.Category).Distinct().Count();
        var damaged      = list.Count(a => a.Condition == "Damaged" || a.Condition == "Disposed");
        var warrantyExpiringSoon = list.Count(a => a.WarrantyUntil != null
            && a.WarrantyUntil >= Today && a.WarrantyUntil <= Today.AddDays(30));

        var byCategory = list
            .GroupBy(a => a.Category)
            .Select(g => new { category = g.Key, count = g.Sum(x => x.Quantity), value = g.Sum(x => x.Quantity * x.UnitPrice) })
            .OrderByDescending(x => x.value)
            .ToList();

        return Ok(new
        {
            totalAssets = list.Count,
            totalItems,
            totalValue,
            categories,
            damaged,
            warrantyExpiringSoon,
            byCategory
        });
    }

    // ── Create ──
    [HttpPost("assets")]
    [RequirePermission("Inventory", PermAction.Create)]
    public async Task<IActionResult> Create([FromBody] CreateAssetDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.AssetName))
            return BadRequest(new { message = "Asset name is required." });

        var purchase = dto.PurchaseDate != null ? DateOnly.Parse(dto.PurchaseDate) : (DateOnly?)null;
        // If warranty months given but no explicit until-date, derive it from purchase date.
        DateOnly? warrantyUntil = dto.WarrantyUntil != null ? DateOnly.Parse(dto.WarrantyUntil) : null;
        if (warrantyUntil == null && dto.WarrantyMonths.HasValue && purchase.HasValue)
            warrantyUntil = purchase.Value.AddMonths(dto.WarrantyMonths.Value);

        var asset = new Asset
        {
            AssetName      = dto.AssetName,
            AssetCode      = dto.AssetCode,
            Category       = string.IsNullOrWhiteSpace(dto.Category) ? "Other" : dto.Category,
            Quantity       = dto.Quantity <= 0 ? 1 : dto.Quantity,
            UnitPrice      = dto.UnitPrice,
            PurchaseDate   = purchase,
            Vendor         = dto.Vendor,
            InvoiceNo      = dto.InvoiceNo,
            BillImageUrl   = dto.BillImageUrl,
            WarrantyMonths = dto.WarrantyMonths,
            WarrantyUntil  = warrantyUntil,
            LifespanYears  = dto.LifespanYears,
            Condition      = string.IsNullOrWhiteSpace(dto.Condition) ? "Good" : dto.Condition,
            Location       = dto.Location,
            Remarks        = dto.Remarks,
            UnitId         = User.ActiveUnitId(HttpContext)
        };
        _db.Assets.Add(asset);
        await _db.SaveChangesAsync();
        return Ok(new { asset.AssetId });
    }

    // ── Update ──
    [HttpPut("assets/{id}")]
    [RequirePermission("Inventory", PermAction.Edit)]
    public async Task<IActionResult> Update(int id, [FromBody] CreateAssetDto dto)
    {
        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.AssetId == id && !a.IsDeleted);
        if (asset == null) return NotFound();
        if (!User.InScope(HttpContext, asset.UnitId)) return Forbid();

        var purchase = dto.PurchaseDate != null ? DateOnly.Parse(dto.PurchaseDate) : (DateOnly?)null;
        DateOnly? warrantyUntil = dto.WarrantyUntil != null ? DateOnly.Parse(dto.WarrantyUntil) : null;
        if (warrantyUntil == null && dto.WarrantyMonths.HasValue && purchase.HasValue)
            warrantyUntil = purchase.Value.AddMonths(dto.WarrantyMonths.Value);

        asset.AssetName      = dto.AssetName;
        asset.AssetCode      = dto.AssetCode;
        asset.Category       = string.IsNullOrWhiteSpace(dto.Category) ? "Other" : dto.Category;
        asset.Quantity       = dto.Quantity <= 0 ? 1 : dto.Quantity;
        asset.UnitPrice      = dto.UnitPrice;
        asset.PurchaseDate   = purchase;
        asset.Vendor         = dto.Vendor;
        asset.InvoiceNo      = dto.InvoiceNo;
        asset.BillImageUrl   = dto.BillImageUrl;
        asset.WarrantyMonths = dto.WarrantyMonths;
        asset.WarrantyUntil  = warrantyUntil;
        asset.LifespanYears  = dto.LifespanYears;
        asset.Condition      = string.IsNullOrWhiteSpace(dto.Condition) ? "Good" : dto.Condition;
        asset.Location       = dto.Location;
        asset.Remarks        = dto.Remarks;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Delete (soft) ──
    [HttpDelete("assets/{id}")]
    [RequirePermission("Inventory", PermAction.Delete)]
    public async Task<IActionResult> Delete(int id)
    {
        var asset = await _db.Assets.FirstOrDefaultAsync(a => a.AssetId == id && !a.IsDeleted);
        if (asset == null) return NotFound();
        if (!User.InScope(HttpContext, asset.UnitId)) return Forbid();
        asset.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }
}
