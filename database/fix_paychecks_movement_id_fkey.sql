-- La FK paychecks_movement_id_fkey sigue apuntando a cashflow(id), de cuando
-- movement_id guardaba ids de cashflow. Desde add_paychecks_cashflow_id.sql,
-- movement_id es account_movements.id (y cashflow_id es cashflow.id), pero la
-- FK nunca se cambió. Resultado: al emitir un cheque desde una orden de pago
-- con un account_movements.id que no existe como id de cashflow, el insert falla
-- con "violates foreign key constraint paychecks_movement_id_fkey".

-- 0) Verificación previa (opcional): a qué tabla apunta hoy la FK.
-- SELECT conname, confrelid::regclass
-- FROM pg_constraint
-- WHERE conname = 'paychecks_movement_id_fkey';

-- 0b) Cheques con movement_id que no existe en account_movements (legado).
-- SELECT p.id, p.number, p.amount, p.movement_id, p.cashflow_id
-- FROM paychecks p
-- LEFT JOIN account_movements am ON am.id = p.movement_id
-- WHERE p.movement_id IS NOT NULL AND am.id IS NULL;

BEGIN;

ALTER TABLE paychecks DROP CONSTRAINT IF EXISTS paychecks_movement_id_fkey;

-- NOT VALID: valida inserts/updates nuevos sin fallar por filas viejas.
-- Si la consulta 0b da vacío, se puede correr luego:
--   ALTER TABLE paychecks VALIDATE CONSTRAINT paychecks_movement_id_fkey;
ALTER TABLE paychecks
  ADD CONSTRAINT paychecks_movement_id_fkey
  FOREIGN KEY (movement_id) REFERENCES account_movements(id) NOT VALID;

COMMIT;
