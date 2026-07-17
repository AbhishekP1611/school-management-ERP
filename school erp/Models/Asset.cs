namespace school_erp.Models;

// A school inventory item / asset (furniture, electronics, lab equipment, sports gear, …).
// Everything about it lives here: what it is, how many, when & from whom it was bought,
// how much it cost, and how long it will last (warranty / expected life).
public class Asset
{
    public int AssetId { get; set; }
    public string AssetName { get; set; } = string.Empty;
    public string? AssetCode { get; set; }                 // optional tag/serial e.g. "PC-014"
    public string Category { get; set; } = "Other";        // Furniture / Electronics / Lab / Sports / Books / Vehicle / Stationery / Other
    public int Quantity { get; set; } = 1;
    public decimal UnitPrice { get; set; }                 // price per item
    // TotalValue = Quantity * UnitPrice (computed in queries, not stored)

    public DateOnly? PurchaseDate { get; set; }            // kab liya
    public string? Vendor { get; set; }                    // kahan se / supplier
    public string? InvoiceNo { get; set; }                 // bill number
    public string? BillImageUrl { get; set; }              // base64 bill image (optional)

    public int? WarrantyMonths { get; set; }               // warranty length in months
    public DateOnly? WarrantyUntil { get; set; }           // kab tak warranty (kab tak chalega)
    public int? LifespanYears { get; set; }                // expected usable life in years

    public string Condition { get; set; } = "Good";        // New / Good / Fair / Damaged / Disposed
    public string? Location { get; set; }                  // kahan rakha hai (room/block)
    public string? Remarks { get; set; }

    public int? UnitId { get; set; }                       // branch scope
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public bool IsDeleted { get; set; } = false;
}
