-- Gastos fijos: plantilla de egresos que se repiten todos los meses.
-- No son movimientos reales: existen para proyectarlos en Saldos Futuros.
-- El movimiento real se sigue cargando a mano en Control cuando el gasto ocurre,
-- y ese mes deja de proyectarse (ver fixed_expense_id en account_movements).
CREATE TABLE IF NOT EXISTS fixed_expenses (
  id SERIAL PRIMARY KEY,
  description TEXT NOT NULL,
  -- Día del mes en que se paga. Si el mes no llega a ese día se usa el último.
  day_of_month SMALLINT NOT NULL CHECK (day_of_month BETWEEN 1 AND 31),
  -- Primer mes que proyecta (siempre día 1).
  start_month DATE NOT NULL,
  -- Último mes que proyecta (día 1). NULL = sigue vigente.
  end_month DATE,
  -- Movimiento desde el que se creó, a modo de referencia.
  source_movement_id INTEGER REFERENCES account_movements(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_fixed_expenses_deleted_at ON fixed_expenses (deleted_at);

-- Historial de importes. Cada fila rige desde su mes en adelante, hasta que
-- aparece otra posterior. Subir el sueldo desde Julio = una fila nueva con
-- effective_from = 'YYYY-07-01'; los meses anteriores conservan su importe.
CREATE TABLE IF NOT EXISTS fixed_expense_amounts (
  id SERIAL PRIMARY KEY,
  fixed_expense_id INTEGER NOT NULL REFERENCES fixed_expenses(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  -- Primer mes en que rige este importe (siempre día 1).
  effective_from DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_fixed_expense_amounts_unique
  ON fixed_expense_amounts (fixed_expense_id, effective_from);

-- Movimiento real que corresponde a un gasto fijo. Mientras exista uno en el mes,
-- ese mes no se proyecta (evita contar dos veces la misma plata).
ALTER TABLE account_movements
  ADD COLUMN IF NOT EXISTS fixed_expense_id INTEGER REFERENCES fixed_expenses(id);

CREATE INDEX IF NOT EXISTS idx_account_movements_fixed_expense_id
  ON account_movements (fixed_expense_id);
