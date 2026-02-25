-- Script para actualizar el esquema de deliverynotes (Egreso de Mercadería)
-- Ejecutar este script en Supabase SQL Editor

-- Agregar campos a deliverynotes
ALTER TABLE deliverynotes ADD COLUMN IF NOT EXISTS order_number_text VARCHAR(100);
ALTER TABLE deliverynotes ADD COLUMN IF NOT EXISTS remito_number VARCHAR(100);

-- Agregar campos de variantes a deliverynotes_products
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS codigo VARCHAR(100);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS fuerza VARCHAR(100);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS producto_tipo VARCHAR(50);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS manga VARCHAR(20);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS genero VARCHAR(20);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS cuello VARCHAR(30);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS talle VARCHAR(10);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS cantidad_por_talle INTEGER;
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS cantidad_total INTEGER;
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS origen VARCHAR(20);
ALTER TABLE deliverynotes_products ADD COLUMN IF NOT EXISTS lo_que_falta INTEGER;

-- Hacer product_id nullable (ya no es requerido)
ALTER TABLE deliverynotes_products ALTER COLUMN product_id DROP NOT NULL;

-- Comentarios para documentación
COMMENT ON COLUMN deliverynotes.order_number_text IS 'Número de pedido como texto';
COMMENT ON COLUMN deliverynotes.remito_number IS 'Número de remito';
COMMENT ON COLUMN deliverynotes_products.codigo IS 'Código del producto';
COMMENT ON COLUMN deliverynotes_products.fuerza IS 'Fuerza del producto';
COMMENT ON COLUMN deliverynotes_products.producto_tipo IS 'Tipo de producto (CAMISA, CORBATA, etc.)';
COMMENT ON COLUMN deliverynotes_products.origen IS 'Origen del producto (STOCK o CONFECCION)';
COMMENT ON COLUMN deliverynotes_products.lo_que_falta IS 'Cantidad faltante para completar cantidad total';
