-- Renglón y código en líneas de ingreso (alineado con orders_products)
ALTER TABLE stock_entries_products ADD COLUMN IF NOT EXISTS renglon VARCHAR(5);
ALTER TABLE stock_entries_products ADD COLUMN IF NOT EXISTS codigo VARCHAR(100);

COMMENT ON COLUMN stock_entries_products.renglon IS 'Renglón numérico (hasta 5 dígitos, opcional)';
COMMENT ON COLUMN stock_entries_products.codigo IS 'Código opcional del producto (como en pedidos)';
