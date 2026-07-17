using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Helpers;
using school_erp.Models;

namespace school_erp.Controllers;

public record BudgetDto(int BudgetId, string Category, decimal PlannedAmount, string Period, string? Notes);

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class FinanceController : ControllerBase
{
    private readonly AppDbContext _db;
    public FinanceController(AppDbContext db) => _db = db;

    // Default suggested categories for the budget/expense dropdowns.
    // (Free-text is allowed too — this is just the starter list.)
    private static readonly string[] DEFAULT_CATEGORIES =
        { "Salary", "Rent", "Electricity", "Water", "Supplies", "Maintenance",
          "Transport", "Books / Exam", "Events", "Misc" };

    private int Uid()
    {
        int.TryParse(User.FindFirst("userId")?.Value, out int id);
        return id;
    }

    private IQueryable<Budget> Scoped()
    {
        var q = _db.Budgets.AsQueryable();
        if (!User.IsSuperAdmin())
        {
            var unit = User.UnitId();
            q = q.Where(b => b.UnitId == unit);
        }
        return q;
    }

    // ── Income (Phase 2): student fees + library fines ─────────────────
    // GET api/finance/income?year=2025-26
    // Returns class-wise fee collection + fines, plus what's still DUE from students.
    [HttpGet("income")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> Income([FromQuery] string? year)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        bool sa = User.IsSuperAdmin();
        var unit = User.UnitId();

        // ── Fees (class-wise) — collected = PaidAmount, due = Amount - Discount - PaidAmount ──
        var feesQ = _db.Fees.Where(f => !f.IsDeleted && f.AcademicYear == y);
        if (!sa) feesQ = feesQ.Where(f => f.UnitId == unit);

        var feeRows = await feesQ
            .Select(f => new
            {
                classId = f.Student != null ? f.Student.ClassId : null,
                collected = f.PaidAmount,
                due = f.Amount - f.Discount - f.PaidAmount
            })
            .ToListAsync();

        // class name lookup
        var classesQ = _db.Classes.Where(c => !c.IsDeleted);
        if (!sa) classesQ = classesQ.Where(c => c.UnitId == unit);
        var classes = await classesQ
            .Select(c => new { c.ClassId, name = c.ClassName + (c.Stream != null ? " " + c.Stream : "") + " (" + c.Section + ")" })
            .ToListAsync();
        var classMap = classes.ToDictionary(c => c.ClassId, c => c.name);

        var byClass = feeRows
            .GroupBy(r => r.classId)
            .Select(g => new
            {
                classId = g.Key,
                className = g.Key.HasValue && classMap.ContainsKey(g.Key.Value) ? classMap[g.Key.Value] : "Unassigned",
                collected = g.Sum(x => x.collected),
                due = g.Sum(x => x.due > 0 ? x.due : 0)
            })
            .OrderByDescending(x => x.collected)
            .ToList();

        var feesCollected = feeRows.Sum(r => r.collected);
        var feesDue = feeRows.Sum(r => r.due > 0 ? r.due : 0);

        // ── Library fines — a fine row is money charged on return; treat as collected income.
        // Fines don't carry a unit/year column, so scope by the student's unit and by
        // the fine's created date falling in this academic year.
        var finesQ = _db.FineDetails.AsQueryable();
        if (!sa) finesQ = finesQ.Where(f => f.Student != null && f.Student.UnitId == unit);
        var fineRows = await finesQ
            .Select(f => new { f.FineAmount, f.CreatedAt })
            .ToListAsync();
        // filter to the academic year (Apr–Mar) in memory
        var finesCollected = fineRows
            .Where(f => AcademicYearHelper.FromDate(f.CreatedAt) == y)
            .Sum(f => f.FineAmount);

        var totalIncome = feesCollected + finesCollected;

        return Ok(new
        {
            year = y,
            totalIncome,
            fees = new { collected = feesCollected, due = feesDue },
            fines = new { collected = finesCollected },
            totalDue = feesDue,                 // fees are the only thing that can be "due"
            byClass
        });
    }

    // ── Expenses (Phase 3): Yearly + Monthly ───────────────────────────
    // GET api/finance/expenses?year=&type=Monthly
    [HttpGet("expenses")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> GetExpenses([FromQuery] string? year, [FromQuery] string? type)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        var q = _db.Expenses.Where(e => e.AcademicYear == y);
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); q = q.Where(e => e.UnitId == u); }
        if (!string.IsNullOrWhiteSpace(type) && type != "All")
            q = q.Where(e => e.ExpenseType == type);

        var items = await q
            .OrderByDescending(e => e.ExpenseDate).ThenByDescending(e => e.ExpenseId)
            .Select(e => new
            {
                e.ExpenseId, e.Category, e.ExpenseType, e.Amount, e.Reason, e.PaidTo,
                e.PaymentMode, e.ImageUrl, e.IsExceptional,
                expenseDate = e.ExpenseDate.ToString("yyyy-MM-dd")
            })
            .ToListAsync();

        var total = items.Sum(e => e.Amount);

        // planned-vs-actual per category (against the matching-period budget)
        var period = type == "Yearly" ? "Yearly" : type == "Monthly" ? "Monthly" : null;
        var budgets = await Scoped().Where(b => b.AcademicYear == y).ToListAsync();
        var byCategory = items.GroupBy(e => e.Category).Select(g =>
        {
            var spent = g.Sum(x => x.Amount);
            var typeOfCat = g.First().ExpenseType;
            var planned = budgets.Where(b => b.Category == g.Key && b.Period == typeOfCat).Sum(b => b.PlannedAmount);
            return new { category = g.Key, spent, planned };
        }).OrderByDescending(x => x.spent).ToList();

        return Ok(new { year = y, total, count = items.Count, items, byCategory });
    }

    // GET api/finance/budget-for?category=Rent&type=Monthly&year=  → the planned amount (for the dropdown)
    [HttpGet("budget-for")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> BudgetFor([FromQuery] string category, [FromQuery] string type, [FromQuery] string? year)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        var period = type == "Yearly" ? "Yearly" : "Monthly";
        var b = await Scoped().FirstOrDefaultAsync(x => x.AcademicYear == y && x.Category == category && x.Period == period);
        // how much already spent this year on this category+type
        var spentQ = _db.Expenses.Where(e => e.AcademicYear == y && e.Category == category && e.ExpenseType == period);
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); spentQ = spentQ.Where(e => e.UnitId == u); }
        var spent = await spentQ.SumAsync(e => (decimal?)e.Amount) ?? 0;
        return Ok(new { planned = b?.PlannedAmount ?? 0, hasBudget = b != null, alreadySpent = spent });
    }

    // POST api/finance/expenses
    [HttpPost("expenses")]
    [RequirePermission("Finance", PermAction.Create)]
    public async Task<IActionResult> CreateExpense([FromBody] CreateExpenseDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "Category is required." });
        if (dto.Amount <= 0)
            return BadRequest(new { message = "Enter a valid amount." });
        if (!DateOnly.TryParse(dto.ExpenseDate, out var date))
            return BadRequest(new { message = "Valid date is required." });

        var type = dto.ExpenseType == "Yearly" ? "Yearly" : "Monthly";
        var exp = new Expense
        {
            Category = dto.Category.Trim(),
            ExpenseType = type,
            Amount = dto.Amount,
            Reason = dto.Reason,
            PaidTo = dto.PaidTo,
            PaymentMode = dto.PaymentMode,
            ImageUrl = dto.ImageUrl,
            IsExceptional = dto.IsExceptional,
            ExpenseDate = date,
            AcademicYear = string.IsNullOrWhiteSpace(dto.AcademicYear) ? AcademicYearHelper.FromDate(date) : dto.AcademicYear,
            CreatedBy = Uid(),
            UnitId = User.UnitId()
        };
        _db.Expenses.Add(exp);
        await _db.SaveChangesAsync();
        return Ok(new { exp.ExpenseId, message = "Expense recorded." });
    }

    // PUT api/finance/expenses/5
    [HttpPut("expenses/{id}")]
    [RequirePermission("Finance", PermAction.Edit)]
    public async Task<IActionResult> UpdateExpense(int id, [FromBody] CreateExpenseDto dto)
    {
        var q = _db.Expenses.AsQueryable();
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); q = q.Where(e => e.UnitId == u); }
        var exp = await q.FirstOrDefaultAsync(e => e.ExpenseId == id);
        if (exp == null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Category)) return BadRequest(new { message = "Category is required." });
        if (dto.Amount <= 0) return BadRequest(new { message = "Enter a valid amount." });
        if (!DateOnly.TryParse(dto.ExpenseDate, out var date)) return BadRequest(new { message = "Valid date is required." });

        exp.Category = dto.Category.Trim();
        exp.ExpenseType = dto.ExpenseType == "Yearly" ? "Yearly" : "Monthly";
        exp.Amount = dto.Amount;
        exp.Reason = dto.Reason;
        exp.PaidTo = dto.PaidTo;
        exp.PaymentMode = dto.PaymentMode;
        if (dto.ImageUrl != null) exp.ImageUrl = dto.ImageUrl;
        exp.IsExceptional = dto.IsExceptional;
        exp.ExpenseDate = date;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/finance/expenses/5
    [HttpDelete("expenses/{id}")]
    [RequirePermission("Finance", PermAction.Delete)]
    public async Task<IActionResult> DeleteExpense(int id)
    {
        var q = _db.Expenses.AsQueryable();
        if (!User.IsSuperAdmin()) { var u = User.UnitId(); q = q.Where(e => e.UnitId == u); }
        var exp = await q.FirstOrDefaultAsync(e => e.ExpenseId == id);
        if (exp == null) return NotFound();
        _db.Expenses.Remove(exp);
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // GET api/finance/summary?year=  → the profit/earn/expense headline numbers.
    [HttpGet("summary")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> Summary([FromQuery] string? year)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        bool sa = User.IsSuperAdmin();
        var unit = User.UnitId();
        var today = DateOnly.FromDateTime(DateTime.Today);

        // Earn = fees collected + fines collected (this year)
        var feesQ = _db.Fees.Where(f => !f.IsDeleted && f.AcademicYear == y);
        if (!sa) feesQ = feesQ.Where(f => f.UnitId == unit);
        var feesCollected = await feesQ.SumAsync(f => (decimal?)f.PaidAmount) ?? 0;
        var feesDue = await feesQ.SumAsync(f => (decimal?)(f.Amount - f.Discount - f.PaidAmount)) ?? 0;

        var finesQ = _db.FineDetails.AsQueryable();
        if (!sa) finesQ = finesQ.Where(f => f.Student != null && f.Student.UnitId == unit);
        var fineRows = await finesQ.Select(f => new { f.FineAmount, f.CreatedAt }).ToListAsync();
        var finesCollected = fineRows.Where(f => AcademicYearHelper.FromDate(f.CreatedAt) == y).Sum(f => f.FineAmount);

        var totalEarn = feesCollected + finesCollected;

        // Expense = yearly + monthly (this year)
        var expQ = _db.Expenses.Where(e => e.AcademicYear == y);
        if (!sa) expQ = expQ.Where(e => e.UnitId == unit);
        var expList = await expQ.Select(e => new { e.Amount, e.ExpenseType, e.ExpenseDate }).ToListAsync();
        var yearlyExpense = expList.Where(e => e.ExpenseType == "Yearly").Sum(e => e.Amount);
        var monthlyExpense = expList.Where(e => e.ExpenseType == "Monthly").Sum(e => e.Amount);
        var totalExpense = yearlyExpense + monthlyExpense;
        var todaysExpense = expList.Where(e => e.ExpenseDate == today).Sum(e => e.Amount);

        var totalProfit = totalEarn - totalExpense;

        return Ok(new
        {
            year = y,
            totalEarn,
            feesCollected, finesCollected, feesDue,
            yearlyExpense, monthlyExpense, totalExpense,
            todaysExpense,
            totalProfit
        });
    }

    // ── Reports (Phase 4): full P&L + fee defaulters ───────────────────
    // GET api/finance/report?year=&from=&to=
    // A complete profit-and-loss statement for the year (optionally date-bounded
    // for the expense side) plus the list of students who still owe fees.
    [HttpGet("report")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> Report([FromQuery] string? year, [FromQuery] string? from, [FromQuery] string? to)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        bool sa = User.IsSuperAdmin();
        var unit = User.UnitId();

        DateOnly? dFrom = DateOnly.TryParse(from, out var f) ? f : null;
        DateOnly? dTo   = DateOnly.TryParse(to, out var t) ? t : null;

        // ── Income side ──
        var feesQ = _db.Fees.Where(fe => !fe.IsDeleted && fe.AcademicYear == y);
        if (!sa) feesQ = feesQ.Where(fe => fe.UnitId == unit);
        var feesCollected = await feesQ.SumAsync(fe => (decimal?)fe.PaidAmount) ?? 0;
        var feesDue = await feesQ.SumAsync(fe => (decimal?)(fe.Amount - fe.Discount - fe.PaidAmount)) ?? 0;

        var finesQ = _db.FineDetails.AsQueryable();
        if (!sa) finesQ = finesQ.Where(fi => fi.Student != null && fi.Student.UnitId == unit);
        var fineRows = await finesQ.Select(fi => new { fi.FineAmount, fi.CreatedAt }).ToListAsync();
        var finesCollected = fineRows.Where(fi => AcademicYearHelper.FromDate(fi.CreatedAt) == y).Sum(fi => fi.FineAmount);

        var totalIncome = feesCollected + finesCollected;

        // ── Expense side (category-grouped, optional date bound) ──
        var expQ = _db.Expenses.Where(e => e.AcademicYear == y);
        if (!sa) expQ = expQ.Where(e => e.UnitId == unit);
        if (dFrom.HasValue) expQ = expQ.Where(e => e.ExpenseDate >= dFrom.Value);
        if (dTo.HasValue)   expQ = expQ.Where(e => e.ExpenseDate <= dTo.Value);
        var expRows = await expQ.Select(e => new { e.Category, e.ExpenseType, e.Amount }).ToListAsync();

        var expenseByCategory = expRows
            .GroupBy(e => new { e.Category, e.ExpenseType })
            .Select(g => new { category = g.Key.Category, type = g.Key.ExpenseType, amount = g.Sum(x => x.Amount) })
            .OrderByDescending(g => g.amount)
            .ToList();
        var yearlyExpense  = expRows.Where(e => e.ExpenseType == "Yearly").Sum(e => e.Amount);
        var monthlyExpense = expRows.Where(e => e.ExpenseType == "Monthly").Sum(e => e.Amount);
        var totalExpense = yearlyExpense + monthlyExpense;

        var netProfit = totalIncome - totalExpense;

        // ── Fee defaulters (students who still owe) ──
        var defQ = _db.Fees.Where(fe => !fe.IsDeleted && fe.AcademicYear == y
                        && (fe.Amount - fe.Discount - fe.PaidAmount) > 0);
        if (!sa) defQ = defQ.Where(fe => fe.UnitId == unit);
        var defaulters = await defQ
            .GroupBy(fe => fe.StudentId)
            .Select(g => new
            {
                studentId = g.Key,
                due = g.Sum(x => x.Amount - x.Discount - x.PaidAmount)
            })
            .ToListAsync();

        var defIds = defaulters.Select(d => d.studentId).ToList();
        var studentInfo = await _db.Students
            .Where(s => defIds.Contains(s.StudentId))
            .Select(s => new
            {
                s.StudentId,
                name = s.FirstName + " " + s.LastName,
                s.AdmissionNo,
                className = s.Class != null ? s.Class.ClassName + (s.Class.Stream != null ? " " + s.Class.Stream : "") + " (" + s.Class.Section + ")" : "",
                parentPhone = s.ParentPhone
            })
            .ToListAsync();
        var infoMap = studentInfo.ToDictionary(s => s.StudentId);

        var defaulterList = defaulters
            .Where(d => infoMap.ContainsKey(d.studentId))
            .Select(d => new
            {
                infoMap[d.studentId].name,
                infoMap[d.studentId].AdmissionNo,
                infoMap[d.studentId].className,
                infoMap[d.studentId].parentPhone,
                due = d.due
            })
            .OrderByDescending(d => d.due)
            .ToList();

        return Ok(new
        {
            year = y,
            income = new { feesCollected, finesCollected, totalIncome },
            expense = new { yearlyExpense, monthlyExpense, totalExpense, byCategory = expenseByCategory },
            netProfit,
            feesDue,
            defaulters = defaulterList
        });
    }

    // GET api/finance/categories — starter list + any categories already used in budgets.
    [HttpGet("categories")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> Categories()
    {
        var used = await Scoped().Select(b => b.Category).Distinct().ToListAsync();
        var all = DEFAULT_CATEGORIES.Concat(used)
            .Where(c => !string.IsNullOrWhiteSpace(c))
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(c => c)
            .ToList();
        return Ok(all);
    }

    // GET api/finance/budgets?year=2025-26&period=Yearly
    [HttpGet("budgets")]
    [RequirePermission("Finance", PermAction.View)]
    public async Task<IActionResult> GetBudgets([FromQuery] string? year, [FromQuery] string? period)
    {
        var y = string.IsNullOrWhiteSpace(year) ? AcademicYearHelper.Current() : year;
        var q = Scoped().Where(b => b.AcademicYear == y);
        if (!string.IsNullOrWhiteSpace(period) && period != "All")
            q = q.Where(b => b.Period == period);

        var list = await q
            .OrderBy(b => b.Period).ThenBy(b => b.Category)
            .Select(b => new
            {
                b.BudgetId, b.Category, b.PlannedAmount, b.Period, b.Notes, b.AcademicYear
            })
            .ToListAsync();

        var total = list.Sum(b => b.PlannedAmount);
        return Ok(new { year = y, totalBudget = total, count = list.Count, items = list });
    }

    // POST api/finance/budgets  — create a budget line for the selected year.
    [HttpPost("budgets")]
    [RequirePermission("Finance", PermAction.Create)]
    public async Task<IActionResult> CreateBudget([FromBody] CreateBudgetDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "Category is required." });
        if (dto.PlannedAmount < 0)
            return BadRequest(new { message = "Amount can't be negative." });

        var year = string.IsNullOrWhiteSpace(dto.AcademicYear) ? AcademicYearHelper.Current() : dto.AcademicYear;
        var period = dto.Period == "Monthly" ? "Monthly" : "Yearly";

        // one budget per (category + period + year) — avoid duplicates
        var exists = await Scoped().AnyAsync(b => b.Category == dto.Category.Trim()
            && b.Period == period && b.AcademicYear == year);
        if (exists)
            return BadRequest(new { message = $"A {period.ToLower()} budget for \"{dto.Category}\" already exists this year. Edit it instead." });

        var budget = new Budget
        {
            Category = dto.Category.Trim(),
            PlannedAmount = dto.PlannedAmount,
            Period = period,
            AcademicYear = year,
            Notes = dto.Notes,
            CreatedBy = Uid(),
            UnitId = User.UnitId()
        };
        _db.Budgets.Add(budget);
        await _db.SaveChangesAsync();
        return Ok(new { budget.BudgetId, message = "Budget saved." });
    }

    // PUT api/finance/budgets/5
    [HttpPut("budgets/{id}")]
    [RequirePermission("Finance", PermAction.Edit)]
    public async Task<IActionResult> UpdateBudget(int id, [FromBody] CreateBudgetDto dto)
    {
        var b = await Scoped().FirstOrDefaultAsync(x => x.BudgetId == id);
        if (b == null) return NotFound();
        if (string.IsNullOrWhiteSpace(dto.Category))
            return BadRequest(new { message = "Category is required." });
        if (dto.PlannedAmount < 0)
            return BadRequest(new { message = "Amount can't be negative." });

        b.Category = dto.Category.Trim();
        b.PlannedAmount = dto.PlannedAmount;
        b.Period = dto.Period == "Monthly" ? "Monthly" : "Yearly";
        b.Notes = dto.Notes;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // DELETE api/finance/budgets/5
    [HttpDelete("budgets/{id}")]
    [RequirePermission("Finance", PermAction.Delete)]
    public async Task<IActionResult> DeleteBudget(int id)
    {
        var b = await Scoped().FirstOrDefaultAsync(x => x.BudgetId == id);
        if (b == null) return NotFound();
        _db.Budgets.Remove(b);
        await _db.SaveChangesAsync();
        return NoContent();
    }
}

public record CreateBudgetDto(string Category, decimal PlannedAmount, string Period, string? AcademicYear, string? Notes);
public record CreateExpenseDto(
    string Category, string ExpenseType, decimal Amount, string? Reason, string? PaidTo,
    string? PaymentMode, string? ImageUrl, bool IsExceptional, string ExpenseDate, string? AcademicYear);
