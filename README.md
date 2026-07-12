# AssetFlow

Enterprise asset and resource management system, built for the Odoo Hackathon 2026 virtual round.

AssetFlow answers three questions every organization struggles with: who holds which asset right now, is this room or vehicle free at 3 PM, and did that repair actually get approved before someone opened the machine. It replaces spreadsheets and paper logs with a single system covering asset lifecycle, allocation with conflict rules, time-slot resource booking, maintenance approval, and periodic audit cycles.

## Team

| Member | GitHub |
|---|---|
| Rudraksh Bharti (lead) | CTAGRAM |
| Parth Kale | |
| Tanishq Aryan | |

## Stack

- **Database**: PostgreSQL 16. Local, no BaaS.
- **Backend**: Node.js (Express), raw SQL through node-postgres. No ORM: the schema is the source of truth and every query is visible and explainable.
- **Frontend**: React with Vite.
- **Auth**: email + password, bcrypt hashes, JWT sessions.

## Design principle

Business rules live in the database first and the application second. If a rule can be a constraint, it is one, because a constraint cannot be forgotten by a new endpoint:

- An asset can have at most one open allocation. Enforced by a partial unique index on `allocations(asset_id) where returned_at is null`, not by a lookup the API might skip.
- Two bookings for the same resource can never overlap. Enforced by a Postgres `EXCLUDE` constraint on `(asset_id, slot)` using `tstzrange`, so a conflicting insert fails inside the database even under concurrent requests.
- Lifecycle states (asset, maintenance, booking, transfer) are Postgres enums, so an invalid state is unrepresentable.

The API layer translates those constraint violations into friendly errors ("Laptop AF-0114 is currently held by Priya, raise a transfer request instead") and adds the rules that need context, like role checks and status transitions.

## Data model

Full DDL in [server/db/schema.sql](server/db/schema.sql).

| Table | Purpose |
|---|---|
| `departments` | Org units, optional parent for hierarchy, optional head |
| `users` | Employees. Signup always creates role `employee`; only an admin promotes |
| `asset_categories` | Categories plus a JSON definition of category-specific fields (e.g. warranty months) |
| `assets` | Registry with auto tag (AF-0001), status enum for the full lifecycle |
| `allocations` | Who holds what, expected return date, return notes. One open row per asset |
| `transfer_requests` | Requested / approved / rejected handovers of an open allocation |
| `bookings` | Time-slot bookings of shared resources, overlap-proof at the DB level |
| `maintenance_requests` | Pending, approved, assigned, in progress, resolved. Approval gates the work |
| `audit_cycles` / `audit_assignments` / `audit_records` | Structured verification rounds with per-asset verdicts |
| `notifications` | In-app notifications per user |
| `activity_log` | Who did what, when, on which entity |

## Getting started

Prerequisites: Node 20+, PostgreSQL 16.

```bash
# database
createdb assetflow
psql -d assetflow -f server/db/schema.sql

# backend
cd server
cp .env.example .env   # adjust DATABASE_URL if needed
npm install
npm run create-admin -- "Your Name" admin@company.com yourpassword
npm run dev            # http://localhost:3000/api/health

# frontend
cd ../client
npm install
npm run dev            # http://localhost:5173
```

## Repository layout

```
server/          Express API
  db/schema.sql  full schema, constraints included
  src/           routes, one file per resource
client/          React app (Vite)
```

## Conventions

- Single branch (`main`), always runnable. Small commits, pushed at least hourly.
- Every member commits their own work under their own identity.
- Raw SQL only, parameterized queries everywhere. String-built SQL does not pass review.
- Validate at the trust boundary: every route checks its input and returns a specific message, never a bare 500.
