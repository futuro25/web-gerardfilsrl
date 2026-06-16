-- Comprobante adjunto en egresos sin factura de proveedor (Impuestos, Otro, etc.).
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS image_key TEXT;
