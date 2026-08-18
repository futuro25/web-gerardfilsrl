-- Auditoria de escrituras: quien creo, edito o elimino cada registro.
-- La escribe el middleware auditLog en cada POST / PATCH / DELETE de la API.
CREATE TABLE IF NOT EXISTS audit_log (
  id BIGSERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  user_id INTEGER REFERENCES users (id),
  username TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  method TEXT NOT NULL,
  path TEXT NOT NULL,
  payload JSONB,
  status_code INTEGER,
  ok BOOLEAN NOT NULL DEFAULT TRUE,
  error TEXT,
  ip TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id ON audit_log (entity, entity_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log (action);

COMMENT ON TABLE audit_log IS 'Registro de auditoria: toda escritura de la API queda asentada aca';
COMMENT ON COLUMN audit_log.action IS 'create | update | delete';
COMMENT ON COLUMN audit_log.entity IS 'Recurso afectado segun la ruta: invoices, account-movements, etc.';
COMMENT ON COLUMN audit_log.entity_id IS 'Id del registro afectado (en los create se toma de la respuesta)';
COMMENT ON COLUMN audit_log.payload IS 'Datos enviados en el request, sin contraseñas ni archivos';
COMMENT ON COLUMN audit_log.ok IS 'False cuando la operacion fallo: sirve para ver intentos rechazados';
