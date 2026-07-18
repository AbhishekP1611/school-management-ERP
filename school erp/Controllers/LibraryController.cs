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
public class LibraryController : ControllerBase
{
    private readonly AppDbContext _db;
    public LibraryController(AppDbContext db) => _db = db;

    private static readonly DateOnly Today = DateOnly.FromDateTime(DateTime.Today);

    // ── Books inventory ──────────────────────────────────────────
    [HttpGet("books")]
    [RequirePermission("Library", PermAction.View)]
    public async Task<IActionResult> GetBooks()
    {
        var query = _db.Books.Where(b => !b.IsDeleted);
        var units = User.ScopeUnitIds(HttpContext);
        query = query.Where(b => b.UnitId != null && units.Contains(b.UnitId.Value));

        var list = await query
            .OrderBy(b => b.BookName)
            .Select(b => new BookDto
            {
                BookId      = b.BookId,
                BookName    = b.BookName,
                Author      = b.Author,
                Price       = b.Price,
                IsAvailable = b.IsAvailable,
                UsableUntil = b.UsableUntil != null ? b.UsableUntil.Value.ToString("yyyy-MM-dd") : null
            }).ToListAsync();
        return Ok(list);
    }

    [HttpPost("books")]
    [RequirePermission("Library", PermAction.Create)]
    public async Task<IActionResult> CreateBook([FromBody] CreateBookDto dto)
    {
        if (string.IsNullOrWhiteSpace(dto.BookName))
            return BadRequest(new { message = "Book name is required." });

        var book = new Book
        {
            BookName    = dto.BookName,
            Author      = dto.Author,
            Price       = dto.Price,
            UsableUntil = dto.UsableUntil != null ? DateOnly.Parse(dto.UsableUntil) : null,
            UnitId      = User.UnitId()
        };
        _db.Books.Add(book);
        await _db.SaveChangesAsync();
        return Ok(new { book.BookId });
    }

    [HttpPut("books/{id}")]
    [RequirePermission("Library", PermAction.Edit)]
    public async Task<IActionResult> UpdateBook(int id, [FromBody] CreateBookDto dto)
    {
        var book = await _db.Books.FindAsync(id);
        if (book == null) return NotFound();
        book.BookName    = dto.BookName;
        book.Author      = dto.Author;
        book.Price       = dto.Price;
        book.UsableUntil = dto.UsableUntil != null ? DateOnly.Parse(dto.UsableUntil) : null;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("books/{id}")]
    [RequirePermission("Library", PermAction.Delete)]
    public async Task<IActionResult> DeleteBook(int id)
    {
        var book = await _db.Books.FindAsync(id);
        if (book == null) return NotFound();
        // block if currently issued (not returned)
        if (await _db.IssuedBooks.AnyAsync(i => i.BookId == id && i.ReturnDate == null))
            return BadRequest(new { message = "Cannot delete — the book is currently issued." });
        book.IsDeleted = true;
        await _db.SaveChangesAsync();
        return NoContent();
    }

    // ── Issued books (active loans) ──────────────────────────────
    [HttpGet("issued")]
    [RequirePermission("Library", PermAction.View)]
    public async Task<IActionResult> GetIssued()
    {
        var list = await _db.IssuedBooks
            .Where(i => i.ReturnDate == null)
            .Include(i => i.Book)
            .Include(i => i.Student)
            .OrderByDescending(i => i.IssueId)
            .ToListAsync();

        var result = list.Select(i => new IssuedBookDto
        {
            IssueId     = i.IssueId,
            BookId      = i.BookId,
            BookName    = i.Book?.BookName,
            StudentId   = i.StudentId,
            StudentName = i.Student != null ? $"{i.Student.FirstName} {i.Student.LastName}" : null,
            AdmissionNo = i.Student?.AdmissionNo,
            IssueDate   = i.IssueDate.ToString("yyyy-MM-dd"),
            DueDate     = i.DueDate.ToString("yyyy-MM-dd"),
            DaysOverdue = Math.Max(0, Today.DayNumber - i.DueDate.DayNumber)
        }).ToList();
        return Ok(result);
    }

    // POST api/library/issue
    [HttpPost("issue")]
    [RequirePermission("Library", PermAction.Edit)]
    public async Task<IActionResult> Issue([FromBody] IssueBookDto dto)
    {
        var book = await _db.Books.FindAsync(dto.BookId);
        if (book == null || book.IsDeleted) return BadRequest(new { message = "Book not found." });
        if (!book.IsAvailable) return BadRequest(new { message = "Book is not available." });
        if (book.UsableUntil != null && book.UsableUntil < Today)
            return BadRequest(new { message = "Book has passed its usable date and cannot be issued." });

        var issue = new IssuedBook
        {
            BookId    = dto.BookId,
            StudentId = dto.StudentId,
            IssueDate = Today,
            DueDate   = dto.DueDate != null ? DateOnly.Parse(dto.DueDate) : Today.AddDays(7)
        };
        book.IsAvailable = false;
        _db.IssuedBooks.Add(issue);
        await _db.SaveChangesAsync();
        return Ok(new { issue.IssueId });
    }

    // POST api/library/collect  — return + optional fine
    [HttpPost("collect")]
    [RequirePermission("Library", PermAction.Edit)]
    public async Task<IActionResult> Collect([FromBody] CollectBookDto dto)
    {
        var issue = await _db.IssuedBooks.Include(i => i.Book).FirstOrDefaultAsync(i => i.IssueId == dto.IssueId);
        if (issue == null) return NotFound();
        if (issue.ReturnDate != null) return BadRequest(new { message = "Already returned." });

        issue.ReturnDate = Today;
        if (issue.Book != null) issue.Book.IsAvailable = true;

        if (dto.FineAmount > 0)
        {
            _db.FineDetails.Add(new FineDetail
            {
                IssueId    = issue.IssueId,
                StudentId  = issue.StudentId,
                BookId     = issue.BookId,
                FineAmount = dto.FineAmount,
                Remarks    = dto.Remarks ?? "Late return fine"
            });
        }
        await _db.SaveChangesAsync();
        return Ok(new { message = "Book returned." });
    }

    // ── Fines ────────────────────────────────────────────────────
    [HttpGet("fines")]
    [RequirePermission("Library", PermAction.View)]
    public async Task<IActionResult> GetFines()
    {
        var list = await _db.FineDetails
            .Include(f => f.Book)
            .Include(f => f.Student)
            .OrderByDescending(f => f.FineId)
            .ToListAsync();

        var result = list.Select(f => new FineDto
        {
            FineId      = f.FineId,
            StudentId   = f.StudentId,
            StudentName = f.Student != null ? $"{f.Student.FirstName} {f.Student.LastName}" : null,
            BookName    = f.Book?.BookName,
            FineAmount  = f.FineAmount,
            Remarks     = f.Remarks,
            Date        = f.CreatedAt.ToString("yyyy-MM-dd")
        }).ToList();
        return Ok(result);
    }
}
