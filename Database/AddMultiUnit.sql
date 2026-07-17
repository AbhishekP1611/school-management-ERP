-- ══════════════════════════════════════════════════════════════
-- Multi-unit (multi-branch) foundation:
--   1. Units table
--   2. A default "Main Unit"
--   3. UnitId column on every scoped table, backfilled to the default unit
-- ══════════════════════════════════════════════════════════════
USE SchoolERP;
GO

-- 1. Units table
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Units')
BEGIN
    CREATE TABLE Units (
        UnitId         INT IDENTITY(1,1) PRIMARY KEY,
        UnitName       NVARCHAR(200) NOT NULL,
        GstNo          NVARCHAR(30)  NULL,
        RegistrationNo NVARCHAR(50)  NULL,
        PrincipalName  NVARCHAR(100) NULL,
        Address        NVARCHAR(300) NULL,
        City           NVARCHAR(80)  NULL,
        State          NVARCHAR(80)  NULL,
        Pincode        NVARCHAR(12)  NULL,
        Phone          NVARCHAR(20)  NULL,
        Email          NVARCHAR(120) NULL,
        LogoUrl        NVARCHAR(MAX) NULL,
        IsActive       BIT NOT NULL DEFAULT 1,
        CreatedAt      DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

-- 2. Default unit (only if none exists)
IF NOT EXISTS (SELECT 1 FROM Units)
BEGIN
    INSERT INTO Units (UnitName, GstNo, PrincipalName, Address, City, State, Phone, Email)
    VALUES ('ABC Vidhya Mandir - Main Unit', '23ABCDE1234F1Z5', 'Principal', 'Near City Center, Main Road', 'Indore', 'Madhya Pradesh', '+91 98765 43210', 'info@abcvidhyamandir.com');
END
GO

DECLARE @DefaultUnit INT = (SELECT TOP 1 UnitId FROM Units ORDER BY UnitId);

-- 3. Add UnitId to every scoped table + backfill to the default unit
DECLARE @tables TABLE (name SYSNAME);
INSERT INTO @tables VALUES
 ('Users'),('Students'),('Teachers'),('Classes'),('Subjects'),('Exams'),
 ('Fees'),('Books'),('Buses'),('Events'),('Notices'),('Attendance'),
 ('StudentHistories'),('ExamSubjects'),('Results');

DECLARE @t SYSNAME;
DECLARE cur CURSOR FOR SELECT name FROM @tables;
OPEN cur;
FETCH NEXT FROM cur INTO @t;
WHILE @@FETCH_STATUS = 0
BEGIN
    IF OBJECT_ID(@t) IS NOT NULL AND COL_LENGTH(@t, 'UnitId') IS NULL
    BEGIN
        DECLARE @sql NVARCHAR(MAX) =
            'ALTER TABLE ' + QUOTENAME(@t) + ' ADD UnitId INT NULL;';
        EXEC sp_executesql @sql;

        SET @sql = 'UPDATE ' + QUOTENAME(@t) + ' SET UnitId = ' + CAST(@DefaultUnit AS NVARCHAR) + ' WHERE UnitId IS NULL;';
        EXEC sp_executesql @sql;
    END
    ELSE IF OBJECT_ID(@t) IS NOT NULL
    BEGIN
        -- column already exists; just backfill NULLs
        SET @sql = 'UPDATE ' + QUOTENAME(@t) + ' SET UnitId = ' + CAST(@DefaultUnit AS NVARCHAR) + ' WHERE UnitId IS NULL;';
        EXEC sp_executesql @sql;
    END
    FETCH NEXT FROM cur INTO @t;
END
CLOSE cur;
DEALLOCATE cur;
GO

PRINT 'Multi-unit foundation ready. All existing data assigned to the default unit.';
GO
