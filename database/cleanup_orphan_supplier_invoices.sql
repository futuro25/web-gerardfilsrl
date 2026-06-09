-- Facturas de proveedor huérfanas: supplier_invoices activas cuyo
-- account_movement fue eliminado (soft-delete) antes de la cascada del 02-jun-2026.
--
-- Ejecutar en Supabase SQL Editor.
-- 1) Revisar el SELECT de verificación.
-- 2) Ejecutar el bloque BEGIN…COMMIT.

-- =============================================================================
-- VERIFICACIÓN (debe devolver 9 filas en la base actual)
-- =============================================================================
SELECT
  si.id                    AS invoice_id,
  s.fantasy_name           AS proveedor,
  si.invoice_number,
  si.amount                AS neto,
  si.total,
  si.document_date,
  si.due_date,
  si.description,
  si.account_movement_id   AS movement_id,
  am.deleted_at            AS movement_deleted_at,
  po.id                    AS payment_order_id,
  po.order_number
FROM supplier_invoices si
LEFT JOIN account_movements am ON am.id = si.account_movement_id
LEFT JOIN suppliers s ON s.id = si.supplier_id
LEFT JOIN payment_orders po
  ON po.supplier_invoice_id = si.id AND po.deleted_at IS NULL
WHERE si.deleted_at IS NULL
  AND si.account_movement_id IS NOT NULL
  AND (am.id IS NULL OR am.deleted_at IS NOT NULL)
ORDER BY si.id;

-- Detalle esperado (9 huérfanas):
--   2  PERKUT RUBEN OSCAR      A000200002448  total 181.500
--  10  PERKUT RUBEN OSCAR      A000200002461  total 1.452.000
--  11  TEJEDURIA GUEMES        A000200007831  total 847.846,99
--  13  CORPORACION MEDICA      A000300007067  total 46.615,73
--  17  BLACK HORSE             A000600000083  total 1.390.639,15
--  18  PABLO BLAIOTTA          A000200000095  total 1.686.959   ← conservar factura #50
--  25  PERKUT RUBEN OSCAR      A000200002472  total 181.499,99
--  28  CORPORACION MEDICA      A000300071091  total 194.564,17
--  34  LILLO MARIA NELLY       C000100000006  total 144.000 + OP-0623 (caso especial)

BEGIN;

-- 1) Anular órdenes de pago activas vinculadas a facturas huérfanas
UPDATE payment_orders po
SET deleted_at = NOW()
FROM supplier_invoices si
LEFT JOIN account_movements am ON am.id = si.account_movement_id
WHERE po.supplier_invoice_id = si.id
  AND po.deleted_at IS NULL
  AND si.deleted_at IS NULL
  AND si.account_movement_id IS NOT NULL
  AND (am.id IS NULL OR am.deleted_at IS NOT NULL);

-- 2) Soft-delete facturas huérfanas
UPDATE supplier_invoices si
SET deleted_at = NOW()
FROM account_movements am
WHERE si.account_movement_id = am.id
  AND si.deleted_at IS NULL
  AND am.deleted_at IS NOT NULL;

-- Facturas cuyo movimiento ya no existe en la tabla
UPDATE supplier_invoices si
SET deleted_at = NOW()
WHERE si.deleted_at IS NULL
  AND si.account_movement_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM account_movements am WHERE am.id = si.account_movement_id
  );

-- 3) Impuestos de esas facturas (ya anuladas)
DELETE FROM taxes t
USING supplier_invoices si
WHERE t.supplier_invoice_id = si.id
  AND si.deleted_at IS NOT NULL
  AND si.id IN (2, 10, 11, 13, 17, 18, 25, 28, 34);

-- 4) LILLO: movimiento #123 del circuito viejo (egreso duplicado de OP-0623)
--    Quedó activo al borrarse el movimiento #121 sin cascada.
UPDATE account_movements
SET deleted_at = NOW()
WHERE id = 123
  AND deleted_at IS NULL
  AND description ILIKE '%OP-0623%';

COMMIT;

-- =============================================================================
-- VERIFICACIÓN POST-LIMPIEZA (debe devolver 0 filas)
-- =============================================================================
SELECT COUNT(*) AS orphan_invoices_remaining
FROM supplier_invoices si
LEFT JOIN account_movements am ON am.id = si.account_movement_id
WHERE si.deleted_at IS NULL
  AND si.account_movement_id IS NOT NULL
  AND (am.id IS NULL OR am.deleted_at IS NOT NULL);

-- PABLO BLAIOTTA: debe quedar activa solo la factura #50 (movimiento #162)
SELECT si.id, si.invoice_number, si.total, si.due_date, si.deleted_at, am.id AS mov_id, am.deleted_at AS mov_deleted
FROM supplier_invoices si
LEFT JOIN account_movements am ON am.id = si.account_movement_id
JOIN suppliers s ON s.id = si.supplier_id
WHERE s.fantasy_name ILIKE '%BLAIOT%'
ORDER BY si.id;
