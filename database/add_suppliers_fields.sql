-- Migración para agregar las columnas 'alias', 'cbu' y 'clasificacion' a la tabla suppliers
-- Ejecutar este script en Supabase SQL Editor

-- Agregar columna alias
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS alias VARCHAR(255);

-- Agregar columna cbu
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS cbu VARCHAR(22);

-- Agregar columna clasificacion
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS clasificacion VARCHAR(255);

-- Agregar comentarios para documentación
COMMENT ON COLUMN suppliers.alias IS 'Alias del proveedor';
COMMENT ON COLUMN suppliers.cbu IS 'CBU (Clave Bancaria Uniforme) del proveedor';
COMMENT ON COLUMN suppliers.clasificacion IS 'Clasificación del proveedor';

