-- Cache del estado de cada CUIT en el padron de ARCA (constancia de inscripcion).
-- Se refresca cuando tiene mas de 6 horas, asi el listado de proveedores no
-- consulta ARCA por cada proveedor en cada carga.
CREATE TABLE IF NOT EXISTS arca_cuit_status (
  cuit TEXT PRIMARY KEY,
  active BOOLEAN NOT NULL,
  status JSONB NOT NULL,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE arca_cuit_status IS 'Ultima respuesta de ARCA por CUIT; active = estadoClave ACTIVO';
COMMENT ON COLUMN arca_cuit_status.status IS 'Respuesta normalizada (razon social, condicion IVA/Ganancias, observaciones)';
