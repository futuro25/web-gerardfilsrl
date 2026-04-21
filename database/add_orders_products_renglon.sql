-- Hasta 5 dígitos numéricos por línea de pedido (opcional).
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS renglon VARCHAR(5);

COMMENT ON COLUMN orders_products.renglon IS 'Renglón numérico (hasta 5 dígitos, opcional)';
