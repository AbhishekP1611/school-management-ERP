using Microsoft.EntityFrameworkCore;
using school_erp.Data;
using school_erp.Models;

namespace school_erp.Data;

public static class DbSeeder
{
    public static async Task SeedAsync(AppDbContext db)
    {
        // Schema is already built using the SQL Server script

        // Holidays table is newer than the base script — create it if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Holidays')
BEGIN
    CREATE TABLE Holidays (
        HolidayId     INT IDENTITY(1,1) PRIMARY KEY,
        Title         NVARCHAR(150) NOT NULL,
        [Date]        DATE NOT NULL,
        EndDate       DATE NULL,
        Description   NVARCHAR(MAX) NULL,
        HolidayType   NVARCHAR(30) NOT NULL DEFAULT 'Holiday',
        IsEmergency   BIT NOT NULL DEFAULT 0,
        TargetType    NVARCHAR(20) NOT NULL DEFAULT 'All',
        TargetClassId INT NULL,
        EmailSent     BIT NOT NULL DEFAULT 0,
        EmailCount    INT NOT NULL DEFAULT 0,
        CreatedBy     INT NULL,
        UnitId        INT NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Holidays_Date ON Holidays([Date]);
END");

        // GatePass table (gate management) — create if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'GatePasses')
BEGIN
    CREATE TABLE GatePasses (
        GatePassId    INT IDENTITY(1,1) PRIMARY KEY,
        PersonType    NVARCHAR(20) NOT NULL DEFAULT 'Visitor',
        PassNo        NVARCHAR(30) NULL,
        Name          NVARCHAR(120) NOT NULL,
        Phone         NVARCHAR(20) NULL,
        PhotoUrl      NVARCHAR(MAX) NULL,
        StudentId     INT NULL,
        TeacherId     INT NULL,
        ReferenceNo   NVARCHAR(60) NULL,
        WhomToMeet    NVARCHAR(120) NULL,
        Purpose       NVARCHAR(60) NULL,
        Reason        NVARCHAR(120) NULL,
        ApprovedBy    NVARCHAR(120) NULL,
        EntryAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        ExitAt        DATETIME2 NULL,
        Remarks       NVARCHAR(MAX) NULL,
        RecordedBy    INT NULL,
        UnitId        INT NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_GatePasses_EntryAt ON GatePasses(EntryAt);
    CREATE INDEX IX_GatePasses_ExitAt ON GatePasses(ExitAt);
END");

        // Budgets table (finance planning) — create if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Budgets')
BEGIN
    CREATE TABLE Budgets (
        BudgetId      INT IDENTITY(1,1) PRIMARY KEY,
        Category      NVARCHAR(80) NOT NULL,
        PlannedAmount DECIMAL(14,2) NOT NULL DEFAULT 0,
        Period        NVARCHAR(20) NOT NULL DEFAULT 'Yearly',
        AcademicYear  NVARCHAR(9) NOT NULL DEFAULT '2025-26',
        Notes         NVARCHAR(MAX) NULL,
        CreatedBy     INT NULL,
        UnitId        INT NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Budgets_Year ON Budgets(AcademicYear, Category, Period);
END");

        // Expenses table (finance) — create if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Expenses')
BEGIN
    CREATE TABLE Expenses (
        ExpenseId     INT IDENTITY(1,1) PRIMARY KEY,
        Category      NVARCHAR(80) NOT NULL,
        ExpenseType   NVARCHAR(20) NOT NULL DEFAULT 'Monthly',
        Amount        DECIMAL(14,2) NOT NULL DEFAULT 0,
        Reason        NVARCHAR(MAX) NULL,
        PaidTo        NVARCHAR(120) NULL,
        PaymentMode   NVARCHAR(30) NULL,
        ImageUrl      NVARCHAR(MAX) NULL,
        IsExceptional BIT NOT NULL DEFAULT 0,
        ExpenseDate   DATE NOT NULL,
        AcademicYear  NVARCHAR(9) NOT NULL DEFAULT '2025-26',
        CreatedBy     INT NULL,
        UnitId        INT NULL,
        CreatedAt     DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Expenses_Year ON Expenses(AcademicYear, ExpenseType, Category);
    CREATE INDEX IX_Expenses_Date ON Expenses(ExpenseDate);
END");

        // Users.EmailNotifications — per-user email opt-in (added later than the base script).
        await db.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Users','EmailNotifications') IS NULL
BEGIN
    ALTER TABLE Users ADD EmailNotifications BIT NOT NULL DEFAULT 1;
END");

        // UserSessions.DeviceId — single-session enforcement (device fingerprint).
        await db.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('UserSessions','DeviceId') IS NULL
    ALTER TABLE UserSessions ADD DeviceId NVARCHAR(80) NULL;");

        // Student promotion-tracking columns (year-end promotion feature).
        await db.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Students','PromotionStatus') IS NULL
    ALTER TABLE Students ADD PromotionStatus NVARCHAR(30) NULL;
IF COL_LENGTH('Students','ExitReason') IS NULL
    ALTER TABLE Students ADD ExitReason NVARCHAR(30) NULL;");

        // SupplementaryRecords table — create if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'SupplementaryRecords')
BEGIN
    CREATE TABLE SupplementaryRecords (
        SupplementaryId INT IDENTITY(1,1) PRIMARY KEY,
        StudentId       INT NOT NULL,
        SubjectId       INT NULL,
        SubjectName     NVARCHAR(120) NULL,
        FromClass       NVARCHAR(60) NOT NULL DEFAULT '',
        AcademicYear    NVARCHAR(9) NOT NULL DEFAULT '',
        MarksObtained   DECIMAL(6,2) NULL,
        SuppMarks       DECIMAL(6,2) NULL,
        PassingMarks    DECIMAL(6,2) NULL,
        Status          NVARCHAR(20) NOT NULL DEFAULT 'Pending',
        Remarks         NVARCHAR(MAX) NULL,
        MarkedBy        INT NULL,
        DecidedAt       DATETIME2 NULL,
        UnitId          INT NULL,
        CreatedAt       DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX IX_Supp_Student ON SupplementaryRecords(StudentId, AcademicYear);
END
-- add SuppMarks if the table pre-existed without it
IF COL_LENGTH('SupplementaryRecords','SuppMarks') IS NULL
    ALTER TABLE SupplementaryRecords ADD SuppMarks DECIMAL(6,2) NULL;");

        // Assets table (Inventory module) — create if missing (idempotent).
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Assets')
BEGIN
    CREATE TABLE Assets (
        AssetId        INT IDENTITY(1,1) PRIMARY KEY,
        AssetName      NVARCHAR(160) NOT NULL,
        AssetCode      NVARCHAR(60) NULL,
        Category       NVARCHAR(40) NOT NULL DEFAULT 'Other',
        Quantity       INT NOT NULL DEFAULT 1,
        UnitPrice      DECIMAL(12,2) NOT NULL DEFAULT 0,
        PurchaseDate   DATE NULL,
        Vendor         NVARCHAR(160) NULL,
        InvoiceNo      NVARCHAR(80) NULL,
        BillImageUrl   NVARCHAR(MAX) NULL,
        WarrantyMonths INT NULL,
        WarrantyUntil  DATE NULL,
        LifespanYears  INT NULL,
        Condition      NVARCHAR(20) NOT NULL DEFAULT 'Good',
        Location       NVARCHAR(120) NULL,
        Remarks        NVARCHAR(MAX) NULL,
        UnitId         INT NULL,
        CreatedAt      DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        IsDeleted      BIT NOT NULL DEFAULT 0
    );
    CREATE INDEX IX_Assets_Category ON Assets(Category);
END");

        // UserUnits — which units each user may access (multi-unit). Create if missing.
        await db.Database.ExecuteSqlRawAsync(@"
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserUnits')
BEGIN
    CREATE TABLE UserUnits (
        UserUnitId INT IDENTITY(1,1) PRIMARY KEY,
        UserId     INT NOT NULL,
        UnitId     INT NOT NULL
    );
    CREATE UNIQUE INDEX IX_UserUnits_User_Unit ON UserUnits(UserId, UnitId);
END");

        // Backfill: every existing user with a home unit but no access rows gets
        // a UserUnits row for that unit, so multi-unit scoping keeps working for them.
        await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO UserUnits (UserId, UnitId)
SELECT u.UserId, u.UnitId
FROM Users u
WHERE u.UnitId IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM UserUnits uu WHERE uu.UserId = u.UserId AND uu.UnitId = u.UnitId);");

        // Academic-year columns (added later than the base script). Add if missing,
        // then backfill existing rows from their most relevant date (April–March rule).
        await db.Database.ExecuteSqlRawAsync(@"
-- Fees.AcademicYear
IF COL_LENGTH('Fees','AcademicYear') IS NULL
BEGIN
    ALTER TABLE Fees ADD AcademicYear NVARCHAR(9) NOT NULL DEFAULT '2025-26';
END
-- Exams.AcademicYear
IF COL_LENGTH('Exams','AcademicYear') IS NULL
BEGIN
    ALTER TABLE Exams ADD AcademicYear NVARCHAR(9) NOT NULL DEFAULT '2025-26';
END
-- Attendance.AcademicYear (table is singular)
IF COL_LENGTH('Attendance','AcademicYear') IS NULL
BEGIN
    ALTER TABLE Attendance ADD AcademicYear NVARCHAR(9) NOT NULL DEFAULT '2025-26';
END");

        // Backfill: derive academic year (Apr→Mar) from each row's date. Runs once
        // per row-set; cheap and idempotent (only rewrites the computed value).
        await db.Database.ExecuteSqlRawAsync(@"
-- Fees: prefer PaymentDate, else DueDate, else CreatedAt
UPDATE Fees SET AcademicYear =
    CAST(CASE WHEN MONTH(d) >= 4 THEN YEAR(d) ELSE YEAR(d)-1 END AS VARCHAR(4)) + '-' +
    RIGHT('0' + CAST((CASE WHEN MONTH(d) >= 4 THEN YEAR(d) ELSE YEAR(d)-1 END + 1) % 100 AS VARCHAR(2)), 2)
FROM (SELECT FeeId, COALESCE(PaymentDate, DueDate, CAST(CreatedAt AS DATE)) AS d FROM Fees) x
WHERE Fees.FeeId = x.FeeId AND x.d IS NOT NULL;

-- Attendance: by AttendanceDate
UPDATE Attendance SET AcademicYear =
    CAST(CASE WHEN MONTH(AttendanceDate) >= 4 THEN YEAR(AttendanceDate) ELSE YEAR(AttendanceDate)-1 END AS VARCHAR(4)) + '-' +
    RIGHT('0' + CAST((CASE WHEN MONTH(AttendanceDate) >= 4 THEN YEAR(AttendanceDate) ELSE YEAR(AttendanceDate)-1 END + 1) % 100 AS VARCHAR(2)), 2);

-- Exams: by CreatedAt
UPDATE Exams SET AcademicYear =
    CAST(CASE WHEN MONTH(CreatedAt) >= 4 THEN YEAR(CreatedAt) ELSE YEAR(CreatedAt)-1 END AS VARCHAR(4)) + '-' +
    RIGHT('0' + CAST((CASE WHEN MONTH(CreatedAt) >= 4 THEN YEAR(CreatedAt) ELSE YEAR(CreatedAt)-1 END + 1) % 100 AS VARCHAR(2)), 2);");

        // Modules table now drives the sidebar/nav: add DisplayName/Route/Icon/SortOrder/IsActive.
        await db.Database.ExecuteSqlRawAsync(@"
IF COL_LENGTH('Modules','DisplayName') IS NULL ALTER TABLE Modules ADD DisplayName NVARCHAR(80) NULL;
IF COL_LENGTH('Modules','Route')       IS NULL ALTER TABLE Modules ADD Route       NVARCHAR(120) NULL;
IF COL_LENGTH('Modules','Icon')        IS NULL ALTER TABLE Modules ADD Icon        NVARCHAR(60) NULL;
IF COL_LENGTH('Modules','SortOrder')   IS NULL ALTER TABLE Modules ADD SortOrder   INT NOT NULL DEFAULT 0;
IF COL_LENGTH('Modules','IsActive')    IS NULL ALTER TABLE Modules ADD IsActive    BIT NOT NULL DEFAULT 1;");

        // Backfill nav metadata for the known modules (only fills rows still missing a Route,
        // so admin edits made later from the Modules window are never overwritten).
        await db.Database.ExecuteSqlRawAsync(@"
UPDATE Modules SET DisplayName = d.dn, Route = d.rt, Icon = d.ic, SortOrder = d.so
FROM Modules m
JOIN (VALUES
    ('Dashboard','Dashboard','/dashboard','LayoutDashboard',10),
    ('Units','Units','/units','Building2',20),
    ('Students','Students','/students','Users',30),
    ('Teachers','Teachers','/teachers','UserSquare2',40),
    ('Classes','Classes','/classes','BookOpen',50),
    ('Academics','Exams & Results','/academics','Award',60),
    ('Promotion','Promotion','/promotion','ArrowUpCircle',70),
    ('Library','Library','/library','Library',80),
    ('Finance','Finance','/finance','Wallet',90),
    ('Attendance','Attendance','/attendance','CalendarCheck',100),
    ('Transport','Transport','/transport','Bus',110),
    ('Gate','Gate Management','/gate','DoorOpen',120),
    ('Events','Events','/events','CalendarDays',130),
    ('Notices','Send Notice','/notices','Megaphone',140),
    ('Inventory','Inventory & Assets','/inventory','Boxes',115),
    ('Users','Users & Access','/users','ShieldCheck',150),
    ('Monitor','Activity Monitor','/monitor','Activity',160)
) AS d(name, dn, rt, ic, so) ON m.ModuleName = d.name
WHERE m.Route IS NULL;

-- Modules that exist for permissions but are not primary nav items (no sidebar route):
-- keep them inactive-in-nav but still permissionable (Fees, Calendar, StudentLookup).
UPDATE Modules SET SortOrder = 900, IsActive = 0
WHERE Route IS NULL AND ModuleName IN ('Fees','Calendar','StudentLookup');");

        // Grant every existing user-manager (anyone with Users:Edit) full access to any
        // module that has NO authority rows yet — so a newly-added module (e.g. Inventory)
        // is immediately visible to admins instead of being invisible to everyone.
        await db.Database.ExecuteSqlRawAsync(@"
INSERT INTO Authorities (UserId, ModuleId, CanView, CanCreate, CanEdit, CanDelete)
SELECT DISTINCT a.UserId, m.ModuleId, 1, 1, 1, 1
FROM Modules m
CROSS JOIN (
    SELECT DISTINCT au.UserId
    FROM Authorities au
    JOIN Modules um ON au.ModuleId = um.ModuleId
    WHERE um.ModuleName = 'Users' AND au.CanEdit = 1
) a
WHERE NOT EXISTS (
    SELECT 1 FROM Authorities x WHERE x.UserId = a.UserId AND x.ModuleId = m.ModuleId
);");


        var existingAdmin = await db.Users.FirstOrDefaultAsync(u => u.Username == "admin");
        if (existingAdmin != null && existingAdmin.PasswordHash.Contains("PLACEHOLDER"))
        {
            existingAdmin.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123");
            var existingTeacher = await db.Users.FirstOrDefaultAsync(u => u.Username == "teacher1");
            if (existingTeacher != null) existingTeacher.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Teacher@123");
            var existingStudent = await db.Users.FirstOrDefaultAsync(u => u.Username == "student1");
            if (existingStudent != null) existingStudent.PasswordHash = BCrypt.Net.BCrypt.HashPassword("Student@123");
            await db.SaveChangesAsync();
        }

        // Only seed if no users exist
        if (await db.Users.AnyAsync()) return;

        // Seed Users with real BCrypt hashes (password: Admin@123 / Teacher@123 / Student@123)
        var admin = new User
        {
            Username     = "admin",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin@123"),
            Role         = "Admin",
            Email        = "admin@schoolerp.com"
        };
        var teacher1 = new User
        {
            Username     = "teacher1",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Teacher@123"),
            Role         = "Teacher",
            Email        = "teacher1@schoolerp.com"
        };
        var student1 = new User
        {
            Username     = "student1",
            PasswordHash = BCrypt.Net.BCrypt.HashPassword("Student@123"),
            Role         = "Student",
            Email        = "student1@schoolerp.com"
        };

        db.Users.AddRange(admin, teacher1, student1);
        await db.SaveChangesAsync();

        // Seed Classes
        var classes = new List<school_erp.Models.Class>
        {
            new() { ClassName = "Class 1",  Section = "A", AcademicYear = "2025-26" },
            new() { ClassName = "Class 1",  Section = "B", AcademicYear = "2025-26" },
            new() { ClassName = "Class 5",  Section = "A", AcademicYear = "2025-26" },
            new() { ClassName = "Class 10", Section = "A", AcademicYear = "2025-26" },
            new() { ClassName = "Class 12", Section = "Science", AcademicYear = "2025-26" },
        };
        db.Classes.AddRange(classes);
        await db.SaveChangesAsync();

        // Seed Teachers
        var teachers = new List<Teacher>
        {
            new() { UserId = teacher1.UserId, EmployeeId = "EMP001", FirstName = "Ramesh", LastName = "Sharma",
                    Email = "teacher1@schoolerp.com", Phone = "9876543210", Designation = "Senior Teacher",
                    Specialization = "Mathematics", Salary = 45000, DateOfJoining = new DateOnly(2020,6,1), Gender = "Male" },
            new() { EmployeeId = "EMP002", FirstName = "Priya", LastName = "Verma",
                    Email = "priya@schoolerp.com", Phone = "9876543211", Designation = "Teacher",
                    Specialization = "Science", Salary = 38000, DateOfJoining = new DateOnly(2021,7,15), Gender = "Female" },
            new() { EmployeeId = "EMP003", FirstName = "Anil", LastName = "Kumar",
                    Email = "anil@schoolerp.com", Phone = "9876543212", Designation = "Teacher",
                    Specialization = "English", Salary = 36000, DateOfJoining = new DateOnly(2022,1,1), Gender = "Male" },
        };
        db.Teachers.AddRange(teachers);
        await db.SaveChangesAsync();

        // Assign class teachers
        classes[0].ClassTeacherId = teachers[0].TeacherId;
        classes[2].ClassTeacherId = teachers[1].TeacherId;
        classes[3].ClassTeacherId = teachers[2].TeacherId;
        await db.SaveChangesAsync();

        // Seed Students
        var students = new List<Student>
        {
            new() { UserId = student1.UserId, AdmissionNo = "ADM2025001", RollNo = "01",
                    FirstName = "Aarav", LastName = "Singh", DateOfBirth = new DateOnly(2012,3,15),
                    Gender = "Male", BloodGroup = "B+", Phone = "9000000001",
                    ClassId = classes[0].ClassId, ParentName = "Rajesh Singh", ParentPhone = "9111111111",
                    AdmissionDate = new DateOnly(2025,4,1), AcademicYear = "2025-26" },
            new() { AdmissionNo = "ADM2025002", RollNo = "02",
                    FirstName = "Sneha", LastName = "Patel", DateOfBirth = new DateOnly(2012,7,22),
                    Gender = "Female", BloodGroup = "A+", Phone = "9000000002",
                    ClassId = classes[0].ClassId, ParentName = "Mohan Patel", ParentPhone = "9111111112",
                    AdmissionDate = new DateOnly(2025,4,1), AcademicYear = "2025-26" },
            new() { AdmissionNo = "ADM2025003", RollNo = "01",
                    FirstName = "Ravi", LastName = "Gupta", DateOfBirth = new DateOnly(2009,11,5),
                    Gender = "Male", BloodGroup = "O+", Phone = "9000000003",
                    ClassId = classes[2].ClassId, ParentName = "Suresh Gupta", ParentPhone = "9111111113",
                    AdmissionDate = new DateOnly(2025,4,1), AcademicYear = "2025-26" },
            new() { AdmissionNo = "ADM2025004", RollNo = "02",
                    FirstName = "Ananya", LastName = "Sharma", DateOfBirth = new DateOnly(2009,2,18),
                    Gender = "Female", BloodGroup = "AB+", Phone = "9000000004",
                    ClassId = classes[2].ClassId, ParentName = "Vikas Sharma", ParentPhone = "9111111114",
                    AdmissionDate = new DateOnly(2025,4,1), AcademicYear = "2025-26" },
            new() { AdmissionNo = "ADM2025005", RollNo = "01",
                    FirstName = "Kiran", LastName = "Mehta", DateOfBirth = new DateOnly(2006,8,30),
                    Gender = "Male", BloodGroup = "B-", Phone = "9000000005",
                    ClassId = classes[3].ClassId, ParentName = "Dinesh Mehta", ParentPhone = "9111111115",
                    AdmissionDate = new DateOnly(2025,4,1), AcademicYear = "2025-26" },
        };
        db.Students.AddRange(students);
        await db.SaveChangesAsync();

        // Seed Fees
        var fees = new List<Fee>
        {
            new() { StudentId = students[0].StudentId, FeeType = "Tuition",   Amount = 12000, PaidAmount = 12000, DueDate = new DateOnly(2025,4,30), PaymentDate = new DateOnly(2025,4,10), PaymentMode = "Online", Status = "Paid" },
            new() { StudentId = students[0].StudentId, FeeType = "Transport",  Amount = 3000,  PaidAmount = 3000,  DueDate = new DateOnly(2025,4,30), PaymentDate = new DateOnly(2025,4,10), PaymentMode = "Cash",   Status = "Paid" },
            new() { StudentId = students[1].StudentId, FeeType = "Tuition",   Amount = 12000, PaidAmount = 6000,  DueDate = new DateOnly(2025,4,30), Status = "Partial" },
            new() { StudentId = students[2].StudentId, FeeType = "Tuition",   Amount = 15000, PaidAmount = 15000, DueDate = new DateOnly(2025,4,30), PaymentDate = new DateOnly(2025,4,5),  PaymentMode = "Cheque", Status = "Paid" },
            new() { StudentId = students[3].StudentId, FeeType = "Tuition",   Amount = 15000, PaidAmount = 0,     DueDate = new DateOnly(2025,4,30), Status = "Pending" },
            new() { StudentId = students[4].StudentId, FeeType = "Tuition",   Amount = 18000, PaidAmount = 18000, DueDate = new DateOnly(2025,4,30), PaymentDate = new DateOnly(2025,4,8),  PaymentMode = "Online", Status = "Paid" },
            new() { StudentId = students[4].StudentId, FeeType = "Exam",       Amount = 2500,  PaidAmount = 2500,  DueDate = new DateOnly(2025,4,30), PaymentDate = new DateOnly(2025,4,8),  PaymentMode = "Online", Status = "Paid" },
        };
        db.Fees.AddRange(fees);

        // Seed Buses
        db.Buses.AddRange(
            new Bus { BusNumber = "MH-12-AB-1234", DriverName = "Ram Bahadur",   DriverPhone = "9800001111", RCNumber = "RC001234", Capacity = 45, Route = "Sector 1 → Sector 5 → School" },
            new Bus { BusNumber = "MH-12-CD-5678", DriverName = "Shyam Lal",     DriverPhone = "9800002222", RCNumber = "RC005678", Capacity = 40, Route = "Sector 7 → Sector 12 → School" },
            new Bus { BusNumber = "MH-12-EF-9999", DriverName = "Govind Prasad", DriverPhone = "9800003333", RCNumber = "RC009999", Capacity = 50, Route = "Old City → New Colony → School" }
        );

        // Seed Events
        db.Events.AddRange(
            new Event { EventTitle = "Annual Sports Day",   EventDate = new DateOnly(2025,11,15), EndDate = new DateOnly(2025,11,15), Venue = "School Ground",     EventType = "Sports",   CreatedBy = admin.UserId },
            new Event { EventTitle = "Annual Day",          EventDate = new DateOnly(2025,12,20), EndDate = new DateOnly(2025,12,20), Venue = "School Auditorium", EventType = "Cultural", CreatedBy = admin.UserId },
            new Event { EventTitle = "Mid-Term Exams",      EventDate = new DateOnly(2025,9,1),   EndDate = new DateOnly(2025,9,15),  Venue = "Classrooms",        EventType = "Exam",     CreatedBy = admin.UserId },
            new Event { EventTitle = "Diwali Holiday",      EventDate = new DateOnly(2025,10,20), EndDate = new DateOnly(2025,10,24), Venue = null,                EventType = "Holiday",  CreatedBy = admin.UserId },
            new Event { EventTitle = "Parent-Teacher Meet", EventDate = new DateOnly(2025,7,26),  EndDate = new DateOnly(2025,7,26),  Venue = "Classrooms",        EventType = "Cultural", CreatedBy = admin.UserId }
        );

        await db.SaveChangesAsync();
    }
}
