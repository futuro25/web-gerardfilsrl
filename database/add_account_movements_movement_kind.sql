-- Run once on existing databases that already have account_movements.
ALTER TABLE account_movements ADD COLUMN IF NOT EXISTS movement_kind TEXT DEFAULT 'UNICA VEZ';

UPDATE account_movements SET movement_kind = 'UNICA VEZ' WHERE movement_kind IS NULL;

ALTER TABLE account_movements ALTER COLUMN movement_kind SET DEFAULT 'UNICA VEZ';
ALTER TABLE account_movements ALTER COLUMN movement_kind SET NOT NULL;

ALTER TABLE account_movements DROP CONSTRAINT IF EXISTS account_movements_movement_kind_check;
ALTER TABLE account_movements ADD CONSTRAINT account_movements_movement_kind_check
  CHECK (movement_kind IN ('FIJO', 'PENDIENTE', 'UNICA VEZ'));
