CREATE TABLE [ActivityLogs] (
    [LogId] int IDENTITY(1,1) NOT NULL,
    [UserId] int NULL,
    [Username] nvarchar(100) NOT NULL,
    [Role] nvarchar(20) NOT NULL,
    [Module] nvarchar(50) NOT NULL,
    [Action] nvarchar(30) NOT NULL,
    [Detail] nvarchar(400) NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    CONSTRAINT [PK__Activity__5E54864808C66AC3] PRIMARY KEY ([LogId])
);
GO


CREATE TABLE [Assets] (
    [AssetId] int IDENTITY(1,1) NOT NULL,
    [AssetName] nvarchar(160) NOT NULL,
    [AssetCode] nvarchar(60) NULL,
    [Category] nvarchar(40) NOT NULL DEFAULT ('Other'),
    [Quantity] int NOT NULL DEFAULT ((1)),
    [UnitPrice] decimal(12,2) NOT NULL DEFAULT ((0)),
    [PurchaseDate] date NULL,
    [Vendor] nvarchar(160) NULL,
    [InvoiceNo] nvarchar(80) NULL,
    [BillImageUrl] nvarchar(MAX) NULL,
    [WarrantyMonths] int NULL,
    [WarrantyUntil] date NULL,
    [LifespanYears] int NULL,
    [Condition] nvarchar(20) NOT NULL DEFAULT ('Good'),
    [Location] nvarchar(120) NULL,
    [Remarks] nvarchar(MAX) NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    CONSTRAINT [PK__Assets__434923520C849C46] PRIMARY KEY ([AssetId])
);
GO


CREATE TABLE [Attendance] (
    [AttendanceId] int IDENTITY(1,1) NOT NULL,
    [ReferenceId] int NOT NULL,
    [ReferenceType] nvarchar(10) NOT NULL,
    [AttendanceDate] date NOT NULL,
    [Status] nvarchar(10) NOT NULL DEFAULT ('Present'),
    [Remarks] nvarchar(200) NULL,
    [MarkedBy] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [UnitId] int NULL,
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT ('2025-26'),
    CONSTRAINT [PK__Attendan__8B69261C7C2B0F4E] PRIMARY KEY ([AttendanceId])
);
GO


CREATE TABLE [Authorities] (
    [AuthorityId] int IDENTITY(1,1) NOT NULL,
    [UserId] int NOT NULL,
    [ModuleId] int NOT NULL,
    [CanView] bit NOT NULL DEFAULT ((0)),
    [CanCreate] bit NOT NULL DEFAULT ((0)),
    [CanEdit] bit NOT NULL DEFAULT ((0)),
    [CanDelete] bit NOT NULL DEFAULT ((0)),
    CONSTRAINT [PK__Authorit__433B1E4D3F566717] PRIMARY KEY ([AuthorityId])
);
GO


CREATE TABLE [Books] (
    [BookId] int IDENTITY(1,1) NOT NULL,
    [BookName] nvarchar(200) NOT NULL,
    [Author] nvarchar(200) NULL,
    [Price] decimal(10,2) NOT NULL DEFAULT ((0)),
    [IsAvailable] bit NOT NULL DEFAULT ((1)),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UsableUntil] date NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    [UnitId] int NULL,
    CONSTRAINT [PK__Books__3DE0C20735D32622] PRIMARY KEY ([BookId])
);
GO


CREATE TABLE [Budgets] (
    [BudgetId] int IDENTITY(1,1) NOT NULL,
    [Category] nvarchar(80) NOT NULL,
    [PlannedAmount] decimal(14,2) NOT NULL DEFAULT ((0)),
    [Period] nvarchar(20) NOT NULL DEFAULT ('Yearly'),
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT ('2025-26'),
    [Notes] nvarchar(MAX) NULL,
    [CreatedBy] int NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    CONSTRAINT [PK__Budgets__E38E7924E5048112] PRIMARY KEY ([BudgetId])
);
GO


CREATE TABLE [BusAssignments] (
    [AssignmentId] int IDENTITY(1,1) NOT NULL,
    [BusId] int NOT NULL,
    [StudentId] int NOT NULL,
    [StopId] int NOT NULL,
    [AssignedDate] date NOT NULL DEFAULT (CONVERT([date],getdate())),
    CONSTRAINT [PK__BusAssig__32499E7763D4FABC] PRIMARY KEY ([AssignmentId])
);
GO


CREATE TABLE [Buses] (
    [BusId] int IDENTITY(1,1) NOT NULL,
    [BusNumber] nvarchar(20) NOT NULL,
    [DriverName] nvarchar(150) NOT NULL,
    [DriverPhone] nvarchar(20) NULL,
    [RCNumber] nvarchar(50) NULL,
    [Capacity] int NOT NULL DEFAULT ((40)),
    [Route] nvarchar(300) NULL,
    [IsActive] bit NOT NULL DEFAULT ((1)),
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [StartLocation] nvarchar(120) NULL,
    [Destination] nvarchar(120) NULL,
    [UnitId] int NULL,
    CONSTRAINT [PK__Buses__6A0F60B546A76DB4] PRIMARY KEY ([BusId])
);
GO


CREATE TABLE [BusStops] (
    [StopId] int IDENTITY(1,1) NOT NULL,
    [BusId] int NOT NULL,
    [StopName] nvarchar(150) NOT NULL,
    [StopOrder] int NOT NULL,
    [StopTime] nvarchar(10) NULL,
    [Latitude] float NOT NULL,
    [Longitude] float NOT NULL,
    CONSTRAINT [PK__BusStops__EB6A38F455D7E244] PRIMARY KEY ([StopId])
);
GO


CREATE TABLE [Classes] (
    [ClassId] int IDENTITY(1,1) NOT NULL,
    [ClassName] nvarchar(50) NOT NULL,
    [Section] nvarchar(10) NOT NULL,
    [ClassTeacherId] int NULL,
    [AcademicYear] nvarchar(20) NOT NULL DEFAULT ('2025-26'),
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [Stream] nvarchar(50) NULL,
    [RoomNumber] nvarchar(50) NULL,
    [Capacity] int NULL,
    [Shift] nvarchar(20) NULL,
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    CONSTRAINT [PK__Classes__CB1927C0313C84D1] PRIMARY KEY ([ClassId])
);
GO


CREATE TABLE [Events] (
    [EventId] int IDENTITY(1,1) NOT NULL,
    [EventTitle] nvarchar(200) NOT NULL,
    [Description] nvarchar(1000) NULL,
    [EventDate] date NOT NULL,
    [EndDate] date NULL,
    [Venue] nvarchar(200) NULL,
    [EventType] nvarchar(50) NULL,
    [IsPublished] bit NOT NULL DEFAULT ((1)),
    [CreatedBy] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [UnitId] int NULL,
    CONSTRAINT [PK__Events__7944C810803DFE43] PRIMARY KEY ([EventId])
);
GO


CREATE TABLE [Exams] (
    [ExamId] int IDENTITY(1,1) NOT NULL,
    [ExamName] nvarchar(150) NOT NULL,
    [ClassId] int NOT NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT ('2025-26'),
    CONSTRAINT [PK__Exams__297521C751189B17] PRIMARY KEY ([ExamId])
);
GO


CREATE TABLE [ExamSubjects] (
    [ExamSubjectId] int IDENTITY(1,1) NOT NULL,
    [ExamId] int NOT NULL,
    [SubjectId] int NOT NULL,
    [ExamDate] date NULL,
    [MaxMarks] decimal(6,2) NOT NULL DEFAULT ((100)),
    [PassingMarks] decimal(6,2) NOT NULL DEFAULT ((35)),
    [UnitId] int NULL,
    CONSTRAINT [PK__ExamSubj__C5C4E54DC5599A89] PRIMARY KEY ([ExamSubjectId])
);
GO


CREATE TABLE [Expenses] (
    [ExpenseId] int IDENTITY(1,1) NOT NULL,
    [Category] nvarchar(80) NOT NULL,
    [ExpenseType] nvarchar(20) NOT NULL DEFAULT ('Monthly'),
    [Amount] decimal(14,2) NOT NULL DEFAULT ((0)),
    [Reason] nvarchar(MAX) NULL,
    [PaidTo] nvarchar(120) NULL,
    [PaymentMode] nvarchar(30) NULL,
    [ImageUrl] nvarchar(MAX) NULL,
    [IsExceptional] bit NOT NULL DEFAULT ((0)),
    [ExpenseDate] date NOT NULL,
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT ('2025-26'),
    [CreatedBy] int NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    CONSTRAINT [PK__Expenses__1445CFD37CCA200C] PRIMARY KEY ([ExpenseId])
);
GO


CREATE TABLE [Fees] (
    [FeeId] int IDENTITY(1,1) NOT NULL,
    [StudentId] int NOT NULL,
    [FeeType] nvarchar(100) NOT NULL,
    [Amount] decimal(12,2) NOT NULL,
    [Discount] decimal(12,2) NOT NULL DEFAULT ((0)),
    [PaidAmount] decimal(12,2) NOT NULL DEFAULT ((0)),
    [DueDate] date NULL,
    [PaymentDate] date NULL,
    [PaymentMode] nvarchar(50) NULL,
    [TransactionRef] nvarchar(100) NULL,
    [Status] nvarchar(20) NOT NULL DEFAULT ('Pending'),
    [Remarks] nvarchar(300) NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT ('2025-26'),
    CONSTRAINT [PK__Fees__B387B2296C029785] PRIMARY KEY ([FeeId])
);
GO


CREATE TABLE [FineDetails] (
    [FineId] int IDENTITY(1,1) NOT NULL,
    [IssueId] int NOT NULL,
    [StudentId] int NOT NULL,
    [BookId] int NOT NULL,
    [FineAmount] decimal(10,2) NOT NULL,
    [Remarks] nvarchar(300) NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    CONSTRAINT [PK__FineDeta__9D4A9B2C8753F86B] PRIMARY KEY ([FineId])
);
GO


CREATE TABLE [GatePasses] (
    [GatePassId] int IDENTITY(1,1) NOT NULL,
    [PersonType] nvarchar(20) NOT NULL DEFAULT ('Visitor'),
    [PassNo] nvarchar(30) NULL,
    [Name] nvarchar(120) NOT NULL,
    [Phone] nvarchar(20) NULL,
    [PhotoUrl] nvarchar(MAX) NULL,
    [StudentId] int NULL,
    [TeacherId] int NULL,
    [ReferenceNo] nvarchar(60) NULL,
    [WhomToMeet] nvarchar(120) NULL,
    [Purpose] nvarchar(60) NULL,
    [Reason] nvarchar(120) NULL,
    [ApprovedBy] nvarchar(120) NULL,
    [EntryAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [ExitAt] datetime2 NULL,
    [Remarks] nvarchar(MAX) NULL,
    [RecordedBy] int NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    CONSTRAINT [PK__GatePass__53AA30ACEC9653DB] PRIMARY KEY ([GatePassId])
);
GO


CREATE TABLE [Holidays] (
    [HolidayId] int IDENTITY(1,1) NOT NULL,
    [Title] nvarchar(150) NOT NULL,
    [Date] date NOT NULL,
    [EndDate] date NULL,
    [Description] nvarchar(MAX) NULL,
    [HolidayType] nvarchar(30) NOT NULL DEFAULT ('Holiday'),
    [IsEmergency] bit NOT NULL DEFAULT ((0)),
    [TargetType] nvarchar(20) NOT NULL DEFAULT ('All'),
    [TargetClassId] int NULL,
    [EmailSent] bit NOT NULL DEFAULT ((0)),
    [EmailCount] int NOT NULL DEFAULT ((0)),
    [CreatedBy] int NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    CONSTRAINT [PK__Holidays__2D35D57AF56D272C] PRIMARY KEY ([HolidayId])
);
GO


CREATE TABLE [IssuedBooks] (
    [IssueId] int IDENTITY(1,1) NOT NULL,
    [BookId] int NOT NULL,
    [StudentId] int NOT NULL,
    [IssueDate] date NOT NULL,
    [DueDate] date NOT NULL,
    [ReturnDate] date NULL,
    CONSTRAINT [PK__IssuedBo__6C861604E8CD7EDA] PRIMARY KEY ([IssueId])
);
GO


CREATE TABLE [Modules] (
    [ModuleId] int IDENTITY(1,1) NOT NULL,
    [ModuleName] nvarchar(100) NOT NULL,
    [DisplayName] nvarchar(80) NULL,
    [Route] nvarchar(120) NULL,
    [Icon] nvarchar(60) NULL,
    [SortOrder] int NOT NULL DEFAULT ((0)),
    [IsActive] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__Modules__2B7477A73B32BDBB] PRIMARY KEY ([ModuleId])
);
GO


CREATE TABLE [NoticeReads] (
    [NoticeReadId] int IDENTITY(1,1) NOT NULL,
    [NoticeId] int NOT NULL,
    [UserId] int NOT NULL,
    [ReadAt] datetime NOT NULL DEFAULT (getutcdate()),
    CONSTRAINT [PK__NoticeRe__1739789F486E0AD6] PRIMARY KEY ([NoticeReadId])
);
GO


CREATE TABLE [Notices] (
    [NoticeId] int IDENTITY(1,1) NOT NULL,
    [Title] nvarchar(200) NOT NULL,
    [Message] nvarchar(MAX) NOT NULL,
    [Priority] nvarchar(20) NOT NULL DEFAULT ('Normal'),
    [TargetRole] nvarchar(20) NOT NULL DEFAULT ('All'),
    [CreatedBy] int NULL,
    [CreatedByName] nvarchar(100) NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    [EmailSent] bit NOT NULL DEFAULT ((0)),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    CONSTRAINT [PK__Notices__CE83CBE518CC5164] PRIMARY KEY ([NoticeId])
);
GO


CREATE TABLE [Results] (
    [ResultId] int IDENTITY(1,1) NOT NULL,
    [ExamSubjectId] int NOT NULL,
    [StudentId] int NOT NULL,
    [MarksObtained] decimal(6,2) NULL,
    [IsAbsent] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    CONSTRAINT [PK__Results__97690208C46B4D72] PRIMARY KEY ([ResultId])
);
GO


CREATE TABLE [StudentHistories] (
    [HistoryId] int IDENTITY(1,1) NOT NULL,
    [StudentId] int NOT NULL,
    [ClassName] nvarchar(50) NULL,
    [SessionYear] nvarchar(20) NULL,
    [TotalMarks] decimal(6,2) NULL,
    [ObtainedMarks] decimal(6,2) NULL,
    [Percentage] decimal(5,2) NULL,
    [Result] nvarchar(20) NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    [UnitId] int NULL,
    CONSTRAINT [PK__StudentH__4D7B4ABD337D1DE2] PRIMARY KEY ([HistoryId])
);
GO


CREATE TABLE [Students] (
    [StudentId] int IDENTITY(1,1) NOT NULL,
    [UserId] int NULL,
    [AdmissionNo] nvarchar(50) NOT NULL,
    [RollNo] nvarchar(20) NULL,
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [DateOfBirth] date NULL,
    [Gender] nvarchar(10) NULL,
    [BloodGroup] nvarchar(5) NULL,
    [Email] nvarchar(150) NULL,
    [Phone] nvarchar(20) NULL,
    [Address] nvarchar(300) NULL,
    [ClassId] int NULL,
    [ParentName] nvarchar(200) NULL,
    [ParentPhone] nvarchar(20) NULL,
    [ParentEmail] nvarchar(150) NULL,
    [AdmissionDate] date NULL DEFAULT (CONVERT([date],getdate())),
    [AcademicYear] nvarchar(20) NOT NULL DEFAULT ('2025-26'),
    [IsActive] bit NOT NULL DEFAULT ((1)),
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [PhotoUrl] nvarchar(MAX) NULL,
    [Religion] nvarchar(30) NULL,
    [Category] nvarchar(30) NULL,
    [AadharNo] nvarchar(20) NULL,
    [FatherName] nvarchar(100) NULL,
    [MotherName] nvarchar(100) NULL,
    [FatherOccupation] nvarchar(100) NULL,
    [MotherOccupation] nvarchar(100) NULL,
    [EmergencyContact] nvarchar(20) NULL,
    [UnitId] int NULL,
    [PromotionStatus] nvarchar(30) NULL,
    [ExitReason] nvarchar(30) NULL,
    CONSTRAINT [PK__Students__32C52B99AA7A81A8] PRIMARY KEY ([StudentId])
);
GO


CREATE TABLE [Subjects] (
    [SubjectId] int IDENTITY(1,1) NOT NULL,
    [SubjectName] nvarchar(100) NOT NULL,
    [ClassId] int NOT NULL,
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    [IsDeleted] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    CONSTRAINT [PK__Subjects__AC1BA3A8BAF082BA] PRIMARY KEY ([SubjectId])
);
GO


CREATE TABLE [SupplementaryRecords] (
    [SupplementaryId] int IDENTITY(1,1) NOT NULL,
    [StudentId] int NOT NULL,
    [SubjectId] int NULL,
    [SubjectName] nvarchar(120) NULL,
    [FromClass] nvarchar(60) NOT NULL DEFAULT (''),
    [AcademicYear] nvarchar(9) NOT NULL DEFAULT (''),
    [MarksObtained] decimal(6,2) NULL,
    [PassingMarks] decimal(6,2) NULL,
    [Status] nvarchar(20) NOT NULL DEFAULT ('Pending'),
    [Remarks] nvarchar(MAX) NULL,
    [MarkedBy] int NULL,
    [DecidedAt] datetime2 NULL,
    [UnitId] int NULL,
    [CreatedAt] datetime2 NOT NULL DEFAULT (sysutcdatetime()),
    [SuppMarks] decimal(6,2) NULL,
    CONSTRAINT [PK__Suppleme__B7109E9D55409634] PRIMARY KEY ([SupplementaryId])
);
GO


CREATE TABLE [Teachers] (
    [TeacherId] int IDENTITY(1,1) NOT NULL,
    [UserId] int NULL,
    [EmployeeId] nvarchar(50) NOT NULL,
    [FirstName] nvarchar(100) NOT NULL,
    [LastName] nvarchar(100) NOT NULL,
    [Email] nvarchar(150) NOT NULL,
    [Phone] nvarchar(20) NULL,
    [Designation] nvarchar(100) NULL,
    [Specialization] nvarchar(200) NULL,
    [Salary] decimal(12,2) NOT NULL DEFAULT ((0)),
    [DateOfJoining] date NULL,
    [Address] nvarchar(300) NULL,
    [Gender] nvarchar(10) NULL,
    [IsActive] bit NOT NULL DEFAULT ((1)),
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [PhotoUrl] nvarchar(MAX) NULL,
    [Qualification] nvarchar(100) NULL,
    [DateOfBirth] date NULL,
    [ExperienceYears] int NULL,
    [BloodGroup] nvarchar(10) NULL,
    [MaritalStatus] nvarchar(20) NULL,
    [Religion] nvarchar(30) NULL,
    [Category] nvarchar(30) NULL,
    [EmergencyContact] nvarchar(20) NULL,
    [AadharNo] nvarchar(20) NULL,
    [UnitId] int NULL,
    CONSTRAINT [PK__Teachers__EDF25964F09DA898] PRIMARY KEY ([TeacherId])
);
GO


CREATE TABLE [Units] (
    [UnitId] int IDENTITY(1,1) NOT NULL,
    [UnitName] nvarchar(200) NOT NULL,
    [GstNo] nvarchar(30) NULL,
    [RegistrationNo] nvarchar(50) NULL,
    [PrincipalName] nvarchar(100) NULL,
    [Address] nvarchar(300) NULL,
    [City] nvarchar(80) NULL,
    [State] nvarchar(80) NULL,
    [Pincode] nvarchar(12) NULL,
    [Phone] nvarchar(20) NULL,
    [Email] nvarchar(120) NULL,
    [LogoUrl] nvarchar(MAX) NULL,
    [IsActive] bit NOT NULL DEFAULT ((1)),
    [CreatedAt] datetime NOT NULL DEFAULT (getutcdate()),
    CONSTRAINT [PK__Units__44F5ECB5B179706D] PRIMARY KEY ([UnitId])
);
GO


CREATE TABLE [Users] (
    [UserId] int IDENTITY(1,1) NOT NULL,
    [Username] nvarchar(100) NOT NULL,
    [PasswordHash] nvarchar(256) NOT NULL,
    [Role] nvarchar(20) NOT NULL,
    [Email] nvarchar(150) NULL,
    [IsActive] bit NOT NULL DEFAULT ((1)),
    [CreatedAt] datetime2 NOT NULL DEFAULT (getdate()),
    [IsBlocked] bit NOT NULL DEFAULT ((0)),
    [UnitId] int NULL,
    [EmailNotifications] bit NOT NULL DEFAULT ((1)),
    CONSTRAINT [PK__Users__1788CC4C428D05C3] PRIMARY KEY ([UserId])
);
GO


CREATE TABLE [UserSessions] (
    [SessionId] int IDENTITY(1,1) NOT NULL,
    [UserId] int NOT NULL,
    [Username] nvarchar(100) NOT NULL,
    [Role] nvarchar(20) NOT NULL,
    [LoginAt] datetime NOT NULL DEFAULT (getutcdate()),
    [LogoutAt] datetime NULL,
    [LogoutReason] nvarchar(20) NULL,
    [IpAddress] nvarchar(64) NULL,
    [LastSeenAt] datetime NOT NULL DEFAULT (getutcdate()),
    [DeviceId] nvarchar(80) NULL,
    CONSTRAINT [PK__UserSess__C9F49290157F29A7] PRIMARY KEY ([SessionId])
);
GO


-- ===================== FOREIGN KEYS =====================
ALTER TABLE [Attendance] ADD CONSTRAINT [FK__Attendanc__Marke__6C190EBB] FOREIGN KEY ([MarkedBy]) REFERENCES [Users] ([UserId]) ON DELETE SET NULL;
GO
ALTER TABLE [Authorities] ADD CONSTRAINT [FK_Authorities_Users] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE;
GO
ALTER TABLE [Authorities] ADD CONSTRAINT [FK_Authorities_Modules] FOREIGN KEY ([ModuleId]) REFERENCES [Modules] ([ModuleId]) ON DELETE CASCADE;
GO
ALTER TABLE [BusAssignments] ADD CONSTRAINT [FK_BusAssign_Buses] FOREIGN KEY ([BusId]) REFERENCES [Buses] ([BusId]) ON DELETE CASCADE;
GO
ALTER TABLE [BusAssignments] ADD CONSTRAINT [FK_BusAssign_Students] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]);
GO
ALTER TABLE [BusAssignments] ADD CONSTRAINT [FK_BusAssign_Stops] FOREIGN KEY ([StopId]) REFERENCES [BusStops] ([StopId]);
GO
ALTER TABLE [BusStops] ADD CONSTRAINT [FK_BusStops_Buses] FOREIGN KEY ([BusId]) REFERENCES [Buses] ([BusId]) ON DELETE CASCADE;
GO
ALTER TABLE [Classes] ADD CONSTRAINT [FK_Classes_Teacher] FOREIGN KEY ([ClassTeacherId]) REFERENCES [Teachers] ([TeacherId]) ON DELETE SET NULL;
GO
ALTER TABLE [Events] ADD CONSTRAINT [FK__Events__CreatedB__76969D2E] FOREIGN KEY ([CreatedBy]) REFERENCES [Users] ([UserId]) ON DELETE SET NULL;
GO
ALTER TABLE [Exams] ADD CONSTRAINT [FK_Exams_Classes] FOREIGN KEY ([ClassId]) REFERENCES [Classes] ([ClassId]) ON DELETE CASCADE;
GO
ALTER TABLE [ExamSubjects] ADD CONSTRAINT [FK_ExamSubjects_Exams] FOREIGN KEY ([ExamId]) REFERENCES [Exams] ([ExamId]) ON DELETE CASCADE;
GO
ALTER TABLE [ExamSubjects] ADD CONSTRAINT [FK_ExamSubjects_Subjects] FOREIGN KEY ([SubjectId]) REFERENCES [Subjects] ([SubjectId]);
GO
ALTER TABLE [Fees] ADD CONSTRAINT [FK__Fees__StudentId__5FB337D6] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]) ON DELETE CASCADE;
GO
ALTER TABLE [FineDetails] ADD CONSTRAINT [FK_FineDetails_IssuedBooks] FOREIGN KEY ([IssueId]) REFERENCES [IssuedBooks] ([IssueId]);
GO
ALTER TABLE [FineDetails] ADD CONSTRAINT [FK_FineDetails_Students] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]);
GO
ALTER TABLE [FineDetails] ADD CONSTRAINT [FK_FineDetails_Books] FOREIGN KEY ([BookId]) REFERENCES [Books] ([BookId]);
GO
ALTER TABLE [IssuedBooks] ADD CONSTRAINT [FK_IssuedBooks_Books] FOREIGN KEY ([BookId]) REFERENCES [Books] ([BookId]);
GO
ALTER TABLE [IssuedBooks] ADD CONSTRAINT [FK_IssuedBooks_Students] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]);
GO
ALTER TABLE [NoticeReads] ADD CONSTRAINT [FK_NoticeReads_Notices] FOREIGN KEY ([NoticeId]) REFERENCES [Notices] ([NoticeId]) ON DELETE CASCADE;
GO
ALTER TABLE [Results] ADD CONSTRAINT [FK_Results_ExamSubjects] FOREIGN KEY ([ExamSubjectId]) REFERENCES [ExamSubjects] ([ExamSubjectId]) ON DELETE CASCADE;
GO
ALTER TABLE [Results] ADD CONSTRAINT [FK_Results_Students] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]);
GO
ALTER TABLE [StudentHistories] ADD CONSTRAINT [FK_StudentHistories_Students] FOREIGN KEY ([StudentId]) REFERENCES [Students] ([StudentId]) ON DELETE CASCADE;
GO
ALTER TABLE [Students] ADD CONSTRAINT [FK__Students__UserId__38996AB5] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE SET NULL;
GO
ALTER TABLE [Students] ADD CONSTRAINT [FK__Students__ClassI__3A81B327] FOREIGN KEY ([ClassId]) REFERENCES [Classes] ([ClassId]) ON DELETE SET NULL;
GO
ALTER TABLE [Subjects] ADD CONSTRAINT [FK_Subjects_Classes] FOREIGN KEY ([ClassId]) REFERENCES [Classes] ([ClassId]) ON DELETE CASCADE;
GO
ALTER TABLE [Teachers] ADD CONSTRAINT [FK__Teachers__UserId__300424B4] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE SET NULL;
GO
ALTER TABLE [UserSessions] ADD CONSTRAINT [FK_UserSessions_Users] FOREIGN KEY ([UserId]) REFERENCES [Users] ([UserId]) ON DELETE CASCADE;
GO
