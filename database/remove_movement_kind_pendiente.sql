-- Dejar de usar clasificación manual PENDIENTE (pendiente = factura sin OP).
-- Normalizar TODAS las filas (incl. soft-deleted) antes de cambiar el constraint.

UPDATE account_movements
SET movement_kind = 'UNICA VEZ'
WHERE movement_kind = 'PENDIENTE';

UPDATE account_movements
SET movement_kind = 'UNICA VEZ'
WHERE movement_kind IS NULL
   OR TRIM(movement_kind) = ''
   OR movement_kind NOT IN ('FIJO', 'UNICA VEZ');

ALTER TABLE account_movements DROP CONSTRAINT IF EXISTS account_movements_movement_kind_check;

ALTER TABLE account_movements
  ADD CONSTRAINT account_movements_movement_kind_check
  CHECK (movement_kind IN ('FIJO', 'UNICA VEZ'));
