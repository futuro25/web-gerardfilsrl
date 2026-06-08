-- Proveedor y N° factura en egresos Otro / Servicios (Control).
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS supplier_id INTEGER REFERENCES suppliers(id),
  ADD COLUMN IF NOT EXISTS invoice_number TEXT;

CREATE INDEX IF NOT EXISTS idx_account_movements_supplier_id
  ON account_movements (supplier_id)
  WHERE deleted_at IS NULL AND supplier_id IS NOT NULL;
