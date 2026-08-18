-- Guarda una copia del registro afectado en cada entrada de auditoria.
-- Correr solo si la tabla audit_log ya fue creada sin esta columna
-- (create_audit_log_table.sql ya la incluye).
ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS entity_snapshot JSONB;

COMMENT ON COLUMN audit_log.entity_snapshot IS 'Copia del registro afectado, leida despues de responder: permite ver que factura se elimino, no solo su id';
