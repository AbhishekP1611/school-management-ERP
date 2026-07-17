# School ERP — Database Guide

The full database (schema **and** data) lives in the **`Database/`** folder as plain SQL scripts, so
the whole thing can be recreated on any SQL Server without a backup file.

---

## Files in `Database/`

| File | What it is |
|------|-----------|
| **`SchoolERP_full.sql`** | **The one file you want.** Complete DB: all 31 `CREATE TABLE`s + primary keys, then every row as `INSERT` (with `IDENTITY_INSERT`), then all foreign keys added last. Run against a fresh DB to reproduce the system exactly. |
| `01_schema.sql` | Just the tables + primary keys + foreign keys (structure only, no data). |
| `02_data.sql` | Just the data (`INSERT` statements). |
| `03_foreign_keys.sql` | Just the FK constraints (added after data so load order never breaks). |
| `SchoolERP_Database.sql`, `Add*.sql` | The original hand-written base script + historical feature patches (RBAC, Library, Multi-unit, …). Kept for reference. |

---

## Restore into a fresh database

**SSMS / Azure Data Studio:** open a new query on the server and run:

```sql
CREATE DATABASE SchoolERP;
GO
USE SchoolERP;
GO
```

then open `SchoolERP_full.sql` and execute it.

**Command line (sqlcmd):**

```powershell
sqlcmd -S "YOURPC\SQLEXPRESS" -U <user> -P <pwd> -C -Q "CREATE DATABASE SchoolERP;"
sqlcmd -S "YOURPC\SQLEXPRESS" -U <user> -P <pwd> -C -d SchoolERP -i "Database\SchoolERP_full.sql"
```

The connection string used by the API is in `school erp/appsettings.Development.json` →
`ConnectionStrings:DefaultConnection`.

---

## Table dictionary (31 tables)

Grouped by area. `PK` primary key · `FK` foreign key · `UK` unique.

### Identity, access & audit
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Units** | 2 | UnitId PK | Branches/campuses (multi-tenant root). |
| **Users** | 3 | UserId PK · Username UK | Login accounts (BCrypt hash, Role, IsActive/IsBlocked). |
| **Modules** | 20 | ModuleId PK · ModuleName UK | Feature registry; drives sidebar (DisplayName/Route/Icon/SortOrder/IsActive). |
| **Authorities** | 40 | AuthorityId PK · (UserId,ModuleId) UK | RBAC matrix: 4 booleans per user×module. |
| **UserSessions** | 55 | SessionId PK | Live-login tracking (DeviceId, LoginAt/LogoutAt, LastSeenAt). |
| **ActivityLogs** | 284 | LogId PK | Audit trail of every write action. |

### People & academics
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Teachers** | 20 | TeacherId PK · EmployeeId UK · UserId FK | Staff records (HR fields, salary). |
| **Students** | 52 | StudentId PK · AdmissionNo UK · ClassId FK | Student master (year-scoped by AcademicYear). |
| **Classes** | 19 | ClassId PK · (ClassName,Section,Year) UK | Class/section master (year-agnostic list). |
| **Subjects** | — | SubjectId PK · ClassId FK | Subjects per class. |
| **Exams** | — | ExamId PK · ClassId FK | Exams per class per year. |
| **ExamSubjects** | — | ExamSubjectId PK · ExamId FK · SubjectId FK | Which subjects an exam covers + max/pass marks. |
| **Results** | — | ResultId PK · ExamSubjectId FK · StudentId FK | Marks per student per exam-subject. |
| **StudentHistories** | 3 | HistoryId PK · StudentId FK | Past-year result summary per student. |
| **SupplementaryRecords** | — | SupplementaryId PK · StudentId FK | Re-exam / supplementary tracking. |

### Money
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Fees** | 54 | FeeId PK · StudentId FK | Fee bills & payments (year-scoped). |
| **Budgets** | — | BudgetId PK | Planned amounts per category/year. |
| **Expenses** | — | ExpenseId PK | Actual spends per category/year. |

### Library
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Books** | 30 | BookId PK | Catalogue (name, author, price). |
| **IssuedBooks** | 1 | IssueId PK · BookId FK · StudentId FK | Issue/return records. |
| **FineDetails** | 1 | FineId PK · IssueId FK | Overdue fines. |

### Transport
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Buses** | 10 | BusId PK · BusNumber UK | Vehicles + driver + route summary. |
| **BusStops** | 54 | StopId PK · BusId FK | Ordered stops with lat/long. |
| **BusAssignments** | 3 | AssignmentId PK · StudentId UK | Student→bus→stop (one bus per student; sole source of truth). |

### Operations
| Table | Rows* | Key columns | Purpose |
|-------|------:|-------------|---------|
| **Attendance** | 24 | AttendanceId PK · (Ref,RefType,Date) UK | Daily attendance; polymorphic (Student **or** Teacher). |
| **Assets** | 20 | AssetId PK | Inventory: what/how-many/cost/warranty/condition. |
| **GatePasses** | 1 | GatePassId PK | Visitor/gate in-out log (audit; no delete). |
| **Holidays** | — | HolidayId PK · TargetClassId FK | School calendar / holiday declarations. |
| **Events** | 10 | EventId PK | School events & notices (dates, venue, type). |
| **Notices** | 2 | NoticeId PK | Announcements broadcast to roles. |
| **NoticeReads** | 1 | NoticeReadId PK · NoticeId FK | Per-user read receipts. |

\* *Row counts are from the current dump and are illustrative sample data.*

---

## Key modelling notes

- **`UnitId` everywhere, FK nowhere.** ~18 tables carry a nullable `UnitId` pointing at `Units`, but
  there is **no** database FK on it — multi-tenant isolation is enforced in code (`UnitScope`), which
  keeps SuperAdmin cross-unit queries simple.
- **`Attendance` is polymorphic.** `ReferenceId` + `ReferenceType` point at a Student *or* a Teacher,
  so no single FK; uniqueness is `(ReferenceId, ReferenceType, AttendanceDate)`.
- **One bus per student.** `BusAssignments.StudentId` is UNIQUE; there is deliberately no
  `Student.BusId` column — the assignment table is the only source of truth.
- **Many-to-many via join entities.** Exam↔Subject (`ExamSubjects`), User↔Module (`Authorities`),
  Notice↔User (`NoticeReads`), Student↔Bus (`BusAssignments`).
- **Delete behaviour** is configured per relationship (Cascade / SetNull / Restrict) — see
  `AppDbContext.OnModelCreating` and the FK section of `SchoolERP_full.sql`.

For the visual relationships, see **[ER_DIAGRAM.md](./ER_DIAGRAM.md)**.
