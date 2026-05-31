-- Guarda la "key" (nombre del objeto dentro del bucket "invoices" de Cloudflare R2)
-- de la imagen / PDF de la factura de compra. NULL = sin imagen cargada.

ALTER TABLE supplier_invoices
  ADD COLUMN IF NOT EXISTS image_key TEXT;
