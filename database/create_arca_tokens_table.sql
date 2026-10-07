-- Ticket de acceso (WSAA) de ARCA para los web services del padron.
-- ARCA no deja pedir un ticket nuevo mientras el anterior siga vigente (12 hs),
-- asi que se guarda aca para sobrevivir a los reinicios del servidor.
CREATE TABLE IF NOT EXISTS arca_tokens (
  service TEXT NOT NULL,
  environment TEXT NOT NULL,
  token TEXT NOT NULL,
  sign TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (service, environment)
);

COMMENT ON TABLE arca_tokens IS 'Ticket de acceso WSAA vigente por servicio y ambiente (homologacion/produccion)';
