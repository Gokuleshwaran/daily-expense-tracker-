---
name: db-schema-change
description: Safely add or change database tables, columns or indexes for this expense tracker's Supabase PostgreSQL database. Use whenever a feature needs to store new data.
---

# Change the database schema

The schema lives in `backend/src/schema.ts` (`SCHEMA_SQL`) and runs **on every server start**
against the live Supabase database. So every statement must be safe to run again and again,
and must never delete user data.

## Rules

1. **Idempotent only.** Use:
   - `CREATE TABLE IF NOT EXISTS …`
   - `ALTER TABLE … ADD COLUMN IF NOT EXISTS …`
   - `CREATE INDEX IF NOT EXISTS …`
2. **Never** add `DROP TABLE`, `DROP COLUMN`, `TRUNCATE` or `DELETE` to `schema.ts`.
   If something really must be removed, stop and ask the user. It needs a manual,
   one-off step in the Supabase SQL editor with a backup first.
3. New columns on existing tables must be **nullable or have a DEFAULT**, because old rows already exist.
4. Every new user-owned table needs:
   - `user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE`
   - an index on `user_id` (plus `date` if you query by date)
   - `ALTER TABLE <name> ENABLE ROW LEVEL SECURITY;` so Supabase's public Data API can't read it
     (the backend connects as the table owner, so it is unaffected)
5. Money is `NUMERIC(12,2)`; dates are `DATE`; timestamps are `TIMESTAMPTZ DEFAULT NOW()`.
   (`db.ts` already returns NUMERIC as `number` and DATE as `'YYYY-MM-DD'`.)

## Steps

1. Append the SQL to `SCHEMA_SQL` in `backend/src/schema.ts`, after the related table.
2. Update the row types in `backend/src/types/models.ts`, and `frontend/lib/types.ts` if the
   field is sent to the browser.
3. Update every `SELECT` that should return the new column (check `routes/*.ts`, especially the
   shared `SELECT` constant in `routes/expenses.ts`).
4. Restart the backend (`npm run dev`) and confirm it logs `API running…`, which means the SQL ran.
5. Ask the user to check the table in Supabase → **Table Editor**.
6. `npm run typecheck` in `backend/` (and `frontend/` if types changed).
