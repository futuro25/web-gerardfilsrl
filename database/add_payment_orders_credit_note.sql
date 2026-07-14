-- Nota de crédito como forma de pago en órdenes de pago.
-- El número de nota de crédito es opcional.

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS credit_note_number TEXT;

ALTER TABLE payment_orders
  DROP CONSTRAINT IF EXISTS payment_orders_payment_method_check;

ALTER TABLE payment_orders
  ADD CONSTRAINT payment_orders_payment_method_check
  CHECK (payment_method IN (
    'TRANSFERENCIA', 'CHEQUE', 'EFECTIVO',
    'TARJETA DE CREDITO', 'DEBITO AUTOMATICO', 'NOTA DE CREDITO'
  ));
