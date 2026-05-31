-- ─────────────────────────────────────────────────────────────────────────────
-- Backfill de órdenes de pago para facturas históricas (Control + Cashflow).
--
-- Reglas:
--   • Se EXCLUYEN las facturas "en rojo" (aún no pagadas) listadas en red_invoices.
--   • Se EXCLUYEN las facturas que ya tienen una orden de pago.
--   • Orden cronológico: las primeras órdenes (OP-0001, OP-0002, …) corresponden
--     a las facturas más antiguas.
--   • Forma de pago: TRANSFERENCIA para todas.
--   • payment_date  = fecha de la factura.
--   • created_at    = fecha de la factura.
--   • amount        = monto total de la factura.
--   • account_movement_id = NULL (no se crea movimiento de conciliación; es un
--     backfill histórico, el egreso original ya existe en Control).
--
-- Numeración: continúa desde el mayor OP-#### existente (si no hay, arranca en OP-0001).
-- ─────────────────────────────────────────────────────────────────────────────

WITH
-- Facturas que NO se deben pagar (quedan sin orden de pago)
red_invoices AS (
  SELECT UNNEST(ARRAY[
    'A000200002448',
    'A000200002461',
    'A000200007831',
    'A000300007067',
    'A000600000083',
    'A000200000095',
    'A000200002472',
    'A000100000384',
    'A000100000385',
    'A000300071091'
  ]) AS num
),

-- IDs que ya tienen orden de pago (para no duplicar)
paid_control AS (
  SELECT supplier_invoice_id AS id
  FROM payment_orders
  WHERE supplier_invoice_id IS NOT NULL AND deleted_at IS NULL
),
paid_cashflow AS (
  SELECT cashflow_id AS id
  FROM payment_orders
  WHERE cashflow_id IS NOT NULL AND deleted_at IS NULL
),

-- Facturas de Control (supplier_invoices) pendientes
control_pending AS (
  SELECT
    si.id                                                   AS supplier_invoice_id,
    NULL::int                                               AS cashflow_id,
    si.supplier_id                                          AS supplier_id,
    si.account_movement_id                                  AS source_movement_id,
    COALESCE(am.date, si.due_date, si.created_at::date)     AS invoice_date,
    COALESCE(si.total, si.amount)                           AS amount,
    si.description                                          AS description
  FROM supplier_invoices si
  LEFT JOIN account_movements am ON am.id = si.account_movement_id
  WHERE si.deleted_at IS NULL
    AND si.id NOT IN (SELECT id FROM paid_control)
    AND UPPER(REGEXP_REPLACE(COALESCE(si.invoice_number, ''), '[^A-Za-z0-9]', '', 'g'))
        NOT IN (SELECT num FROM red_invoices)
),

-- Facturas de Cashflow (EGRESO con referencia) pendientes
cashflow_pending AS (
  SELECT
    NULL::int                                               AS supplier_invoice_id,
    cf.id                                                   AS cashflow_id,
    CASE WHEN cf.provider ~ '^[0-9]+$'
         THEN cf.provider::int ELSE NULL END                AS supplier_id,
    NULL::int                                               AS source_movement_id,
    cf.date                                                 AS invoice_date,
    ABS(cf.amount)                                          AS amount,
    cf.description                                          AS description
  FROM cashflow cf
  WHERE cf.deleted_at IS NULL
    AND cf.type = 'EGRESO'
    AND cf.reference IS NOT NULL
    AND BTRIM(cf.reference) <> ''
    AND cf.id NOT IN (SELECT id FROM paid_cashflow)
    AND UPPER(REGEXP_REPLACE(COALESCE(cf.reference, ''), '[^A-Za-z0-9]', '', 'g'))
        NOT IN (SELECT num FROM red_invoices)
),

all_pending AS (
  SELECT * FROM control_pending
  UNION ALL
  SELECT * FROM cashflow_pending
),

-- Numeración cronológica (más antigua primero)
numbered AS (
  SELECT
    p.*,
    ROW_NUMBER() OVER (
      ORDER BY p.invoice_date ASC,
               COALESCE(p.supplier_invoice_id, 0),
               COALESCE(p.cashflow_id, 0)
    ) AS rn
  FROM all_pending p
),

-- Mayor número OP existente
base AS (
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(order_number FROM 'OP-([0-9]+)') AS INT)), 0
  ) AS max_n
  FROM payment_orders
)

INSERT INTO payment_orders
  (order_number, supplier_invoice_id, cashflow_id, supplier_id, payment_method,
   amount, description, payment_date, source_movement_id, account_movement_id, created_at)
SELECT
  'OP-' || LPAD((base.max_n + n.rn)::text, 4, '0'),
  n.supplier_invoice_id,
  n.cashflow_id,
  n.supplier_id,
  'TRANSFERENCIA',
  n.amount,
  n.description,
  n.invoice_date,                 -- fecha de pago = fecha de la factura
  n.source_movement_id,
  NULL,                           -- sin movimiento de conciliación
  n.invoice_date::timestamptz     -- fecha de creación = fecha de la factura
FROM numbered n
CROSS JOIN base
ORDER BY n.rn;
