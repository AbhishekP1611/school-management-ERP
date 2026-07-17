# School ERP — Entity-Relationship Diagram

> 31 tables. Diagram rendered with **Mermaid** — it displays automatically on GitHub, in VS Code
> (with the *Markdown Preview Mermaid* extension), and on any Mermaid-aware viewer.
>
> **Legend**
> - **Solid line** (`||--o{`) = a real foreign-key constraint enforced in the database.
> - **Dotted line** (`..o{`) = a *logical* reference (the column points at another table by
>   business rule, but there is **no** DB-level FK constraint — e.g. every `UnitId`, and the
>   polymorphic `Attendance.ReferenceId`). These are enforced only in application code.
> - `PK` = primary key, `FK` = foreign key, `UK` = unique key.

---

## 1) Core academic backbone

The heart of the system: **Units → Users → Students / Teachers → Classes → Exams → Results**.

```mermaid
erDiagram
    Units      ||--o{ Users     : "scopes (logical)"
    Users      ||--o| Teachers  : "is (1-1, SetNull)"
    Users      ||--o| Students  : "is (1-1, SetNull)"
    Teachers   ||--o{ Classes   : "class-teacher of (SetNull)"
    Classes    ||--o{ Students  : "enrolls (SetNull)"
    Classes    ||--o{ Subjects  : "has (Cascade)"
    Classes    ||--o{ Exams     : "holds (Cascade)"
    Exams      ||--o{ ExamSubjects : "covers (Cascade)"
    Subjects   ||--o{ ExamSubjects : "graded in (Restrict)"
    ExamSubjects ||--o{ Results  : "produces (Cascade)"
    Students   ||--o{ Results   : "scores (Restrict)"
    Students   ||--o{ StudentHistories : "past years (Cascade)"

    Units {
        int UnitId PK
        string UnitName
        string PrincipalName
        string City
    }
    Users {
        int UserId PK
        string Username UK
        string PasswordHash
        string Role
        bool IsActive
        bool IsBlocked
        int UnitId "logical FK"
    }
    Teachers {
        int TeacherId PK
        int UserId FK "1-1"
        string EmployeeId UK
        string FirstName
        string LastName
        decimal Salary
    }
    Students {
        int StudentId PK
        int UserId FK "1-1"
        string AdmissionNo UK
        string RollNo
        string FirstName
        int ClassId FK
        string AcademicYear
        string PromotionStatus
    }
    Classes {
        int ClassId PK
        string ClassName UK
        string Section UK
        string AcademicYear UK
        int ClassTeacherId FK
    }
    Subjects {
        int SubjectId PK
        int ClassId FK
        string SubjectName
    }
    Exams {
        int ExamId PK
        int ClassId FK
        string ExamName
        string AcademicYear
    }
    ExamSubjects {
        int ExamSubjectId PK
        int ExamId FK
        int SubjectId FK
        decimal MaxMarks
        decimal PassingMarks
    }
    Results {
        int ResultId PK
        int ExamSubjectId FK
        int StudentId FK
        decimal MarksObtained
        bool IsAbsent
    }
    StudentHistories {
        int HistoryId PK
        int StudentId FK
        string SessionYear
        decimal Percentage
        string Result
    }
```

---

## 2) Fees, Finance & Promotion

```mermaid
erDiagram
    Students ||--o{ Fees                 : "billed (Cascade)"
    Students ||--o{ SupplementaryRecords : "re-exam (Cascade)"

    Fees {
        int FeeId PK
        int StudentId FK
        string FeeType
        decimal Amount
        decimal PaidAmount
        string Status
        string AcademicYear
    }
    SupplementaryRecords {
        int SupplementaryId PK
        int StudentId FK
        string SubjectName
        decimal SuppMarks
        string Status
        string AcademicYear
    }
    Budgets {
        int BudgetId PK
        string Category
        decimal PlannedAmount
        string Period
        string AcademicYear
    }
    Expenses {
        int ExpenseId PK
        string Category
        decimal Amount
        string ExpenseType
        date ExpenseDate
        string AcademicYear
    }
```

> **Budgets** and **Expenses** are standalone finance ledgers (no FK to other tables) — they are
> grouped by `Category` + `AcademicYear` in the Finance module. Fee income vs. Expenses drives the
> profit/loss reports.

---

## 3) Library

```mermaid
erDiagram
    Books       ||--o{ IssuedBooks  : "issued as (Restrict)"
    Students    ||--o{ IssuedBooks  : "borrows (Restrict)"
    IssuedBooks ||--o{ FineDetails  : "overdue → fine (Restrict)"
    Books       ||--o{ FineDetails  : "of book (Restrict)"
    Students    ||--o{ FineDetails  : "owes (Restrict)"

    Books {
        int BookId PK
        string BookName
        string Author
        decimal Price
        bool IsAvailable
    }
    IssuedBooks {
        int IssueId PK
        int BookId FK
        int StudentId FK
        date IssueDate
        date DueDate
        date ReturnDate
    }
    FineDetails {
        int FineId PK
        int IssueId FK
        int BookId FK
        int StudentId FK
        decimal FineAmount
    }
```

---

## 4) Transport

```mermaid
erDiagram
    Buses          ||--o{ BusStops        : "route of (Cascade)"
    Buses          ||--o{ BusAssignments  : "carries (Cascade)"
    BusStops       ||--o{ BusAssignments  : "boards at (Restrict)"
    Students       ||--o| BusAssignments  : "rides (1 bus each, Cascade)"

    Buses {
        int BusId PK
        string BusNumber UK
        string DriverName
        int Capacity
        string Route
    }
    BusStops {
        int StopId PK
        int BusId FK
        string StopName
        int StopOrder
        float Latitude
        float Longitude
    }
    BusAssignments {
        int AssignmentId PK
        int BusId FK
        int StudentId FK "UNIQUE"
        int StopId FK
        date AssignedDate
    }
```

> `BusAssignments.StudentId` is **UNIQUE** → a student can be on at most one bus. This join table is
> the *single source of truth* for a student's bus (there is no `Student.BusId` column).

---

## 5) RBAC (permissions), sessions & activity

```mermaid
erDiagram
    Users   ||--o{ Authorities  : "granted (Cascade)"
    Modules ||--o{ Authorities  : "gates (Cascade)"
    Users   ||--o{ UserSessions : "logs in (logical)"
    Notices ||--o{ NoticeReads  : "read receipt (Cascade)"
    Users   ||--o{ NoticeReads  : "reads (logical)"

    Users {
        int UserId PK
        string Username UK
        string Role
    }
    Modules {
        int ModuleId PK
        string ModuleName UK
        string DisplayName
        string Route
        string Icon
        int SortOrder
        bool IsActive
    }
    Authorities {
        int AuthorityId PK
        int UserId FK
        int ModuleId FK
        bool CanView
        bool CanCreate
        bool CanEdit
        bool CanDelete
    }
    UserSessions {
        int SessionId PK
        int UserId "logical FK"
        datetime LoginAt
        datetime LogoutAt
        string DeviceId
        datetime LastSeenAt
    }
    ActivityLogs {
        int LogId PK
        int UserId "logical FK"
        string Module
        string Action
        datetime CreatedAt
    }
    Notices {
        int NoticeId PK
        string Title
        string TargetRole
    }
    NoticeReads {
        int NoticeReadId PK
        int NoticeId FK
        int UserId
    }
```

> **`Authorities`** is the whole RBAC system: one row per (User × Module) with 4 boolean flags.
> `[RequirePermission("Module", Action)]` on each endpoint checks exactly this table — **no role is
> ever hard-coded**. `Modules` drives the sidebar (`IsActive` + `SortOrder`).

---

## 6) Standalone / operational tables

These tables are gated by their own module but link to the rest only *logically* (mostly via `UnitId`
and optional creator ids):

```mermaid
erDiagram
    Students ||--o| GatePasses : "visitor is (SetNull)"
    Teachers ||--o| GatePasses : "visitor is (SetNull)"
    Classes  ||--o| Holidays   : "targets (SetNull)"

    GatePasses {
        int GatePassId PK
        string PersonType
        string Name
        int StudentId FK
        int TeacherId FK
        datetime EntryAt
        datetime ExitAt
    }
    Holidays {
        int HolidayId PK
        string Title
        date Date
        string HolidayType
        int TargetClassId FK
    }
    Assets {
        int AssetId PK
        string AssetName
        string Category
        int Quantity
        decimal UnitPrice
        date WarrantyUntil
        string Condition
    }
    Events {
        int EventId PK
        string EventTitle
        date EventDate
        string EventType
    }
    Attendance {
        int AttendanceId PK
        int ReferenceId "Student OR Teacher (polymorphic)"
        string ReferenceType
        date AttendanceDate
        string Status
    }
```

> **`Attendance`** is polymorphic: `ReferenceId` points at a **Student** or a **Teacher** depending
> on `ReferenceType` — so there is no single FK. It is uniquely keyed on
> `(ReferenceId, ReferenceType, AttendanceDate)`.
>
> **`Assets`** (Inventory) and **`Events`** stand alone except for the multi-tenant `UnitId`.

---

## Multi-tenant note (`UnitId`)

Almost every operational table carries a nullable **`UnitId`** that logically points to `Units`.
There is **no DB foreign-key** on any of these — unit isolation is enforced entirely in application
code via the `UnitScope` helper (a SuperAdmin sees all units; every other user is narrowed to their
own `UnitId`). Tables with a logical `UnitId`: Users, Classes, Teachers, Students, Fees, Attendance,
Buses, Events, Subjects, Exams, Books, Notices, Holidays, GatePasses, Budgets, Expenses,
SupplementaryRecords, Assets.
