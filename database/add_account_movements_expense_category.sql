-- Concepto del egreso. Permite registrar egresos sin factura asociada para
-- conceptos exentos. NULL o 'FACTURA' = egreso normal (requiere factura).
-- Valores de excepción: 'GASTOS_BANCARIOS', 'IMPUESTOS', 'PAGO_HABERES'.

ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS expense_category TEXT;
