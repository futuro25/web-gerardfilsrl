-- VEP asociado al egreso en Control.
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS vep_id INTEGER REFERENCES veps(id);

CREATE INDEX IF NOT EXISTS idx_account_movements_vep_id
  ON account_movements (vep_id);

COMMENT ON COLUMN account_movements.vep_id IS 'VEP pagado con este egreso (expense_category = VEP)';
