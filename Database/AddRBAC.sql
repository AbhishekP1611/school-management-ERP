-- RBAC: Modules (master) + Authorities (per-user per-module permissions)
USE SchoolERP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Modules')
BEGIN
    CREATE TABLE Modules (
        ModuleId   INT IDENTITY(1,1) PRIMARY KEY,
        ModuleName NVARCHAR(100) NOT NULL UNIQUE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Authorities')
BEGIN
    CREATE TABLE Authorities (
        AuthorityId INT IDENTITY(1,1) PRIMARY KEY,
        UserId      INT NOT NULL,
        ModuleId    INT NOT NULL,
        CanView     BIT NOT NULL DEFAULT 0,
        CanCreate   BIT NOT NULL DEFAULT 0,
        CanEdit     BIT NOT NULL DEFAULT 0,
        CanDelete   BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Authorities_Users FOREIGN KEY (UserId) REFERENCES Users(UserId) ON DELETE CASCADE,
        CONSTRAINT FK_Authorities_Modules FOREIGN KEY (ModuleId) REFERENCES Modules(ModuleId) ON DELETE CASCADE,
        CONSTRAINT UQ_Authority_User_Module UNIQUE (UserId, ModuleId)
    );
END
GO

PRINT 'RBAC tables ready.';
GO
