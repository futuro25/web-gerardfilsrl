-- Actualizar CHECK de orders.order_type para que coincida con la app
-- (client/src/utils/utils.js → getOrderTypes)
--
-- Valores permitidos en la app:
--   'Egreso', 'Consignacion', 'Compra Directa', 'Licitacion'
--
-- Antes en Supabase tenías 'Venta Directa' en lugar de 'Compra Directa' y no existía 'Licitacion'.

-- 1) Ver el nombre exacto del constraint actual (ejecutá y copiá el nombre):
-- SELECT conname
-- FROM pg_constraint
-- JOIN pg_class ON pg_constraint.conrelid = pg_class.oid
-- WHERE pg_class.relname = 'orders' AND contype = 'c';

-- 2) Opcional: unificar datos viejos "Venta Directa" → "Compra Directa"
--    (solo si querés un solo nombre; si no, incluí ambos en el CHECK de abajo)
UPDATE orders
SET order_type = 'Compra Directa'
WHERE order_type = 'Venta Directa';

-- 3) Borrar el CHECK viejo (ajustá el nombre si el paso 1 dio otro):
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_type_check;

-- Si el nombre no es orders_order_type_check, en Supabase: Table editor → orders →
-- pestaña que muestra constraints, o ejecutá el SELECT del paso 1 y usá:
-- ALTER TABLE orders DROP CONSTRAINT "<nombre_que_devolvió>";

-- 4) Crear el CHECK alineado con la app
ALTER TABLE orders
ADD CONSTRAINT orders_order_type_check
CHECK (
  order_type::text = ANY (
    ARRAY[
      'Egreso'::text,
      'Consignacion'::text,
      'Compra Directa'::text,
      'Licitacion'::text
    ]
  )
);

-- Si tenés filas con otros valores, el paso 4 fallará hasta que las actualices o las borres.
