-- Activity monitoring: user block flag, sessions, activity logs
USE SchoolERP;
GO

IF COL_LENGTH('Users', 'IsBlocked') IS NULL
    ALTER TABLE Users ADD IsBlocked BIT NOT NULL DEFAULT 0;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'UserSessions')
BEGIN
    CREATE TABLE UserSessions (
        SessionId    INT IDENTITY(1,1) PRIMARY KEY,
        UserId       INT NOT NULL,
        Username     NVARCHAR(100) NOT NULL,
        Role         NVARCHAR(20)  NOT NULL,
        LoginAt      DATETIME NOT NULL DEFAULT GETUTCDATE(),
        LogoutAt     DATETIME NULL,
        LogoutReason NVARCHAR(20)  NULL,
        IpAddress    NVARCHAR(64)  NULL,
        LastSeenAt   DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_UserSessions_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ActivityLogs')
BEGIN
    CREATE TABLE ActivityLogs (
        LogId     INT IDENTITY(1,1) PRIMARY KEY,
        UserId    INT NULL,
        Username  NVARCHAR(100) NOT NULL,
        Role      NVARCHAR(20)  NOT NULL,
        Module    NVARCHAR(50)  NOT NULL,
        Action    NVARCHAR(30)  NOT NULL,
        Detail    NVARCHAR(400) NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
    CREATE INDEX IX_ActivityLogs_User ON ActivityLogs(UserId);
    CREATE INDEX IX_ActivityLogs_Created ON ActivityLogs(LogId DESC);
END
GO

PRINT 'Monitoring tables ready.';
GO
