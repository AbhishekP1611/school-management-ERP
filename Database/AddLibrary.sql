-- Library: Books, IssuedBooks, FineDetails
USE SchoolERP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Books')
BEGIN
    CREATE TABLE Books (
        BookId      INT IDENTITY(1,1) PRIMARY KEY,
        BookName    NVARCHAR(200) NOT NULL,
        Author      NVARCHAR(200) NULL,
        Price       DECIMAL(10,2) NOT NULL DEFAULT 0,
        IsAvailable BIT NOT NULL DEFAULT 1,
        IsDeleted   BIT NOT NULL DEFAULT 0,
        UsableUntil DATE NULL,
        CreatedAt   DATETIME NOT NULL DEFAULT GETUTCDATE()
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'IssuedBooks')
BEGIN
    CREATE TABLE IssuedBooks (
        IssueId    INT IDENTITY(1,1) PRIMARY KEY,
        BookId     INT NOT NULL,
        StudentId  INT NOT NULL,
        IssueDate  DATE NOT NULL,
        DueDate    DATE NOT NULL,
        ReturnDate DATE NULL,
        CONSTRAINT FK_IssuedBooks_Books FOREIGN KEY (BookId) REFERENCES Books(BookId),
        CONSTRAINT FK_IssuedBooks_Students FOREIGN KEY (StudentId) REFERENCES Students(StudentId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'FineDetails')
BEGIN
    CREATE TABLE FineDetails (
        FineId     INT IDENTITY(1,1) PRIMARY KEY,
        IssueId    INT NOT NULL,
        StudentId  INT NOT NULL,
        BookId     INT NOT NULL,
        FineAmount DECIMAL(10,2) NOT NULL,
        Remarks    NVARCHAR(300) NULL,
        CreatedAt  DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_FineDetails_IssuedBooks FOREIGN KEY (IssueId) REFERENCES IssuedBooks(IssueId),
        CONSTRAINT FK_FineDetails_Students FOREIGN KEY (StudentId) REFERENCES Students(StudentId),
        CONSTRAINT FK_FineDetails_Books FOREIGN KEY (BookId) REFERENCES Books(BookId)
    );
END
GO

PRINT 'Library tables ready.';
GO
