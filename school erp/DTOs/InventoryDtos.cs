namespace school_erp.DTOs;

public class AssetDto
{
    public int      AssetId        { get; set; }
    public string   AssetName      { get; set; } = string.Empty;
    public string?  AssetCode      { get; set; }
    public string   Category       { get; set; } = "Other";
    public int      Quantity       { get; set; }
    public decimal  UnitPrice      { get; set; }
    public decimal  TotalValue     { get; set; }
    public string?  PurchaseDate   { get; set; }
    public string?  Vendor         { get; set; }
    public string?  InvoiceNo      { get; set; }
    public string?  BillImageUrl   { get; set; }
    public int?     WarrantyMonths { get; set; }
    public string?  WarrantyUntil  { get; set; }
    public int?     LifespanYears  { get; set; }
    public string   Condition      { get; set; } = "Good";
    public string?  Location       { get; set; }
    public string?  Remarks        { get; set; }
    public bool     WarrantyExpired { get; set; }     // computed
    public int?     WarrantyDaysLeft { get; set; }     // computed (null if no warranty date)
}

public class CreateAssetDto
{
    public string   AssetName      { get; set; } = string.Empty;
    public string?  AssetCode      { get; set; }
    public string   Category       { get; set; } = "Other";
    public int      Quantity       { get; set; } = 1;
    public decimal  UnitPrice      { get; set; }
    public string?  PurchaseDate   { get; set; }
    public string?  Vendor         { get; set; }
    public string?  InvoiceNo      { get; set; }
    public string?  BillImageUrl   { get; set; }
    public int?     WarrantyMonths { get; set; }
    public string?  WarrantyUntil  { get; set; }
    public int?     LifespanYears  { get; set; }
    public string   Condition      { get; set; } = "Good";
    public string?  Location       { get; set; }
    public string?  Remarks        { get; set; }
}
