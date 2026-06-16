-- PDF / imagen de factura de venta (tabla deliveries).
ALTER TABLE deliveries
  ADD COLUMN IF NOT EXISTS image_key TEXT;

COMMENT ON COLUMN deliveries.image_key IS 'Key del comprobante PDF/imagen en R2 (facturas-ventas/)';
