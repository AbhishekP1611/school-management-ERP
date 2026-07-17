-- Notices / notifications (bell + email)
USE SchoolERP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Notices')
BEGIN
    CREATE TABLE Notices (
        NoticeId      INT IDENTITY(1,1) PRIMARY KEY,
        Title         NVARCHAR(200) NOT NULL,
        Message       NVARCHAR(MAX) NOT NULL,
        Priority      NVARCHAR(20)  NOT NULL DEFAULT 'Normal',
        TargetRole    NVARCHAR(20)  NOT NULL DEFAULT 'All',
        CreatedBy     INT NULL,
        CreatedByName NVARCHAR(100) NULL,
        CreatedAt     DATETIME NOT NULL DEFAULT GETUTCDATE(),
        EmailSent     BIT NOT NULL DEFAULT 0
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'NoticeReads')
BEGIN
    CREATE TABLE NoticeReads (
        NoticeReadId INT IDENTITY(1,1) PRIMARY KEY,
        NoticeId     INT NOT NULL,
        UserId       INT NOT NULL,
        ReadAt       DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_NoticeReads_Notices FOREIGN KEY (NoticeId) REFERENCES Notices(NoticeId) ON DELETE CASCADE,
        CONSTRAINT UQ_NoticeRead UNIQUE (NoticeId, UserId)
    );
END
GO

PRINT 'Notices tables ready.';
GO
