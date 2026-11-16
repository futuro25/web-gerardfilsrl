-- Trazabilidad de cheques unificados.
--
-- El 16/11/2026 se unificaron cheques duplicados por API (service role), en dos
-- lotes. Cada baja quedó en audit_log (entity = 'paychecks', action = 'delete',
-- path 'database/merge_duplicate_paychecks_lote1.sql' / '..._lote2.sql') con la
-- copia previa del registro en entity_snapshot y el cheque que se conservó en
-- payload->>'merged_into_id'. Los movimientos sueltos de Control que duplicaban
-- la salida de banco de una OP quedaron igual (entity = 'account-movements',
-- payload->>'duplicate_of_paycheck_id').
--
-- La API no permite crear columnas: esto crea merged_into_id y la completa
-- desde audit_log. Correr en el editor SQL de Supabase.

BEGIN;

ALTER TABLE paychecks
  ADD COLUMN IF NOT EXISTS merged_into_id bigint REFERENCES paychecks(id);

COMMENT ON COLUMN paychecks.merged_into_id IS
  'Cheque dado de baja por duplicado: apunta al registro que se conservó';

UPDATE paychecks p
SET merged_into_id = (a.payload->>'merged_into_id')::bigint
FROM audit_log a
WHERE a.entity = 'paychecks'
  AND a.action = 'delete'
  AND a.path LIKE 'database/merge_duplicate_paychecks_lote%'
  AND a.payload ? 'merged_into_id'
  AND a.entity_id = p.id::text
  AND p.deleted_at IS NOT NULL
  AND p.merged_into_id IS NULL;

-- Control: 15 cheques dados de baja, cada uno con el que quedó.
SELECT p.id, p.number, p.amount, p.merged_into_id, k.number AS queda_numero, k.deleted_at AS queda_baja
FROM paychecks p
JOIN paychecks k ON k.id = p.merged_into_id
ORDER BY p.merged_into_id, p.id;

COMMIT;
