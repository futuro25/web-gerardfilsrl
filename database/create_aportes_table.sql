CREATE TABLE IF NOT EXISTS aportes (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  contributor TEXT NOT NULL CHECK (contributor IN ('Carolina', 'Jose Maria', 'Walter')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_aportes_date ON aportes (date);
CREATE INDEX IF NOT EXISTS idx_aportes_deleted_at ON aportes (deleted_at);
