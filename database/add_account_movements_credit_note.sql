-- Nota de crédito como tipo de ingreso en Control.
-- El ingreso queda vinculado a una factura de proveedor (supplier_invoices)
-- e impacta la cuenta corriente del proveedor.

ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS income_category TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_number TEXT,
  ADD COLUMN IF NOT EXISTS credit_note_invoice_id INTEGER REFERENCES supplier_invoices(id);

ALTER TABLE account_movements DROP CONSTRAINT IF EXISTS account_movements_income_category_check;
ALTER TABLE account_movements ADD CONSTRAINT account_movements_income_category_check
  CHECK (income_category IS NULL OR income_category IN ('NOTA_CREDITO'));

CREATE INDEX IF NOT EXISTS idx_account_movements_income_category
  ON account_movements (income_category)
  WHERE deleted_at IS NULL AND income_category IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_account_movements_credit_note_invoice_id
  ON account_movements (credit_note_invoice_id)
  WHERE deleted_at IS NULL AND credit_note_invoice_id IS NOT NULL;
