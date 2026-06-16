-- Vincula retenciones huérfanas a facturas de Control (supplier_invoices).
-- Idempotente: solo actualiza filas sin supplier_invoice_id.
-- Ejecutar en Supabase SQL Editor si hay retenciones del módulo Retenciones sin link.

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

-- Retenciones con account_movement_id pero sin supplier_invoice_id.
UPDATE retention_payments rp
SET supplier_invoice_id = si.id
FROM supplier_invoices si
WHERE rp.deleted_at IS NULL
  AND si.deleted_at IS NULL
  AND rp.supplier_invoice_id IS NULL
  AND rp.account_movement_id IS NOT NULL
  AND si.account_movement_id = rp.account_movement_id;
