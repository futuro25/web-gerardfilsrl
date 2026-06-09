-- Corrige doble conteo en cuenta corriente de PABLO BLAIOTTA (supplier_id 138).
--
-- Causa: el backfill creó supplier_invoices #54-#57 para movimientos ya
-- representados en cashflow (716-721) y pagados con OP-0542..OP-0564.
-- La CC suma cashflow + facturas Control − OP → quedó inflada.
--
-- Solución: anular las facturas retroactivas duplicadas y desvincular
-- supplier_invoice_id de las OP (manteniendo account_movement_id y datos
-- de cheque para Control).
--
-- Debe quedar pendiente solo factura #50 (venc. 08/06/2026, mov #162).

BEGIN;

-- Verificación previa
SELECT id, invoice_number, total, account_movement_id, deleted_at
FROM supplier_invoices
WHERE supplier_id = 138
ORDER BY id;

-- 1) Anular facturas retroactivas duplicadas (NO tocar #50)
UPDATE supplier_invoices
SET deleted_at = NOW()
WHERE supplier_id = 138
  AND id IN (54, 55, 56, 57)
  AND deleted_at IS NULL;

-- Por si los IDs difieren en prod: también por movimientos cheque ya pagados
UPDATE supplier_invoices
SET deleted_at = NOW()
WHERE supplier_id = 138
  AND account_movement_id IN (40, 77, 41, 42)
  AND deleted_at IS NULL;

-- 2) Desvincular supplier_invoice_id en OP (conservar vínculo al movimiento)
UPDATE payment_orders
SET supplier_invoice_id = NULL
WHERE supplier_id = 138
  AND account_movement_id IN (40, 77, 41, 42)
  AND deleted_at IS NULL;

-- 3) Movimientos cheque: ya pagados, no son facturas pendientes de Control
UPDATE account_movements
SET expense_category = NULL
WHERE id IN (40, 77, 41, 42)
  AND deleted_at IS NULL
  AND payment_method = 'CHEQUE';

COMMIT;

-- Verificación: solo factura activa #50 (o la vinculada a mov 162)
SELECT si.id, si.invoice_number, si.total, si.due_date, si.account_movement_id,
       am.deleted_at AS mov_deleted
FROM supplier_invoices si
LEFT JOIN account_movements am ON am.id = si.account_movement_id
WHERE si.supplier_id = 138 AND si.deleted_at IS NULL;

-- OPs deben seguir con account_movement_id y CHEQUE
SELECT id, order_number, supplier_invoice_id, account_movement_id,
       payment_method, cheque_number, amount
FROM payment_orders
WHERE supplier_id = 138 AND deleted_at IS NULL
ORDER BY id;
