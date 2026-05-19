-- Link invoices to control module movements (account_movements).
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS account_movement_id INTEGER REFERENCES account_movements(id);

CREATE INDEX IF NOT EXISTS idx_invoices_account_movement_id ON invoices (account_movement_id);
CREATE INDEX IF NOT EXISTS idx_invoices_supplier_id ON invoices (supplier_id);
