-- Migración para agregar la columna 'fuerza' a la tabla stock_entries_products
-- Ejecutar este script en Supabase SQL Editor

-- Agregar columna fuerza
ALTER TABLE stock_entries_products 
ADD COLUMN IF NOT EXISTS fuerza VARCHAR(50);

-- Agregar comentario para documentación
COMMENT ON COLUMN stock_entries_products.fuerza IS 'Fuerza del producto en este ingreso (Sastreria Militar, Gendarmeria, Fuerza Aerea, Policia Federal, Intendencia, Policia de Neuquen, Penitenciaria de Neuquen, Privados)';





