-- Si ya existía renglon como VARCHAR(100): normalizar y acotar a 5 dígitos.
UPDATE orders_products
SET renglon = LEFT(regexp_replace(COALESCE(renglon, ''), '[^0-9]', '', 'g'), 5)
WHERE renglon IS NOT NULL AND trim(renglon) <> '';

UPDATE orders_products SET renglon = NULL WHERE trim(COALESCE(renglon, '')) = '';

ALTER TABLE orders_products ALTER COLUMN renglon TYPE VARCHAR(5);

COMMENT ON COLUMN orders_products.renglon IS 'Renglón numérico (hasta 5 dígitos, opcional)';
