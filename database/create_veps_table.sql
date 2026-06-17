-- VEPs (Volantes Electrónicos de Pago)
CREATE TABLE IF NOT EXISTS veps (
  id SERIAL PRIMARY KEY,
  amount NUMERIC NOT NULL,
  due_date DATE NOT NULL,
  category TEXT NOT NULL,
  custom_category TEXT,
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_veps_due_date ON veps (due_date);
CREATE INDEX IF NOT EXISTS idx_veps_deleted_at ON veps (deleted_at);
CREATE INDEX IF NOT EXISTS idx_veps_paid_at ON veps (paid_at);

COMMENT ON COLUMN veps.category IS 'IIBB | Seguridad e Higiene | Cargas Sociales | IVA | Sindicato | Impuesto a las ganancias | Bienes Personales | Otros';
COMMENT ON COLUMN veps.custom_category IS 'Descripción cuando category = Otros';
