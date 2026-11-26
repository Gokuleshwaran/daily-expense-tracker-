// Database tables. Runs automatically on server start (safe to run many times).
// Kept as a TypeScript string so it is included in the compiled `dist/` build.

export const SCHEMA_SQL = /* sql */ `
CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  password_hash  TEXT NOT NULL,
  currency       TEXT NOT NULL DEFAULT 'INR',
  monthly_budget NUMERIC(12,2),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS categories (
  id         SERIAL PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL DEFAULT '#6366f1',
  icon       TEXT NOT NULL DEFAULT '💸',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, name)
);

CREATE TABLE IF NOT EXISTS expenses (
  id             SERIAL PRIMARY KEY,
  user_id        INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  amount         NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  date           DATE NOT NULL,
  note           TEXT,
  payment_method TEXT NOT NULL DEFAULT 'UPI',
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_expenses_user_date ON expenses (user_id, date);

-- Supabase: turn on Row Level Security so these tables can't be read through
-- Supabase's public Data API. Our Express server connects as the table owner,
-- so it still has full access.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
`;
