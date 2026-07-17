# 🎓 School ERP System

A complete, multi-tenant school management system — students, teachers, classes, exams & results,
fees & finance, library, transport, attendance, inventory, gate passes, events, notices — with a
fine-grained, **purely permission-based** access-control system.

**Two apps + one database:**

| Part | Tech | Folder | URL |
|------|------|--------|-----|
| Backend API | .NET 10 · EF Core · SQL Server | [`school erp/`](./school%20erp) | http://localhost:5099 |
| Frontend | Next.js 15 · React 19 | [`school-erp-next/`](./school-erp-next) | http://localhost:3000 |
| Database | SQL Server (full SQL dump) | [`Database/`](./Database) | — |

> The backend is a JSON API only — open **http://localhost:3000** in the browser (not 5099).

---

## 📚 Documentation

| Doc | What's inside |
|-----|---------------|
| **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** | How everything is wired: the request lifecycle, and the 4 rules that govern every page — **Auth (JWT) → RBAC → Academic-year scoping → Single-session**. Includes sequence & flow diagrams. |
| **[docs/ER_DIAGRAM.md](./docs/ER_DIAGRAM.md)** | Entity-relationship diagrams (Mermaid) for all 31 tables, grouped by area, with FK vs. logical-reference legend. |
| **[docs/DATABASE.md](./docs/DATABASE.md)** | Table dictionary (all 31 tables) + how to restore the DB from `Database/SchoolERP_full.sql`. |

---

## 🚀 Run it locally

### 1. Database
Restore the full dump into SQL Server (see [docs/DATABASE.md](./docs/DATABASE.md)):

```powershell
sqlcmd -S "YOURPC\SQLEXPRESS" -U <user> -P <pwd> -C -Q "CREATE DATABASE SchoolERP;"
sqlcmd -S "YOURPC\SQLEXPRESS" -U <user> -P <pwd> -C -d SchoolERP -i "Database\SchoolERP_full.sql"
```

Set the connection string in `school erp/appsettings.Development.json`.

### 2. Backend (port 5099)
```powershell
cd "school erp"
dotnet run --urls "http://localhost:5099"
```
On first start `DbSeeder` idempotently patches in any newer tables/columns.

### 3. Frontend (port 3000)
```powershell
cd school-erp-next
npm install
npm run dev
```

Open **http://localhost:3000** and log in.

---

## 🧭 What's inside (feature modules)

Dashboard · Students · Teachers · Classes · Academics (subjects/exams/results) · Fees ·
Finance (budgets/expenses/P&L) · Library · Attendance · Transport (buses/routes/stops) ·
Promotion · Inventory/Assets · Gate passes · Events · Notices · Calendar/Holidays ·
Users & Access (RBAC) · Modules registry · Activity Monitor · Units.

Each is an RBAC **module** — a user only sees the ones an admin has granted them, and the sidebar,
landing page, and every button adapt to that automatically.

---

## 🔑 Key design decisions

- **Pure ID-based RBAC.** Access = rows in the `Authorities` table (`CanView/Create/Edit/Delete`
  per user × module). **No role is ever hard-coded.** A last-admin safety net prevents lock-out.
- **Table-driven navigation.** The `Modules` table (DisplayName/Route/Icon/SortOrder/IsActive)
  drives the sidebar — add or reorder a module in the `/modules` screen, no code change.
- **Multi-tenant by `UnitId`.** Every operational row carries a unit; non-SuperAdmins are scoped to
  their own unit in code (`UnitScope`).
- **Academic-year aware.** A global year filter (April–March) re-scopes students, fees, exams,
  results, finance & dashboard; master data (classes) stays year-agnostic.
- **Single-session.** One device at a time, 8-hour absolute token cap, instant kick on block.
- **Script-first schema.** Schema comes from SQL scripts (in `Database/`), new columns via
  idempotent `DbSeeder` patches — **not** EF migrations.

See [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) for the full picture.
