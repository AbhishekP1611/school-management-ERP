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
