-- Da de baja (borrado lógico) cheques que quedaron vivos después de borrar el
-- movimiento al que pertenecían. El borrado en cascada solo eliminaba un cheque
-- por movimiento (account_movements.paycheck_id) y no los de cada orden de pago;
-- en Cashflow no eliminaba ninguno.
--
-- 137, 138 -> cheques 33396745 / 33396746 de la 1ra carga de la factura
--             A001100019739 de HB MANAGMENT S.A. (mov 194, borrado 17/06/2026)
-- 140, 141 -> mismos cheques, 2da carga de esa factura (mov 195, borrado 19/06/2026)
--             La carga vigente es el mov 201 (OP-0679/0680/0681, cheques 142/143/144).
-- 42       -> cheque 00000015 de la fila de cashflow 158 (factura A000300012883,
--             borrada 18/12/2025). El vigente es el cheque 39 (cashflow 230).
--
-- Solo se tocan filas que siguen activas y cuyo movimiento sigue borrado.

BEGIN;

UPDATE paychecks p
SET deleted_at = NOW()
FROM account_movements am
WHERE p.id IN (137, 138, 140, 141)
  AND p.deleted_at IS NULL
  AND am.id = p.movement_id
  AND am.deleted_at IS NOT NULL;

UPDATE paychecks p
SET deleted_at = NOW()
FROM cashflow c
WHERE p.id = 42
  AND p.deleted_at IS NULL
  AND c.id = p.cashflow_id
  AND c.deleted_at IS NOT NULL;

-- Control: los 5 deben quedar borrados y los vigentes (39, 142, 143, 144) activos.
SELECT id, number, amount, movement_id, cashflow_id, deleted_at
FROM paychecks
WHERE id IN (42, 137, 138, 140, 141, 39, 142, 143, 144)
ORDER BY id;

COMMIT;
