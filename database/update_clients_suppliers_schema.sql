-- Script para actualizar el esquema de clients y suppliers
-- Ejecutar este script en Supabase SQL Editor

-- Agregar campos alias y cbu a la tabla clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS alias VARCHAR(100);
ALTER TABLE clients ADD COLUMN IF NOT EXISTS cbu VARCHAR(30);

-- Agregar campo horario a la tabla suppliers
ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS horario VARCHAR(100);

-- Comentarios para documentación
COMMENT ON COLUMN clients.alias IS 'Alias bancario del cliente';
COMMENT ON COLUMN clients.cbu IS 'CBU del cliente';
COMMENT ON COLUMN suppliers.horario IS 'Horario de atención del proveedor';
