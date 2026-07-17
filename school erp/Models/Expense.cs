namespace school_erp.Models;

// A recorded expense (money spent). ExpenseType = Yearly (once-a-year payments)
// or Monthly (regular monthly outgoings). Category links to a Budget for
// planned-vs-actual comparison.
public class Expense
{
    public int ExpenseId { get; set; }
    public string Category { get; set; } = string.Empty;   // Rent / Salary / Supplies / ...
    public string ExpenseType { get; set; } = "Monthly";    // Yearly | Monthly
    public decimal Amount { get; set; }
    public string? Reason { get; set; }                     // kahan/kis liye
    public string? PaidTo { get; set; }                     // vendor / person
    public string? PaymentMode { get; set; }                // Cash / Bank / UPI / Cheque
    public string? ImageUrl { get; set; }                   // base64 bill/receipt (optional)
    public bool IsExceptional { get; set; }                 // one-off / unplanned
    public DateOnly ExpenseDate { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public int? CreatedBy { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
