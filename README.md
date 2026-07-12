# AssetFlow

Enterprise asset and resource management system, built for the Odoo Hackathon 2026 virtual round.

**Live demo**: [https://assetflow-hchr.onrender.com](https://assetflow-hchr.onrender.com) — sign in with `maya.okafor@northwind.io` / `assetflow` (admin). Free-tier hosting sleeps when idle, so the first load can take up to a minute.

AssetFlow answers three questions every organization struggles with: who holds which asset right now, is this room or vehicle free at 3 PM, and did that repair actually get approved before someone opened the machine. It replaces spreadsheets and paper logs with a single system covering asset lifecycle, allocation with conflict rules, time-slot resource booking, maintenance approval, periodic audit cycles, reports, and a live notification feed.

## Team

| Member | GitHub |
|---|---|
| Rudraksh Bharti (lead) | [CTAGRAM](https://github.com/CTAGRAM) |
| Parth Kale | [Parth-Kale-2008](https://github.com/Parth-Kale-2008) |
| Tanishq Aryan | [Dexterous-Ruler](https://github.com/Dexterous-Ruler) |

## What is built

All ten functional areas of the problem statement work end to end against the live database:

- **Auth**: email + password with bcrypt hashes and JWT sessions. Signup always creates an Employee; only an admin grants roles, from the Employee Directory. Field-level validation with specific messages, identical error for wrong email vs wrong password.
- **Roles**: Admin, Asset Manager, Department Head, Employee. Enforced in the API on every route and reflected in the UI (navigation and actions adapt to the signed-in user's role).
- **Organization setup**: departments with hierarchy and heads, asset categories with per-category custom fields, employee directory with promotion and deactivation.
- **Asset registry**: auto-generated tags (AF-0001), search and filters, full per-asset allocation and maintenance history, lifecycle statuses from Available to Disposed.
- **Allocation and transfer**: allocating a held asset is blocked with the holder's name and a transfer suggestion; transfer approval closes the old allocation and opens the new one atomically; returns with condition notes; overdue flagging.
- **Resource booking**: time-slot bookings where overlaps are rejected by the database itself (back-to-back slots are fine), with cancel and reschedule.
- **Maintenance**: raise, approve or reject, assign technician, start, resolve. The asset's status follows the pipeline automatically.
- **Audit cycles**: scoped cycles, assigned auditors, per-asset Verified / Missing / Damaged verdicts, discrepancy report, and close-with-consequences (confirmed missing becomes Lost).
- **Reports**: dashboard KPIs, 90-day utilization, maintenance frequency, booking heatmap, department allocation.
- **Notifications and activity log**: every assignment, decision, overdue return, booking reminder and audit flag notifies the right people; the feed and unread badge poll live. A full who-did-what activity trail is kept.

## Stack

- **Database**: PostgreSQL 16. Local, no BaaS.
- **Backend**: Node.js (Express 5), raw SQL through node-postgres. No ORM: the schema is the source of truth and every query is visible and explainable.
- **Frontend**: React with Vite, plain CSS.
- **Auth**: bcrypt + JWT. No third-party services anywhere in the stack.

## Design principle

Business rules live in the database first and the application second. If a rule can be a constraint, it is one, because a constraint cannot be forgotten by a new endpoint:

- An asset can have at most one open allocation: a partial unique index on `allocations(asset_id) where returned_at is null`.
- Two bookings for the same resource can never overlap: a Postgres `EXCLUDE` constraint on `(asset_id, slot)` over `tstzrange`, which holds even under concurrent requests.
- Lifecycle states are Postgres enums, so an invalid state is unrepresentable.

The API translates constraint violations into friendly messages ("Laptop AF-0114 is currently held by Priya, raise a transfer request instead") and adds the rules that need context: role checks and status transitions.

Full DDL in [server/db/schema.sql](server/db/schema.sql), endpoint contract in [docs/api.md](docs/api.md), original UI prototypes in [design/](design/).

## Getting started

Prerequisites: Node 20+, PostgreSQL 16.

```bash
# database
createdb assetflow
psql -d assetflow -f server/db/schema.sql
psql -d assetflow -f server/db/seed.sql     # optional demo company

# backend
cd server
cp .env.example .env    # adjust DATABASE_URL if needed
npm install
npm run dev             # http://localhost:3000

# frontend (dev)
cd ../client
npm install
npm run dev             # http://localhost:5173
```

Demo sign-in (after seeding): any seeded user, e.g. `maya.okafor@northwind.io` (admin), `daniel.reyes@northwind.io` (asset manager), `aisha.bello@northwind.io` (employee) — shared password `assetflow`. Or bootstrap your own admin with `npm run create-admin -- "Your Name" you@company.com yourpassword`.

## Production build

The API server serves the built client, one origin, one process:

```bash
cd client && npm run build
cd ../server && node src/index.js   # app + API on :3000
```

### Deploying to Render

[render.yaml](render.yaml) is a ready blueprint: connect the repo in Render (New > Blueprint), it provisions the web service and a managed Postgres and wires `DATABASE_URL` and `JWT_SECRET`. After the first deploy, load the schema once from the database's psql shell:

```bash
psql <render-external-url> -f server/db/schema.sql -f server/db/seed.sql
```

## Repository layout

```
server/          Express API (one route module per resource)
  db/            schema.sql, seed.sql
client/          React app (Vite)
docs/api.md      endpoint contract
design/          exported UI prototypes the screens were built from
```

## Conventions

- Single branch (`main`), always runnable. Small commits, every member commits their own work.
- Raw SQL only, parameterized everywhere. String-built SQL does not pass review.
- Validate at the trust boundary: every route checks its input and returns a specific message, never a bare 500.
