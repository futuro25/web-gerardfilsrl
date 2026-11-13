-- Gastos con tarjeta de crédito. Se manejan aparte de los movimientos de
-- Control (account_movements): no impactan en saldos ni en el listado de Control.
-- image_key = key del archivo (imagen / PDF) en el bucket "invoices" de Cloudflare R2.
CREATE TABLE IF NOT EXISTS credit_card_expenses (
  id SERIAL PRIMARY KEY,
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC,
  image_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ
);

-- Por si la tabla ya se había creado sin importe.
ALTER TABLE credit_card_expenses ADD COLUMN IF NOT EXISTS amount NUMERIC;

CREATE INDEX IF NOT EXISTS idx_credit_card_expenses_date ON credit_card_expenses (date);
CREATE INDEX IF NOT EXISTS idx_credit_card_expenses_deleted_at ON credit_card_expenses (deleted_at);
