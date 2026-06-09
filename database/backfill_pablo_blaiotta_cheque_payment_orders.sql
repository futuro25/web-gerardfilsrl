-- PABLO BLAIOTTA (supplier_id 138): vincular movimientos de Control pagados con
-- cheque (sin OP) a las órdenes de pago existentes del cashflow, y corregir
-- forma de pago + datos del cheque.
--
-- Movimientos afectados:
--   #40  $ 1.500.000   chq 33396741  GALICIA  vence 27/04/2026  → OP-0562
--   #77  $   969.569   chq 33396740  GALICIA  vence 30/04/2026  → OP-0544
--   #41  $ 1.500.000   chq 33396742  GALICIA  vence 15/05/2026  → OP-0563
--   #42  $ 1.521.719,99 chq 33396743 GALICIA  vence 22/05/2026  → OP-0564
--
-- Ejecutar en Supabase SQL Editor.
-- 1) Revisar SELECT de verificación.
-- 2) Ejecutar BEGIN…COMMIT.

-- =============================================================================
-- VERIFICACIÓN PREVIA
-- =============================================================================
SELECT
  am.id AS movement_id,
  am.date,
  am.amount,
  am.is_cheque,
  am.cheque_number,
  am.cheque_bank,
  am.cheque_due_date,
  am.expense_category,
  am.payment_method,
  si.id AS invoice_id,
  po.id AS po_id,
  po.order_number
FROM account_movements am
LEFT JOIN supplier_invoices si
  ON si.account_movement_id = am.id AND si.deleted_at IS NULL
LEFT JOIN payment_orders po
  ON po.supplier_invoice_id = si.id AND po.deleted_at IS NULL
WHERE am.id IN (40, 77, 41, 42)
ORDER BY am.date;

BEGIN;

-- =============================================================================
-- 1) Facturas retroactivas (necesarias para que Control muestre la OP)
-- =============================================================================
INSERT INTO supplier_invoices (
  supplier_id,
  account_movement_id,
  amount,
  total,
  invoice_number,
  description,
  document_date,
  due_date
)
SELECT
  138,
  v.movement_id,
  v.amount,
  v.amount,
  v.invoice_number,
  v.description,
  v.document_date::date,
  v.due_date::date
FROM (VALUES
  (40, 1500000::numeric,    'A294', 'TELA BATISTA COLOR BLANCO - cheque 1/3', '2026-04-27', '2026-04-27'),
  (77,   969569::numeric,    'A293', 'TELA BATISTA COLOR ARENA - cheque 3/3',  '2026-04-30', '2026-04-30'),
  (41, 1500000::numeric,    'A294', 'TELA BATISTA COLOR BLANCO - cheque 2/3', '2026-05-15', '2026-05-15'),
  (42, 1521719.99::numeric, 'A294', 'TELA BATISTA COLOR BLANCO - cheque 3/3', '2026-05-22', '2026-05-22')
) AS v(movement_id, amount, invoice_number, description, document_date, due_date)
WHERE NOT EXISTS (
  SELECT 1
  FROM supplier_invoices si
  WHERE si.account_movement_id = v.movement_id
    AND si.deleted_at IS NULL
);

-- =============================================================================
-- 2) Vincular OP existentes + corregir CHEQUE y montos
-- =============================================================================
UPDATE payment_orders po
SET
  supplier_invoice_id = si.id,
  account_movement_id   = 40,
  source_movement_id    = 40,
  supplier_id           = 138,
  payment_method        = 'CHEQUE',
  amount                = 1500000,
  payment_date          = '2026-04-27',
  cheque_number         = '33396741',
  cheque_bank           = 'GALICIA',
  cheque_due_date       = '2026-04-27'
FROM supplier_invoices si
WHERE po.id = 562
  AND si.account_movement_id = 40
  AND si.deleted_at IS NULL;

UPDATE payment_orders po
SET
  supplier_invoice_id = si.id,
  account_movement_id   = 77,
  source_movement_id    = 77,
  supplier_id           = 138,
  payment_method        = 'CHEQUE',
  amount                = 969569,
  payment_date          = '2026-04-30',
  cheque_number         = '33396740',
  cheque_bank           = 'GALICIA',
  cheque_due_date       = '2026-04-30'
FROM supplier_invoices si
WHERE po.id = 544
  AND si.account_movement_id = 77
  AND si.deleted_at IS NULL;

UPDATE payment_orders po
SET
  supplier_invoice_id = si.id,
  account_movement_id   = 41,
  source_movement_id    = 41,
  supplier_id           = 138,
  payment_method        = 'CHEQUE',
  amount                = 1500000,
  payment_date          = '2026-05-15',
  cheque_number         = '33396742',
  cheque_bank           = 'GALICIA',
  cheque_due_date       = '2026-05-15'
FROM supplier_invoices si
WHERE po.id = 563
  AND si.account_movement_id = 41
  AND si.deleted_at IS NULL;

UPDATE payment_orders po
SET
  supplier_invoice_id = si.id,
  account_movement_id   = 42,
  source_movement_id    = 42,
  supplier_id           = 138,
  payment_method        = 'CHEQUE',
  amount                = 1521719.99,
  payment_date          = '2026-05-22',
  cheque_number         = '33396743',
  cheque_bank           = 'GALICIA',
  cheque_due_date       = '2026-05-22'
FROM supplier_invoices si
WHERE po.id = 564
  AND si.account_movement_id = 42
  AND si.deleted_at IS NULL;

-- =============================================================================
-- 3) Actualizar movimientos de Control (circuito nuevo)
-- =============================================================================
UPDATE account_movements
SET
  expense_category = 'FACTURA',
  payment_method   = 'CHEQUE',
  is_cheque        = TRUE,
  date             = cheque_due_date
WHERE id IN (40, 77, 41, 42)
  AND deleted_at IS NULL;

-- =============================================================================
-- 4) Restaurar cheques en paychecks + vincular a account_movements
--    NOTA: paychecks.movement_id referencia cashflow(id), NO account_movements.
--    Vínculo con Control: account_movements.paycheck_id → paychecks.id
-- =============================================================================
UPDATE paychecks SET deleted_at = NULL, movement_id = 719 WHERE id = 115; -- OP-0562 / cf 719 / mov 40
UPDATE paychecks SET deleted_at = NULL, movement_id = 718 WHERE id = 123; -- OP-0544 / cf 718 / mov 77
UPDATE paychecks SET deleted_at = NULL, movement_id = 720 WHERE id = 116; -- OP-0563 / cf 720 / mov 41
UPDATE paychecks SET deleted_at = NULL, movement_id = 721 WHERE id = 117; -- OP-0564 / cf 721 / mov 42

UPDATE account_movements SET paycheck_id = 115 WHERE id = 40;
UPDATE account_movements SET paycheck_id = 123 WHERE id = 77;
UPDATE account_movements SET paycheck_id = 116 WHERE id = 41;
UPDATE account_movements SET paycheck_id = 117 WHERE id = 42;

COMMIT;

-- =============================================================================
-- VERIFICACIÓN POSTERIOR
-- =============================================================================
SELECT
  am.id AS movement_id,
  am.date,
  am.amount,
  am.expense_category,
  am.payment_method,
  am.cheque_number,
  si.id AS invoice_id,
  si.invoice_number,
  po.order_number,
  po.payment_method AS po_payment_method,
  po.cheque_number AS po_cheque_number,
  po.cheque_bank,
  po.cheque_due_date
FROM account_movements am
JOIN supplier_invoices si
  ON si.account_movement_id = am.id AND si.deleted_at IS NULL
JOIN payment_orders po
  ON po.supplier_invoice_id = si.id AND po.deleted_at IS NULL
WHERE am.id IN (40, 77, 41, 42)
ORDER BY am.date;

-- Movimiento #39 ($ 1.500.000 sin cheque) y #162 (factura pendiente) no se tocan.
-- OP-0542 y OP-0543 (cashflow arena, cheques 1 y 2) quedan solo en cashflow
-- porque no tienen movimiento equivalente en Control.
