-- Permitir varias órdenes de pago por factura (pagos parciales).
-- Ejecutar en Supabase SQL Editor.

DROP INDEX IF EXISTS idx_payment_orders_supplier_invoice_unique;

COMMENT ON TABLE payment_orders IS
  'Órdenes de pago. Varias OP pueden aplicar a la misma factura hasta saldar el total.';
