-- Vincular retenciones a facturas de Control (supplier_invoices) y movimientos.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE retention_payments
  ADD COLUMN IF NOT EXISTS supplier_invoice_id BIGINT REFERENCES supplier_invoices(id),
  ADD COLUMN IF NOT EXISTS account_movement_id BIGINT REFERENCES account_movements(id);

CREATE INDEX IF NOT EXISTS idx_retention_payments_supplier_invoice_id
  ON retention_payments(supplier_invoice_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_retention_payments_account_movement_id
  ON retention_payments(account_movement_id)
  WHERE deleted_at IS NULL;

-- Una retención activa por factura de Control.
CREATE UNIQUE INDEX IF NOT EXISTS idx_retention_payments_supplier_invoice_unique
  ON retention_payments(supplier_invoice_id)
  WHERE deleted_at IS NULL AND supplier_invoice_id IS NOT NULL;

COMMENT ON COLUMN retention_payments.supplier_invoice_id IS 'Factura de proveedor (Control) asociada';
COMMENT ON COLUMN retention_payments.account_movement_id IS 'Movimiento de Control asociado';

-- Backfill: match por número de factura normalizado + CUIT del proveedor.
UPDATE retention_payments rp
SET
  supplier_invoice_id = si.id,
  account_movement_id = COALESCE(rp.account_movement_id, si.account_movement_id)
FROM supplier_invoices si
JOIN suppliers s ON s.id = si.supplier_id
WHERE rp.deleted_at IS NULL
  AND si.deleted_at IS NULL
  AND rp.supplier_invoice_id IS NULL
  AND rp.invoice_number IS NOT NULL
  AND si.invoice_number IS NOT NULL
  AND regexp_replace(upper(rp.invoice_number), '[^A-Z0-9]', '', 'g')
    = regexp_replace(upper(si.invoice_number), '[^A-Z0-9]', '', 'g')
  AND regexp_replace(rp.supplier_cuit, '[^0-9]', '', 'g')
    = regexp_replace(s.cuit, '[^0-9]', '', 'g');
