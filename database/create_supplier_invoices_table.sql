-- Facturas de compra / proveedores (distinto de `invoices` que es ventas).
CREATE TABLE IF NOT EXISTS supplier_invoices (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER NOT NULL REFERENCES suppliers(id),
  account_movement_id INTEGER REFERENCES account_movements(id),
  amount NUMERIC NOT NULL,
  total NUMERIC,
  invoice_number TEXT,
  description TEXT,
  due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_supplier_invoices_supplier_id ON supplier_invoices (supplier_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_account_movement_id ON supplier_invoices (account_movement_id);
CREATE INDEX IF NOT EXISTS idx_supplier_invoices_deleted_at ON supplier_invoices (deleted_at);

-- Impuestos de facturas de proveedor (invoice_id en taxes sigue usándose para cashflow / ventas).
ALTER TABLE taxes ADD COLUMN IF NOT EXISTS supplier_invoice_id INTEGER REFERENCES supplier_invoices(id);

CREATE INDEX IF NOT EXISTS idx_taxes_supplier_invoice_id ON taxes (supplier_invoice_id);
