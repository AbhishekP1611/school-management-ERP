using Microsoft.EntityFrameworkCore;
using school_erp.Models;

namespace school_erp.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User>       Users       { get; set; }
    public DbSet<Class>      Classes     { get; set; }
    public DbSet<Teacher>    Teachers    { get; set; }
    public DbSet<Student>    Students    { get; set; }
    public DbSet<Fee>        Fees        { get; set; }
    public DbSet<Attendance> Attendances { get; set; }
    public DbSet<Bus>        Buses       { get; set; }
    public DbSet<Event>      Events      { get; set; }
    public DbSet<StudentHistory> StudentHistories { get; set; }
    public DbSet<Subject>     Subjects     { get; set; }
    public DbSet<Exam>        Exams        { get; set; }
    public DbSet<ExamSubject> ExamSubjects { get; set; }
    public DbSet<Result>      Results      { get; set; }
    public DbSet<Book>        Books        { get; set; }
    public DbSet<IssuedBook>  IssuedBooks  { get; set; }
    public DbSet<FineDetail>  FineDetails  { get; set; }
    public DbSet<ModuleMaster> Modules     { get; set; }
    public DbSet<Authority>    Authorities { get; set; }
    public DbSet<UserSession>  UserSessions { get; set; }
    public DbSet<ActivityLog>  ActivityLogs { get; set; }
    public DbSet<Notice>       Notices      { get; set; }
    public DbSet<NoticeRead>   NoticeReads  { get; set; }
    public DbSet<BusStop>      BusStops     { get; set; }
    public DbSet<BusAssignment> BusAssignments { get; set; }
    public DbSet<Unit>         Units        { get; set; }
    public DbSet<Holiday>      Holidays     { get; set; }
    public DbSet<GatePass>     GatePasses   { get; set; }
    public DbSet<Budget>       Budgets      { get; set; }
    public DbSet<Expense>      Expenses     { get; set; }
    public DbSet<SupplementaryRecord> SupplementaryRecords { get; set; }
    public DbSet<Asset>        Assets       { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // ── User ──────────────────────────────────────────────
        modelBuilder.Entity<User>(e =>
        {
            e.HasKey(u => u.UserId);
            e.HasIndex(u => u.Username).IsUnique();
            e.Property(u => u.Role).HasMaxLength(20);
        });

        // ── Teacher ───────────────────────────────────────────
        modelBuilder.Entity<Teacher>(e =>
        {
            e.HasKey(t => t.TeacherId);
            e.HasIndex(t => t.EmployeeId).IsUnique();
            e.Property(t => t.Salary).HasColumnType("decimal(12,2)");
            e.HasOne(t => t.User)
             .WithOne(u => u.Teacher)
             .HasForeignKey<Teacher>(t => t.UserId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Class ─────────────────────────────────────────────
        modelBuilder.Entity<Class>(e =>
        {
            e.HasKey(c => c.ClassId);
            e.HasIndex(c => new { c.ClassName, c.Section, c.AcademicYear }).IsUnique();
            e.HasOne(c => c.ClassTeacher)
             .WithMany(t => t.Classes)
             .HasForeignKey(c => c.ClassTeacherId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Student ───────────────────────────────────────────
        modelBuilder.Entity<Student>(e =>
        {
            e.HasKey(s => s.StudentId);
            e.HasIndex(s => s.AdmissionNo).IsUnique();
            e.HasOne(s => s.User)
             .WithOne(u => u.Student)
             .HasForeignKey<Student>(s => s.UserId)
             .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(s => s.Class)
             .WithMany(c => c.Students)
             .HasForeignKey(s => s.ClassId)
             .OnDelete(DeleteBehavior.SetNull);
            // No Student→Bus FK: a student's bus lives in BusAssignment (single source).
        });

        // ── StudentHistory ────────────────────────────────────
        modelBuilder.Entity<StudentHistory>(e =>
        {
            e.HasKey(h => h.HistoryId);
            e.Property(h => h.TotalMarks).HasColumnType("decimal(6,2)");
            e.Property(h => h.ObtainedMarks).HasColumnType("decimal(6,2)");
            e.Property(h => h.Percentage).HasColumnType("decimal(5,2)");
            e.HasOne(h => h.Student)
             .WithMany(s => s.History)
             .HasForeignKey(h => h.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Subject ───────────────────────────────────────────
        modelBuilder.Entity<Subject>(e =>
        {
            e.HasKey(s => s.SubjectId);
            e.HasOne(s => s.Class)
             .WithMany()
             .HasForeignKey(s => s.ClassId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Exam ──────────────────────────────────────────────
        modelBuilder.Entity<Exam>(e =>
        {
            e.HasKey(ex => ex.ExamId);
            e.HasOne(ex => ex.Class)
             .WithMany()
             .HasForeignKey(ex => ex.ClassId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── ExamSubject ───────────────────────────────────────
        modelBuilder.Entity<ExamSubject>(e =>
        {
            e.HasKey(es => es.ExamSubjectId);
            e.Property(es => es.MaxMarks).HasColumnType("decimal(6,2)");
            e.Property(es => es.PassingMarks).HasColumnType("decimal(6,2)");
            e.HasOne(es => es.Exam)
             .WithMany(ex => ex.ExamSubjects)
             .HasForeignKey(es => es.ExamId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(es => es.Subject)
             .WithMany(s => s.ExamSubjects)
             .HasForeignKey(es => es.SubjectId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Result ────────────────────────────────────────────
        modelBuilder.Entity<Result>(e =>
        {
            e.HasKey(r => r.ResultId);
            e.Property(r => r.MarksObtained).HasColumnType("decimal(6,2)");
            e.HasOne(r => r.ExamSubject)
             .WithMany(es => es.Results)
             .HasForeignKey(r => r.ExamSubjectId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(r => r.Student)
             .WithMany()
             .HasForeignKey(r => r.StudentId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Book ──────────────────────────────────────────────
        modelBuilder.Entity<Book>(e =>
        {
            e.HasKey(b => b.BookId);
            e.Property(b => b.Price).HasColumnType("decimal(10,2)");
        });

        // ── IssuedBook ────────────────────────────────────────
        modelBuilder.Entity<IssuedBook>(e =>
        {
            e.HasKey(i => i.IssueId);
            e.HasOne(i => i.Book)
             .WithMany(b => b.IssuedBooks)
             .HasForeignKey(i => i.BookId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(i => i.Student)
             .WithMany()
             .HasForeignKey(i => i.StudentId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── FineDetail ────────────────────────────────────────
        modelBuilder.Entity<FineDetail>(e =>
        {
            e.HasKey(f => f.FineId);
            e.Property(f => f.FineAmount).HasColumnType("decimal(10,2)");
            e.HasOne(f => f.IssuedBook)
             .WithMany()
             .HasForeignKey(f => f.IssueId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(f => f.Student)
             .WithMany()
             .HasForeignKey(f => f.StudentId)
             .OnDelete(DeleteBehavior.Restrict);
            e.HasOne(f => f.Book)
             .WithMany()
             .HasForeignKey(f => f.BookId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── ModuleMaster ──────────────────────────────────────
        modelBuilder.Entity<ModuleMaster>(e =>
        {
            e.HasKey(m => m.ModuleId);
            e.HasIndex(m => m.ModuleName).IsUnique();
        });

        // ── Monitoring: sessions + activity logs ──────────────
        modelBuilder.Entity<UserSession>(e => e.HasKey(s => s.SessionId));
        modelBuilder.Entity<ActivityLog>(e => e.HasKey(a => a.LogId));

        // ── Unit ──────────────────────────────────────────────
        modelBuilder.Entity<Unit>(e => e.HasKey(u => u.UnitId));

        // ── Notices ───────────────────────────────────────────
        modelBuilder.Entity<Notice>(e => e.HasKey(n => n.NoticeId));
        modelBuilder.Entity<NoticeRead>(e =>
        {
            e.HasKey(r => r.NoticeReadId);
            e.HasIndex(r => new { r.NoticeId, r.UserId }).IsUnique();
            e.HasOne(r => r.Notice)
             .WithMany(n => n.Reads)
             .HasForeignKey(r => r.NoticeId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Authority ─────────────────────────────────────────
        modelBuilder.Entity<Authority>(e =>
        {
            e.HasKey(a => a.AuthorityId);
            e.HasIndex(a => new { a.UserId, a.ModuleId }).IsUnique();
            e.HasOne(a => a.User)
             .WithMany()
             .HasForeignKey(a => a.UserId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Module)
             .WithMany(m => m.Authorities)
             .HasForeignKey(a => a.ModuleId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── Fee ───────────────────────────────────────────────
        modelBuilder.Entity<Fee>(e =>
        {
            e.HasKey(f => f.FeeId);
            e.Property(f => f.Amount).HasColumnType("decimal(12,2)");
            e.Property(f => f.Discount).HasColumnType("decimal(12,2)");
            e.Property(f => f.PaidAmount).HasColumnType("decimal(12,2)");
            e.HasOne(f => f.Student)
             .WithMany(s => s.Fees)
             .HasForeignKey(f => f.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
            e.Ignore(f => f.BalanceAmount);
        });

        // ── Attendance ────────────────────────────────────────
        modelBuilder.Entity<Attendance>(e =>
        {
            e.ToTable("Attendance");   // DB table is singular; EF would otherwise look for "Attendances"
            e.HasKey(a => a.AttendanceId);
            e.HasIndex(a => new { a.ReferenceId, a.ReferenceType, a.AttendanceDate }).IsUnique();
            e.HasOne(a => a.MarkedByUser)
             .WithMany()
             .HasForeignKey(a => a.MarkedBy)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Bus ───────────────────────────────────────────────
        modelBuilder.Entity<Bus>(e =>
        {
            e.HasKey(b => b.BusId);
            e.HasIndex(b => b.BusNumber).IsUnique();
        });

        // ── BusStop ───────────────────────────────────────────
        modelBuilder.Entity<BusStop>(e =>
        {
            e.HasKey(s => s.StopId);
            e.HasOne(s => s.Bus)
             .WithMany(b => b.Stops)
             .HasForeignKey(s => s.BusId)
             .OnDelete(DeleteBehavior.Cascade);
        });

        // ── BusAssignment ─────────────────────────────────────
        modelBuilder.Entity<BusAssignment>(e =>
        {
            e.HasKey(a => a.AssignmentId);
            e.HasIndex(a => a.StudentId).IsUnique();   // a student rides ONE bus
            e.HasOne(a => a.Bus)
             .WithMany(b => b.Assignments)
             .HasForeignKey(a => a.BusId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Student)
             .WithMany()
             .HasForeignKey(a => a.StudentId)
             .OnDelete(DeleteBehavior.Cascade);
            e.HasOne(a => a.Stop)
             .WithMany(s => s.Assignments)
             .HasForeignKey(a => a.StopId)
             .OnDelete(DeleteBehavior.Restrict);
        });

        // ── Event ─────────────────────────────────────────────
        modelBuilder.Entity<Event>(e =>
        {
            e.HasKey(ev => ev.EventId);
            e.HasOne(ev => ev.CreatedByUser)
             .WithMany()
             .HasForeignKey(ev => ev.CreatedBy)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Holiday (school calendar) ─────────────────────────
        modelBuilder.Entity<Holiday>(e =>
        {
            e.HasKey(h => h.HolidayId);
            e.Property(h => h.Title).HasMaxLength(150);
            e.Property(h => h.HolidayType).HasMaxLength(30);
            e.Property(h => h.TargetType).HasMaxLength(20);
            e.HasIndex(h => h.Date);
            e.HasOne(h => h.TargetClass)
             .WithMany()
             .HasForeignKey(h => h.TargetClassId)
             .OnDelete(DeleteBehavior.SetNull);
        });

        // ── Budget (finance planning) ─────────────────────────
        modelBuilder.Entity<Budget>(e =>
        {
            e.HasKey(b => b.BudgetId);
            e.Property(b => b.Category).HasMaxLength(80);
            e.Property(b => b.Period).HasMaxLength(20);
            e.Property(b => b.PlannedAmount).HasColumnType("decimal(14,2)");
            e.HasIndex(b => new { b.AcademicYear, b.Category, b.Period });
        });

        // ── Expense (finance) ─────────────────────────────────
        modelBuilder.Entity<Expense>(e =>
        {
            e.HasKey(x => x.ExpenseId);
            e.Property(x => x.Category).HasMaxLength(80);
            e.Property(x => x.ExpenseType).HasMaxLength(20);
            e.Property(x => x.Amount).HasColumnType("decimal(14,2)");
            e.HasIndex(x => new { x.AcademicYear, x.ExpenseType, x.Category });
            e.HasIndex(x => x.ExpenseDate);
        });

        // ── SupplementaryRecord ───────────────────────────────
        modelBuilder.Entity<SupplementaryRecord>(e =>
        {
            e.HasKey(x => x.SupplementaryId);
            e.Property(x => x.FromClass).HasMaxLength(60);
            e.Property(x => x.AcademicYear).HasMaxLength(9);
            e.Property(x => x.Status).HasMaxLength(20);
            e.Property(x => x.MarksObtained).HasColumnType("decimal(6,2)");
            e.Property(x => x.SuppMarks).HasColumnType("decimal(6,2)");
            e.Property(x => x.PassingMarks).HasColumnType("decimal(6,2)");
            e.HasIndex(x => new { x.StudentId, x.AcademicYear });
            e.HasOne(x => x.Student).WithMany().HasForeignKey(x => x.StudentId).OnDelete(DeleteBehavior.Cascade);
        });

        // ── GatePass (gate management) ────────────────────────
        modelBuilder.Entity<GatePass>(e =>
        {
            e.HasKey(g => g.GatePassId);
            e.Ignore(g => g.IsInside);
            e.Property(g => g.PersonType).HasMaxLength(20);
            e.Property(g => g.Name).HasMaxLength(120);
            e.HasIndex(g => g.EntryAt);
            e.HasIndex(g => g.ExitAt);
            e.HasOne(g => g.Student)
             .WithMany()
             .HasForeignKey(g => g.StudentId)
             .OnDelete(DeleteBehavior.SetNull);
            e.HasOne(g => g.Teacher)
             .WithMany()
             .HasForeignKey(g => g.TeacherId)
             .OnDelete(DeleteBehavior.SetNull);
        });
    }
}
