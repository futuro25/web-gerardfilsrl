-- Datos del cheque cuando la orden de pago se abona con CHEQUE.
-- Para TRANSFERENCIA / EFECTIVO / TARJETA quedan en NULL.
-- El movimiento de conciliación en Control (account_movements) también
-- guarda estos datos y, si es egreso, genera el registro en "paychecks".

ALTER TABLE payment_orders
  ADD COLUMN IF NOT EXISTS cheque_number   TEXT,
  ADD COLUMN IF NOT EXISTS cheque_bank     TEXT,
  ADD COLUMN IF NOT EXISTS cheque_due_date DATE;
