namespace school_erp.Models;

// A planned budget for a category — "kitna socha tha". Expenses later reference the
// category and compare planned-vs-actual. Period = Yearly or Monthly.
public class Budget
{
    public int BudgetId { get; set; }
    public string Category { get; set; } = string.Empty;   // Rent / Salary / Supplies / ...
    public decimal PlannedAmount { get; set; }
    public string Period { get; set; } = "Yearly";          // Yearly | Monthly
    public string AcademicYear { get; set; } = "2025-26";
    public string? Notes { get; set; }
    public int? CreatedBy { get; set; }
    public int? UnitId { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
