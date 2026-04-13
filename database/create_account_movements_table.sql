CREATE TABLE IF NOT EXISTS account_movements (
  id SERIAL PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('INGRESO', 'EGRESO')),
  responsible TEXT NOT NULL CHECK (responsible IN ('Jose', 'Carolina', 'Walter', 'Sin especificar')),
  date DATE NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  is_cheque BOOLEAN NOT NULL DEFAULT FALSE,
  cheque_number TEXT,
  cheque_bank TEXT,
  cheque_due_date DATE,
  paycheck_id INTEGER REFERENCES paychecks(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_account_movements_date ON account_movements (date);
CREATE INDEX idx_account_movements_cheque_due_date ON account_movements (cheque_due_date);
CREATE INDEX idx_account_movements_type ON account_movements (type);
CREATE INDEX idx_account_movements_deleted_at ON account_movements (deleted_at);
