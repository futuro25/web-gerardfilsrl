-- Script para actualizar el esquema de pedidos
-- Ejecutar este script en Supabase SQL Editor

-- Agregar columnas de fecha de pedido y fecha de entrega a la tabla orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_date DATE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date DATE;

-- Hacer product_id nullable en orders_products (ya no es requerido con el nuevo diseño)
ALTER TABLE orders_products ALTER COLUMN product_id DROP NOT NULL;

-- Agregar campos de variantes a orders_products
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS codigo VARCHAR(100);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS producto_tipo VARCHAR(50);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS manga VARCHAR(20);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS genero VARCHAR(20);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS color VARCHAR(50);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS cuello VARCHAR(30);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS talle VARCHAR(10);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS fuerza VARCHAR(100);
ALTER TABLE orders_products ADD COLUMN IF NOT EXISTS quantity_delivered INTEGER DEFAULT 0;

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON orders(order_date);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_date ON orders(delivery_date);

-- Comentarios para documentación
COMMENT ON COLUMN orders.order_date IS 'Fecha del pedido';
COMMENT ON COLUMN orders.delivery_date IS 'Fecha de entrega esperada';
COMMENT ON COLUMN orders_products.codigo IS 'Código opcional del producto en el pedido';
COMMENT ON COLUMN orders_products.producto_tipo IS 'Tipo de producto (CAMISA, CORBATA, CORBATIN, MOÑO)';
COMMENT ON COLUMN orders_products.manga IS 'Tipo de manga (CORTA, LARGA)';
COMMENT ON COLUMN orders_products.genero IS 'Género (MASCULINO, FEMENINO)';
COMMENT ON COLUMN orders_products.color IS 'Color del producto';
COMMENT ON COLUMN orders_products.cuello IS 'Tipo de cuello (SOLAPA, CORBATA, MAO)';
COMMENT ON COLUMN orders_products.talle IS 'Talle del producto';
