-- Tabla de órdenes de pago
-- Cada orden de pago cancela una factura de proveedor y genera un movimiento de conciliación
-- en account_movements.

CREATE TABLE IF NOT EXISTS payment_orders (
  id                    SERIAL PRIMARY KEY,
  order_number          TEXT    NOT NULL UNIQUE,                               -- Ej: "OP-0001"
  supplier_invoice_id   INTEGER REFERENCES supplier_invoices(id),              -- Factura de Control que se cancela
  cashflow_id           INTEGER REFERENCES cashflow(id),                       -- Factura de Cashflow que se cancela
  supplier_id           INTEGER REFERENCES suppliers(id),                      -- Proveedor
  payment_method        TEXT    NOT NULL CHECK (payment_method IN (
                          'TRANSFERENCIA', 'CHEQUE', 'EFECTIVO',
                          'TARJETA DE CREDITO', 'DEBITO AUTOMATICO', 'NOTA DE CREDITO'
                        )),
  amount                NUMERIC NOT NULL,
  description           TEXT,
  payment_date          DATE    NOT NULL,                                       -- Fecha de pago efectivo
  source_movement_id    INTEGER REFERENCES account_movements(id),              -- Movimiento original (la factura de Control)
  account_movement_id   INTEGER REFERENCES account_movements(id),              -- Movimiento de conciliación creado
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

-- ─────────────────────────────────────────────────────────────────────────────
-- EJEMPLO DE INSERTS PARA CARGAR ÓRDENES ANTERIORES
--
-- Paso 1: revisar las facturas existentes
--   SELECT si.id, si.invoice_number, si.supplier_id, si.amount, si.account_movement_id,
--          s.fantasy_name
--   FROM supplier_invoices si
--   JOIN suppliers s ON s.id = si.supplier_id
--   WHERE si.deleted_at IS NULL
--   ORDER BY si.id;
--
-- Paso 2: por cada factura a pagar, crear primero el movimiento de conciliación
--   INSERT INTO account_movements
--     (type, responsible, movement_kind, date, amount, description, is_cheque)
--   VALUES
--     ('EGRESO', 'Sin especificar', 'UNICA VEZ', '2025-03-15', 15000.00,
--      'Orden de Pago OP-0001 - Proveedor XYZ', false)
--   RETURNING id;
--   -- Anotá el id devuelto (ej: 310) para usarlo en el INSERT de payment_orders.
--
-- Paso 3: insertar la orden de pago
--   INSERT INTO payment_orders
--     (order_number, supplier_invoice_id, supplier_id, payment_method,
--      amount, description, payment_date, source_movement_id, account_movement_id)
--   VALUES
--     ('OP-0001', 5, 3, 'TRANSFERENCIA',
--      15000.00, 'Pago factura A-0001-00000123', '2025-03-15', 100, 310);
--
-- Para múltiples órdenes de una sola vez:
--   INSERT INTO payment_orders
--     (order_number, supplier_invoice_id, supplier_id, payment_method,
--      amount, description, payment_date, source_movement_id, account_movement_id)
--   VALUES
--     ('OP-0001', 5,  3, 'TRANSFERENCIA',  15000.00, 'Pago factura A-0001-00000123', '2025-01-10', 100, 310),
--     ('OP-0002', 8,  7, 'EFECTIVO',        4500.00, 'Pago factura B-0001-00000045', '2025-01-15', 101, 311),
--     ('OP-0003', 12, 3, 'CHEQUE',          9800.00, 'Pago factura A-0002-00000078', '2025-02-01', 102, 312);
--
-- Para facturas que viven en CASHFLOW (no en Control), usar cashflow_id en lugar de
-- supplier_invoice_id, y dejar source_movement_id en NULL:
--   INSERT INTO payment_orders
--     (order_number, cashflow_id, supplier_id, payment_method,
--      amount, description, payment_date, account_movement_id)
--   VALUES
--     ('OP-0004', 250, 3, 'TRANSFERENCIA', 7200.00, 'Pago factura cashflow ref 0001-99', '2025-02-10', 313);
-- ─────────────────────────────────────────────────────────────────────────────
