-- Relación 1:1 entre factura de proveedor (Control) y orden de pago.
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_orders_supplier_invoice_unique
  ON payment_orders (supplier_invoice_id)
  WHERE deleted_at IS NULL AND supplier_invoice_id IS NOT NULL;
