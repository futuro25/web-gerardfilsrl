-- Separa el vínculo de los cheques con Cashflow del vínculo con Control.
--
-- Hasta ahora paychecks.movement_id guardaba a veces un id de cashflow (cheques
-- cargados desde Cashflow / a mano en 2025) y a veces un id de account_movements
-- (cheques de órdenes de pago / Control). Como los ids se pisan entre tablas, la
-- pantalla de cheques le asignaba a cheques viejos de cashflow la orden de pago y
-- el proveedor de un movimiento de Control sin relación (ej: cheque 00000005 de
-- $707.076,50 a GENOVESI aparecía como OP-0718 de LILLO MARIA NELLY).
--
-- Desde ahora: movement_id -> account_movements.id, cashflow_id -> cashflow.id.

BEGIN;

ALTER TABLE paychecks
  ADD COLUMN IF NOT EXISTS cashflow_id INTEGER REFERENCES cashflow(id);

CREATE INDEX IF NOT EXISTS idx_paychecks_cashflow_id ON paychecks (cashflow_id);

COMMENT ON COLUMN paychecks.movement_id IS 'Movimiento de Control (account_movements.id) vinculado al cheque';
COMMENT ON COLUMN paychecks.cashflow_id IS 'Movimiento de Cashflow (cashflow.id) vinculado al cheque';

-- Backfill: cheques cuyo movement_id en realidad es un id de cashflow.
-- Lista revisada uno por uno (importe y momento de carga coinciden con la fila de
-- cashflow, o el cheque es anterior a la existencia de account_movements).
-- Solo se tocan filas que siguen apuntando al mismo id, por si algo cambió.
WITH pairs (paycheck_id, cashflow_id) AS (
  VALUES
  (1, 78),
  (39, 230),
  (40, 163),
  (41, 162),
  (42, 158),
  (43, 160),
  (44, 66),
  (45, 205),
  (46, 63),
  (47, 64),
  (48, 140),
  (49, 141),
  (50, 231),
  (51, 232),
  (52, 233),
  (53, 234),
  (54, 240),
  (55, 241),
  (56, 242),
  (57, 244),
  (58, 247),
  (59, 248),
  (60, 308),
  (61, 309),
  (62, 310),
  (63, 313),
  (64, 314),
  (65, 315),
  (66, 316),
  (67, 319),
  (68, 320),
  (69, 321),
  (70, 322),
  (71, 323),
  (72, 359),
  (73, 361),
  (74, 393),
  (75, 395),
  (76, 398),
  (77, 399),
  (78, 408),
  (79, 423),
  (80, 424),
  (81, 425),
  (82, 426),
  (83, 427),
  (84, 428),
  (85, 429),
  (86, 462),
  (87, 464),
  (88, 475),
  (89, 476),
  (90, 478),
  (91, 482),
  (92, 489),
  (93, 490),
  (94, 491),
  (95, 503),
  (96, 512),
  (97, 513),
  (98, 516),
  (99, 527),
  (100, 528),
  (101, 532),
  (102, 533),
  (103, 544),
  (104, 553),
  (105, 570),
  (106, 616),
  (107, 632),
  (108, 681),
  (109, 682),
  (110, 683),
  (111, 684),
  (114, 705),
  (115, 719),
  (116, 720),
  (117, 721),
  (123, 718),
  (124, 716),
  (125, 717),
  (126, 718),
  (127, 719),
  (128, 720),
  (129, 721)
)
UPDATE paychecks p
SET cashflow_id = pairs.cashflow_id,
    movement_id = NULL
FROM pairs
WHERE p.id = pairs.paycheck_id
  AND p.movement_id = pairs.cashflow_id
  AND p.cashflow_id IS NULL;

-- Control: deberían quedar 85 filas con cashflow_id.
SELECT COUNT(*) AS paychecks_con_cashflow_id FROM paychecks WHERE cashflow_id IS NOT NULL;

COMMIT;
