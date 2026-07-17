namespace school_erp.Models;

public class Fee
{
    public int FeeId { get; set; }
    public int StudentId { get; set; }
    public string FeeType { get; set; } = string.Empty;
    public decimal Amount { get; set; }
    public decimal Discount { get; set; }
    public decimal PaidAmount { get; set; }
    public DateOnly? DueDate { get; set; }
    public DateOnly? PaymentDate { get; set; }
    public string? PaymentMode { get; set; }
    public string? TransactionRef { get; set; }
    public string Status { get; set; } = "Pending";
    public string? Remarks { get; set; }
    public bool IsDeleted { get; set; } = false;
    public int? UnitId { get; set; }
    public string AcademicYear { get; set; } = "2025-26";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation
    public Student? Student { get; set; }

    public decimal BalanceAmount => Amount - Discount - PaidAmount;
}
