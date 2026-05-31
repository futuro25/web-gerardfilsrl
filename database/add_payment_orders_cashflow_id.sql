-- Permite que una orden de pago cancele también facturas que viven en el módulo Cashflow
-- (movimientos EGRESO con número de factura en cashflow.reference).

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS cashflow_id INTEGER REFERENCES cashflow(id);
