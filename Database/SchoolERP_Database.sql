-- ============================================================
--  🎓 School ERP System - SQL Server Database Script
--  Run this entire script in SSMS against your SQL Server
-- ============================================================

USE master;
GO

IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'SchoolERP')
BEGIN
    CREATE DATABASE SchoolERP;
END
GO

USE SchoolERP;
GO

-- ============================================================
-- 1. USERS TABLE (Authentication)
-- ============================================================
IF OBJECT_ID('dbo.Users', 'U') IS NOT NULL DROP TABLE dbo.Users;

CREATE TABLE dbo.Users (
    UserId       INT IDENTITY(1,1) PRIMARY KEY,
    Username     NVARCHAR(100)  NOT NULL UNIQUE,
    PasswordHash NVARCHAR(256)  NOT NULL,
    Role         NVARCHAR(20)   NOT NULL CHECK (Role IN ('Admin','Teacher','Student')),
    Email        NVARCHAR(150)  NULL,
    IsActive     BIT            NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 2. CLASSES TABLE
-- ============================================================
IF OBJECT_ID('dbo.Classes', 'U') IS NOT NULL DROP TABLE dbo.Classes;

CREATE TABLE dbo.Classes (
    ClassId       INT IDENTITY(1,1) PRIMARY KEY,
    ClassName     NVARCHAR(50)  NOT NULL,
    Section       NVARCHAR(10)  NOT NULL,
    ClassTeacherId INT           NULL,   -- FK to Teachers added after
    AcademicYear  NVARCHAR(20)  NOT NULL DEFAULT '2025-26',
    CreatedAt     DATETIME2     NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Class_Section UNIQUE (ClassName, Section, AcademicYear)
);
GO

-- ============================================================
-- 3. TEACHERS TABLE
-- ============================================================
IF OBJECT_ID('dbo.Teachers', 'U') IS NOT NULL DROP TABLE dbo.Teachers;

CREATE TABLE dbo.Teachers (
    TeacherId     INT IDENTITY(1,1) PRIMARY KEY,
    UserId        INT            NULL REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    EmployeeId    NVARCHAR(50)   NOT NULL UNIQUE,
    FirstName     NVARCHAR(100)  NOT NULL,
    LastName      NVARCHAR(100)  NOT NULL,
    Email         NVARCHAR(150)  NOT NULL,
    Phone         NVARCHAR(20)   NULL,
    Designation   NVARCHAR(100)  NULL,
    Specialization NVARCHAR(200) NULL,
    Salary        DECIMAL(12,2)  NOT NULL DEFAULT 0,
    DateOfJoining DATE           NULL,
    Address       NVARCHAR(300)  NULL,
    Gender        NVARCHAR(10)   NULL CHECK (Gender IN ('Male','Female','Other')),
    IsActive      BIT            NOT NULL DEFAULT 1,
    CreatedAt     DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- Add FK: Classes → Teachers
ALTER TABLE dbo.Classes
    ADD CONSTRAINT FK_Classes_Teacher
    FOREIGN KEY (ClassTeacherId) REFERENCES dbo.Teachers(TeacherId) ON DELETE SET NULL;
GO

-- ============================================================
-- 4. STUDENTS TABLE
-- ============================================================
IF OBJECT_ID('dbo.Students', 'U') IS NOT NULL DROP TABLE dbo.Students;

CREATE TABLE dbo.Students (
    StudentId      INT IDENTITY(1,1) PRIMARY KEY,
    UserId         INT            NULL REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    AdmissionNo    NVARCHAR(50)   NOT NULL UNIQUE,
    RollNo         NVARCHAR(20)   NULL,
    FirstName      NVARCHAR(100)  NOT NULL,
    LastName       NVARCHAR(100)  NOT NULL,
    DateOfBirth    DATE           NULL,
    Gender         NVARCHAR(10)   NULL CHECK (Gender IN ('Male','Female','Other')),
    BloodGroup     NVARCHAR(5)    NULL,
    Email          NVARCHAR(150)  NULL,
    Phone          NVARCHAR(20)   NULL,
    Address        NVARCHAR(300)  NULL,
    ClassId        INT            NULL REFERENCES dbo.Classes(ClassId) ON DELETE SET NULL,
    ParentName     NVARCHAR(200)  NULL,
    ParentPhone    NVARCHAR(20)   NULL,
    ParentEmail    NVARCHAR(150)  NULL,
    AdmissionDate  DATE           NULL DEFAULT CAST(GETDATE() AS DATE),
    AcademicYear   NVARCHAR(20)   NOT NULL DEFAULT '2025-26',
    IsActive       BIT            NOT NULL DEFAULT 1,
    CreatedAt      DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 5. FEES TABLE
-- ============================================================
IF OBJECT_ID('dbo.Fees', 'U') IS NOT NULL DROP TABLE dbo.Fees;

CREATE TABLE dbo.Fees (
    FeeId         INT IDENTITY(1,1) PRIMARY KEY,
    StudentId     INT            NOT NULL REFERENCES dbo.Students(StudentId) ON DELETE CASCADE,
    FeeType       NVARCHAR(100)  NOT NULL,   -- e.g. 'Tuition','Transport','Exam'
    Amount        DECIMAL(12,2)  NOT NULL,
    Discount      DECIMAL(12,2)  NOT NULL DEFAULT 0,
    PaidAmount    DECIMAL(12,2)  NOT NULL DEFAULT 0,
    DueDate       DATE           NULL,
    PaymentDate   DATE           NULL,
    PaymentMode   NVARCHAR(50)   NULL CHECK (PaymentMode IN ('Cash','Online','Cheque','DD',NULL)),
    TransactionRef NVARCHAR(100) NULL,
    Status        NVARCHAR(20)   NOT NULL DEFAULT 'Pending' CHECK (Status IN ('Pending','Paid','Partial','Overdue')),
    Remarks       NVARCHAR(300)  NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 6. ATTENDANCE TABLE
-- ============================================================
IF OBJECT_ID('dbo.Attendance', 'U') IS NOT NULL DROP TABLE dbo.Attendance;

CREATE TABLE dbo.Attendance (
    AttendanceId  INT IDENTITY(1,1) PRIMARY KEY,
    ReferenceId   INT            NOT NULL,     -- StudentId or TeacherId
    ReferenceType NVARCHAR(10)   NOT NULL CHECK (ReferenceType IN ('Student','Teacher')),
    AttendanceDate DATE          NOT NULL,
    Status        NVARCHAR(10)   NOT NULL DEFAULT 'Present' CHECK (Status IN ('Present','Absent','Late','Leave')),
    Remarks       NVARCHAR(200)  NULL,
    MarkedBy      INT            NULL REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    CreatedAt     DATETIME2      NOT NULL DEFAULT GETDATE(),
    CONSTRAINT UQ_Attendance UNIQUE (ReferenceId, ReferenceType, AttendanceDate)
);
GO

-- ============================================================
-- 7. BUSES TABLE (Transport)
-- ============================================================
IF OBJECT_ID('dbo.Buses', 'U') IS NOT NULL DROP TABLE dbo.Buses;

CREATE TABLE dbo.Buses (
    BusId        INT IDENTITY(1,1) PRIMARY KEY,
    BusNumber    NVARCHAR(20)   NOT NULL UNIQUE,
    DriverName   NVARCHAR(150)  NOT NULL,
    DriverPhone  NVARCHAR(20)   NULL,
    RCNumber     NVARCHAR(50)   NULL,
    Capacity     INT            NOT NULL DEFAULT 40,
    Route        NVARCHAR(300)  NULL,
    IsActive     BIT            NOT NULL DEFAULT 1,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- 8. EVENTS TABLE
-- ============================================================
IF OBJECT_ID('dbo.Events', 'U') IS NOT NULL DROP TABLE dbo.Events;

CREATE TABLE dbo.Events (
    EventId      INT IDENTITY(1,1) PRIMARY KEY,
    EventTitle   NVARCHAR(200)  NOT NULL,
    Description  NVARCHAR(1000) NULL,
    EventDate    DATE           NOT NULL,
    EndDate      DATE           NULL,
    Venue        NVARCHAR(200)  NULL,
    EventType    NVARCHAR(50)   NULL,   -- 'Holiday','Exam','Cultural','Sports'
    IsPublished  BIT            NOT NULL DEFAULT 1,
    CreatedBy    INT            NULL REFERENCES dbo.Users(UserId) ON DELETE SET NULL,
    CreatedAt    DATETIME2      NOT NULL DEFAULT GETDATE()
);
GO

-- ============================================================
-- SEED DATA
-- ============================================================

-- Admin user  (password: Admin@123  → BCrypt hash placeholder, backend seeds real hash)
INSERT INTO dbo.Users (Username, PasswordHash, Role, Email) VALUES
('admin',   '$2a$11$PLACEHOLDER_ADMIN_HASH',   'Admin',   'admin@schoolerp.com'),
('teacher1','$2a$11$PLACEHOLDER_TEACHER_HASH', 'Teacher', 'teacher1@schoolerp.com'),
('student1','$2a$11$PLACEHOLDER_STUDENT_HASH', 'Student', 'student1@schoolerp.com');
GO

-- Classes
INSERT INTO dbo.Classes (ClassName, Section, AcademicYear) VALUES
('Class 1', 'A', '2025-26'),
('Class 1', 'B', '2025-26'),
('Class 5', 'A', '2025-26'),
('Class 10', 'A', '2025-26'),
('Class 12', 'Science', '2025-26');
GO

-- Teachers
INSERT INTO dbo.Teachers (UserId, EmployeeId, FirstName, LastName, Email, Phone, Designation, Specialization, Salary, DateOfJoining, Gender) VALUES
(2, 'EMP001', 'Ramesh',  'Sharma',   'teacher1@schoolerp.com', '9876543210', 'Senior Teacher', 'Mathematics', 45000, '2020-06-01', 'Male'),
(NULL,'EMP002', 'Priya',  'Verma',    'priya@schoolerp.com',    '9876543211', 'Teacher',        'Science',      38000, '2021-07-15', 'Female'),
(NULL,'EMP003', 'Anil',   'Kumar',    'anil@schoolerp.com',     '9876543212', 'Teacher',        'English',      36000, '2022-01-01', 'Male');
GO

-- Update class teachers
UPDATE dbo.Classes SET ClassTeacherId = 1 WHERE ClassId = 1;
UPDATE dbo.Classes SET ClassTeacherId = 2 WHERE ClassId = 3;
UPDATE dbo.Classes SET ClassTeacherId = 3 WHERE ClassId = 4;
GO

-- Students
INSERT INTO dbo.Students (UserId, AdmissionNo, RollNo, FirstName, LastName, DateOfBirth, Gender, BloodGroup, Phone, ClassId, ParentName, ParentPhone, AdmissionDate, AcademicYear) VALUES
(3,    'ADM2025001', '01', 'Aarav',  'Singh',    '2012-03-15', 'Male',   'B+', '9000000001', 1, 'Rajesh Singh',   '9111111111', '2025-04-01', '2025-26'),
(NULL, 'ADM2025002', '02', 'Sneha',  'Patel',    '2012-07-22', 'Female', 'A+', '9000000002', 1, 'Mohan Patel',    '9111111112', '2025-04-01', '2025-26'),
(NULL, 'ADM2025003', '01', 'Ravi',   'Gupta',    '2009-11-05', 'Male',   'O+', '9000000003', 3, 'Suresh Gupta',   '9111111113', '2025-04-01', '2025-26'),
(NULL, 'ADM2025004', '02', 'Ananya', 'Sharma',   '2009-02-18', 'Female', 'AB+','9000000004', 3, 'Vikas Sharma',   '9111111114', '2025-04-01', '2025-26'),
(NULL, 'ADM2025005', '01', 'Kiran',  'Mehta',    '2006-08-30', 'Male',   'B-', '9000000005', 4, 'Dinesh Mehta',   '9111111115', '2025-04-01', '2025-26');
GO

-- Fees
INSERT INTO dbo.Fees (StudentId, FeeType, Amount, PaidAmount, DueDate, PaymentDate, PaymentMode, Status) VALUES
(1, 'Tuition',   12000, 12000, '2025-04-30', '2025-04-10', 'Online', 'Paid'),
(1, 'Transport',  3000,  3000, '2025-04-30', '2025-04-10', 'Cash',   'Paid'),
(2, 'Tuition',   12000,  6000, '2025-04-30', NULL,          NULL,     'Partial'),
(3, 'Tuition',   15000, 15000, '2025-04-30', '2025-04-05', 'Cheque', 'Paid'),
(4, 'Tuition',   15000,     0, '2025-04-30', NULL,          NULL,     'Pending'),
(5, 'Tuition',   18000, 18000, '2025-04-30', '2025-04-08', 'Online', 'Paid'),
(5, 'Exam',       2500,  2500, '2025-04-30', '2025-04-08', 'Online', 'Paid');
GO

-- Buses
INSERT INTO dbo.Buses (BusNumber, DriverName, DriverPhone, RCNumber, Capacity, Route) VALUES
('MH-12-AB-1234', 'Ram Bahadur',  '9800001111', 'RC001234', 45, 'Sector 1 → Sector 5 → School'),
('MH-12-CD-5678', 'Shyam Lal',    '9800002222', 'RC005678', 40, 'Sector 7 → Sector 12 → School'),
('MH-12-EF-9999', 'Govind Prasad','9800003333', 'RC009999', 50, 'Old City → New Colony → School');
GO

-- Events
INSERT INTO dbo.Events (EventTitle, Description, EventDate, EndDate, Venue, EventType, CreatedBy) VALUES
('Annual Sports Day',   'Inter-house sports competition',           '2025-11-15', '2025-11-15', 'School Ground',  'Sports',   1),
('Annual Day',          'Cultural programs and prize distribution',  '2025-12-20', '2025-12-20', 'School Auditorium','Cultural',1),
('Mid-Term Exams',      'Classes 1–12 mid-term examinations',       '2025-09-01', '2025-09-15', 'Classrooms',     'Exam',     1),
('Diwali Holiday',      'School closed for Diwali celebration',     '2025-10-20', '2025-10-24', NULL,             'Holiday',  1),
('Parent-Teacher Meet', 'Quarterly PTM for all classes',            '2025-07-26', '2025-07-26', 'Classrooms',     'Cultural', 1);
GO

-- Attendance (sample for today)
DECLARE @Today DATE = CAST(GETDATE() AS DATE);
INSERT INTO dbo.Attendance (ReferenceId, ReferenceType, AttendanceDate, Status, MarkedBy) VALUES
(1, 'Student', @Today, 'Present', 1),
(2, 'Student', @Today, 'Present', 1),
(3, 'Student', @Today, 'Absent',  1),
(4, 'Student', @Today, 'Present', 1),
(5, 'Student', @Today, 'Late',    1),
(1, 'Teacher', @Today, 'Present', 1),
(2, 'Teacher', @Today, 'Present', 1),
(3, 'Teacher', @Today, 'Present', 1);
GO

PRINT '✅ SchoolERP database created successfully with all tables and seed data.';
GO
