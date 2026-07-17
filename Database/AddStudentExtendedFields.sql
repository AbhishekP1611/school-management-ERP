-- Adds the extended student profile fields + academic history table
-- brought over from the legacy Web Forms module.
USE SchoolERP;
GO

-- ── New columns on Students (only add if missing) ──────────────
IF COL_LENGTH('Students', 'Religion')         IS NULL ALTER TABLE Students ADD Religion         NVARCHAR(30)  NULL;
IF COL_LENGTH('Students', 'Category')         IS NULL ALTER TABLE Students ADD Category         NVARCHAR(30)  NULL;
IF COL_LENGTH('Students', 'AadharNo')         IS NULL ALTER TABLE Students ADD AadharNo         NVARCHAR(20)  NULL;
IF COL_LENGTH('Students', 'FatherName')       IS NULL ALTER TABLE Students ADD FatherName       NVARCHAR(100) NULL;
IF COL_LENGTH('Students', 'MotherName')       IS NULL ALTER TABLE Students ADD MotherName       NVARCHAR(100) NULL;
IF COL_LENGTH('Students', 'FatherOccupation') IS NULL ALTER TABLE Students ADD FatherOccupation NVARCHAR(100) NULL;
IF COL_LENGTH('Students', 'MotherOccupation') IS NULL ALTER TABLE Students ADD MotherOccupation NVARCHAR(100) NULL;
IF COL_LENGTH('Students', 'EmergencyContact') IS NULL ALTER TABLE Students ADD EmergencyContact NVARCHAR(20)  NULL;
IF COL_LENGTH('Students', 'BusId')            IS NULL ALTER TABLE Students ADD BusId            INT           NULL;
GO

-- FK from Students.BusId -> Buses.BusId (nullable, set-null on delete)
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Students_Buses')
AND COL_LENGTH('Students','BusId') IS NOT NULL
AND EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Buses')
BEGIN
    ALTER TABLE Students
    ADD CONSTRAINT FK_Students_Buses FOREIGN KEY (BusId) REFERENCES Buses(BusId) ON DELETE SET NULL;
END
GO

-- ── StudentHistories table (academic performance records) ──────
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'StudentHistories')
BEGIN
    CREATE TABLE StudentHistories (
        HistoryId     INT IDENTITY(1,1) PRIMARY KEY,
        StudentId     INT NOT NULL,
        ClassName     NVARCHAR(50)  NULL,
        SessionYear   NVARCHAR(20)  NULL,
        TotalMarks    DECIMAL(6,2)  NULL,
        ObtainedMarks DECIMAL(6,2)  NULL,
        Percentage    DECIMAL(5,2)  NULL,
        Result        NVARCHAR(20)  NULL,
        CreatedAt     DATETIME      NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_StudentHistories_Students
            FOREIGN KEY (StudentId) REFERENCES Students(StudentId) ON DELETE CASCADE
    );
END
GO

PRINT 'Student extended fields + StudentHistories table ready.';
GO
