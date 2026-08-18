-- Sesiones de usuario para el modulo de "Usuarios en linea".
-- Cada pestaña/navegador logueado crea una fila y la mantiene viva con un heartbeat.
CREATE TABLE IF NOT EXISTS user_sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users (id),
  session_token TEXT NOT NULL UNIQUE,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  is_idle BOOLEAN NOT NULL DEFAULT FALSE,
  current_path TEXT,
  user_agent TEXT,
  ip TEXT
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_last_seen_at ON user_sessions (last_seen_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ended_at ON user_sessions (ended_at);

COMMENT ON TABLE user_sessions IS 'Presencia de usuarios: una fila por sesion de navegador, actualizada por heartbeat';
COMMENT ON COLUMN user_sessions.session_token IS 'Identificador generado en el cliente y guardado en sessionStorage';
COMMENT ON COLUMN user_sessions.last_seen_at IS 'Ultimo heartbeat recibido: define si la sesion sigue abierta';
COMMENT ON COLUMN user_sessions.last_activity_at IS 'Ultima interaccion real (mouse/teclado/scroll): define activo vs inactivo';
COMMENT ON COLUMN user_sessions.ended_at IS 'Logout explicito o cierre de pestaña: la sesion pasa a offline';
COMMENT ON COLUMN user_sessions.is_idle IS 'El cliente reporta que el usuario esta inactivo o la pestaña oculta';
