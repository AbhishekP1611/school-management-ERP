-- Subjects, Exams, ExamSubjects, Results tables (marksheet flow)
USE SchoolERP;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Subjects')
BEGIN
    CREATE TABLE Subjects (
        SubjectId   INT IDENTITY(1,1) PRIMARY KEY,
        SubjectName NVARCHAR(100) NOT NULL,
        ClassId     INT NOT NULL,
        CreatedAt   DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Subjects_Classes FOREIGN KEY (ClassId) REFERENCES Classes(ClassId) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Exams')
BEGIN
    CREATE TABLE Exams (
        ExamId    INT IDENTITY(1,1) PRIMARY KEY,
        ExamName  NVARCHAR(150) NOT NULL,
        ClassId   INT NOT NULL,
        CreatedAt DATETIME NOT NULL DEFAULT GETUTCDATE(),
        CONSTRAINT FK_Exams_Classes FOREIGN KEY (ClassId) REFERENCES Classes(ClassId) ON DELETE CASCADE
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'ExamSubjects')
BEGIN
    CREATE TABLE ExamSubjects (
        ExamSubjectId INT IDENTITY(1,1) PRIMARY KEY,
        ExamId        INT NOT NULL,
        SubjectId     INT NOT NULL,
        ExamDate      DATE NULL,
        MaxMarks      DECIMAL(6,2) NOT NULL DEFAULT 100,
        PassingMarks  DECIMAL(6,2) NOT NULL DEFAULT 35,
        CONSTRAINT FK_ExamSubjects_Exams FOREIGN KEY (ExamId) REFERENCES Exams(ExamId) ON DELETE CASCADE,
        CONSTRAINT FK_ExamSubjects_Subjects FOREIGN KEY (SubjectId) REFERENCES Subjects(SubjectId)
    );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'Results')
BEGIN
    CREATE TABLE Results (
        ResultId      INT IDENTITY(1,1) PRIMARY KEY,
        ExamSubjectId INT NOT NULL,
        StudentId     INT NOT NULL,
        MarksObtained DECIMAL(6,2) NULL,
        IsAbsent      BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_Results_ExamSubjects FOREIGN KEY (ExamSubjectId) REFERENCES ExamSubjects(ExamSubjectId) ON DELETE CASCADE,
        CONSTRAINT FK_Results_Students FOREIGN KEY (StudentId) REFERENCES Students(StudentId)
    );
END
GO

PRINT 'Exams / Results tables ready.';
GO
