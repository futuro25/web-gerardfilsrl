-- Fecha del comprobante (inmutable referencia; distinta de due_date / vencimiento).
ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS document_date DATE;

-- Backfill: comprobante desde movimiento vinculado, due_date o created_at.
UPDATE supplier_invoices si
SET document_date = COALESCE(
  (SELECT am.date FROM account_movements am WHERE am.id = si.account_movement_id AND am.deleted_at IS NULL),
  si.due_date,
  si.created_at::date
)
WHERE si.document_date IS NULL AND si.deleted_at IS NULL;
