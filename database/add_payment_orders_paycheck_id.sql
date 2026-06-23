-- Vincula cada orden de pago con cheque al registro en paychecks.
ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS paycheck_id INTEGER REFERENCES paychecks(id);

-- Backfill: emparejar OPs con cheque existentes por movimiento y datos del cheque.
UPDATE payment_orders po
SET paycheck_id = p.id
FROM paychecks p
WHERE po.payment_method = 'CHEQUE'
  AND po.deleted_at IS NULL
  AND po.paycheck_id IS NULL
  AND po.account_movement_id IS NOT NULL
  AND po.cheque_number IS NOT NULL
  AND po.cheque_bank IS NOT NULL
  AND po.cheque_due_date IS NOT NULL
  AND p.deleted_at IS NULL
  AND p.type = 'OUT'
  AND p.movement_id = po.account_movement_id
  AND p.number = po.cheque_number
  AND p.bank = po.cheque_bank
  AND p.due_date = po.cheque_due_date
  AND ABS(COALESCE(p.amount, 0) - COALESCE(po.amount, 0)) < 0.01;
