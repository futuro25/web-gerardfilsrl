-- Forma de pago en egresos de Control (excepto factura de proveedor, que usa OP).
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS payment_method TEXT;
