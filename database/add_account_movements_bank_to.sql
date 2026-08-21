-- Transferencia entre cuentas propias.
--
-- Se registra como un único EGRESO con concepto 'TRANSFERENCIA_CUENTAS_PROPIAS':
-- `bank` es la cuenta de donde sale la plata y `bank_to` la cuenta donde entra.
-- No se cargan dos movimientos: la plata no sale de la empresa, así que el
-- movimiento no impacta el saldo global (ver movementCountsInBalance) y solo
-- mueve el saldo de cada banco.
--
-- Queda NULL en todo el resto de los movimientos.

alter table account_movements add column if not exists bank_to text;

-- Backfill del banco propio ---------------------------------------------------
-- Confirmado con el cliente: hasta hoy toda la operatoria fue por Galicia. La
-- migración anterior (add_bank_to_movements_and_payment_orders.sql) dejó los
-- ingresos sin completar porque no había forma de distinguir una transferencia
-- de un cobro en efectivo; ahora que el saldo se muestra abierto por banco,
-- dejarlos en NULL los mandaría a la bolsa "sin asignar".
--
-- Se excluyen las notas de crédito: no mueven plata de ninguna cuenta. Los
-- cheques recibidos sí se completan: se depositaron todos en Galicia, y sin
-- banco el saldo de esa cuenta quedaría corto al acreditarse.

update account_movements
set bank = 'GALICIA'
where bank is null
  and deleted_at is null
  and type = 'INGRESO'
  and coalesce(income_category, '') <> 'NOTA_CREDITO';

create index if not exists account_movements_bank_to_idx on account_movements (bank_to);
