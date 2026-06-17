-- Movimiento de Control que registró el pago del VEP.
ALTER TABLE veps
  ADD COLUMN IF NOT EXISTS account_movement_id INTEGER REFERENCES account_movements(id);

CREATE INDEX IF NOT EXISTS idx_veps_account_movement_id
  ON veps (account_movement_id);

COMMENT ON COLUMN veps.account_movement_id IS 'Egreso en Control que marcó el VEP como pagado';
