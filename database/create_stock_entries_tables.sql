-- Script para crear las tablas de ingreso de mercadería (stock entries)
-- Ejecutar este script en Supabase SQL Editor

-- Tabla principal de ingresos de mercadería
CREATE TABLE IF NOT EXISTS stock_entries (
  id BIGSERIAL PRIMARY KEY,
  supplier_id BIGINT NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  remito_number VARCHAR(50) NOT NULL,
  entry_date DATE NOT NULL,
  description TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de relación entre stock_entries y products
CREATE TABLE IF NOT EXISTS stock_entries_products (
  id BIGSERIAL PRIMARY KEY,
  stock_entry_id BIGINT NOT NULL REFERENCES stock_entries(id) ON DELETE CASCADE,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  color VARCHAR(50),
  genre VARCHAR(50),
  sleeve VARCHAR(50),
  neck VARCHAR(50),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_stock_entries_supplier_id ON stock_entries(supplier_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_entry_date ON stock_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_stock_entries_deleted_at ON stock_entries(deleted_at);
CREATE INDEX IF NOT EXISTS idx_stock_entries_products_stock_entry_id ON stock_entries_products(stock_entry_id);
CREATE INDEX IF NOT EXISTS idx_stock_entries_products_product_id ON stock_entries_products(product_id);

-- Comentarios para documentación
COMMENT ON TABLE stock_entries IS 'Registro de ingresos de mercadería desde proveedores';
COMMENT ON TABLE stock_entries_products IS 'Relación entre ingresos de stock y productos con sus características específicas';
COMMENT ON COLUMN stock_entries.remito_number IS 'Número de remito del proveedor';
COMMENT ON COLUMN stock_entries.entry_date IS 'Fecha de ingreso de la mercadería';
COMMENT ON COLUMN stock_entries_products.color IS 'Color del producto en este ingreso';
COMMENT ON COLUMN stock_entries_products.genre IS 'Género del producto en este ingreso';
COMMENT ON COLUMN stock_entries_products.sleeve IS 'Tipo de manga del producto en este ingreso';
COMMENT ON COLUMN stock_entries_products.neck IS 'Tipo de cuello del producto en este ingreso';

