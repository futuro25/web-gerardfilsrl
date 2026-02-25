-- Script para actualizar el esquema de stock_entries y stock_entries_products
-- Ejecutar este script en Supabase SQL Editor

-- Hacer supplier_id nullable en stock_entries (para Confección Propia)
ALTER TABLE stock_entries ALTER COLUMN supplier_id DROP NOT NULL;

-- Hacer remito_number nullable en stock_entries
ALTER TABLE stock_entries ALTER COLUMN remito_number DROP NOT NULL;

-- Hacer product_id nullable (ya no es requerido con el nuevo diseño)
ALTER TABLE stock_entries_products ALTER COLUMN product_id DROP NOT NULL;

-- Agregar campo producto_tipo a stock_entries_products
ALTER TABLE stock_entries_products ADD COLUMN IF NOT EXISTS producto_tipo VARCHAR(50);

-- Agregar campo cuello si no existe (puede que ya exista como neck)
ALTER TABLE stock_entries_products ADD COLUMN IF NOT EXISTS cuello VARCHAR(30);

-- Comentarios para documentación
COMMENT ON COLUMN stock_entries.supplier_id IS 'ID del proveedor (NULL para Confección Propia)';
COMMENT ON COLUMN stock_entries_products.producto_tipo IS 'Tipo de producto (CAMISA, CORBATA, CORBATIN, MOÑO, OTROS)';
COMMENT ON COLUMN stock_entries_products.cuello IS 'Tipo de cuello del producto';
