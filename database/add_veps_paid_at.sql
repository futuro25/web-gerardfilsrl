-- Estado de pago del VEP (NULL = pendiente).
ALTER TABLE veps
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_veps_paid_at ON veps (paid_at);

COMMENT ON COLUMN veps.paid_at IS 'Fecha/hora en que se marcó como pagado; NULL = pendiente';
