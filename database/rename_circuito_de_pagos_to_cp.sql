-- Reemplaza el texto "CIRCUITO DE PAGO(S)" / "CIRCUITO PAGO(S)" de las
-- descripciones por el prefijo "[CP]", conservando el resto del texto.
--
-- Ejemplo: "TELAS (CIRCUITO PAGO)" -> "[CP] TELAS"
--
-- Alcance: movimientos de Control (account_movements), facturas de proveedor
-- (supplier_invoices) y órdenes de pago (payment_orders), incluidas las anuladas.
-- Ejecutado en producción el 10/08/2026 (18 registros: 5 + 5 + 8).
--
-- Idempotente: solo toca filas que todavía contienen el texto viejo.

BEGIN;

-- Verificación previa
SELECT 'account_movements' AS tabla, id, description FROM account_movements WHERE description ILIKE '%CIRCUITO%'
UNION ALL
SELECT 'supplier_invoices', id, description FROM supplier_invoices WHERE description ILIKE '%CIRCUITO%'
UNION ALL
SELECT 'payment_orders', id, description FROM payment_orders WHERE description ILIKE '%CIRCUITO%'
ORDER BY 1, 2;

-- account_movements
UPDATE account_movements
SET description = '[CP] ' || btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(description, '\(?\s*CIRCUITO\s+(DE\s+)?PAGOS?\s*\)?', ' ', 'gi'),
          '\(\s*\)', ' ', 'g'),
        '\s+', ' ', 'g'),
      ' ,;:.-')
WHERE description ILIKE '%CIRCUITO%PAGO%';

-- supplier_invoices
UPDATE supplier_invoices
SET description = '[CP] ' || btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(description, '\(?\s*CIRCUITO\s+(DE\s+)?PAGOS?\s*\)?', ' ', 'gi'),
          '\(\s*\)', ' ', 'g'),
        '\s+', ' ', 'g'),
      ' ,;:.-')
WHERE description ILIKE '%CIRCUITO%PAGO%';

-- payment_orders
UPDATE payment_orders
SET description = '[CP] ' || btrim(
      regexp_replace(
        regexp_replace(
          regexp_replace(description, '\(?\s*CIRCUITO\s+(DE\s+)?PAGOS?\s*\)?', ' ', 'gi'),
          '\(\s*\)', ' ', 'g'),
        '\s+', ' ', 'g'),
      ' ,;:.-')
WHERE description ILIKE '%CIRCUITO%PAGO%';

-- Descripciones que quedaron vacías (solo decían "CIRCUITO DE PAGO")
UPDATE account_movements SET description = '[CP]' WHERE btrim(description) = '[CP]';
UPDATE supplier_invoices SET description = '[CP]' WHERE btrim(description) = '[CP]';
UPDATE payment_orders   SET description = '[CP]' WHERE btrim(description) = '[CP]';

COMMIT;
