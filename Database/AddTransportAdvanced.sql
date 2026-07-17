-- Advanced transport: bus start/dest, stops (with coords), student assignments
USE SchoolERP;
GO

IF COL_LENGTH('Buses', 'StartLocation') IS NULL ALTER TABLE Buses ADD StartLocation NVARCHAR(120) NULL;
IF COL_LENGTH('Buses', 'Destination')   IS NULL ALTER TABLE Buses ADD Destination   NVARCHAR(120) NULL;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BusStops')
BEGIN
    CREATE TABLE BusStops (
        StopId    INT IDENTITY(1,1) PRIMARY KEY,
        BusId     INT NOT NULL,
        StopName  NVARCHAR(150) NOT NULL,
        StopOrder INT NOT NULL,
        StopTime  NVARCHAR(10) NULL,
        Latitude  FLOAT NOT NULL,
        Longitude FLOAT NOT NULL,
        CONSTRAINT FK_BusStops_Buses FOREIGN KEY (BusId) REFERENCES Buses(BusId) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'BusAssignments')
BEGIN
    CREATE TABLE BusAssignments (
        AssignmentId INT IDENTITY(1,1) PRIMARY KEY,
        BusId        INT NOT NULL,
        StudentId    INT NOT NULL,
        StopId       INT NOT NULL,
        AssignedDate DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
        CONSTRAINT FK_BusAssign_Buses FOREIGN KEY (BusId) REFERENCES Buses(BusId) ON DELETE CASCADE,
        CONSTRAINT FK_BusAssign_Students FOREIGN KEY (StudentId) REFERENCES Students(StudentId),
        CONSTRAINT FK_BusAssign_Stops FOREIGN KEY (StopId) REFERENCES BusStops(StopId),
        CONSTRAINT UQ_BusAssign_Student UNIQUE (StudentId)
    );
END
GO

PRINT 'Advanced transport tables ready.';
GO
