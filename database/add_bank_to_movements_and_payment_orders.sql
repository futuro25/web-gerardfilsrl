-- Banco propio por donde entró o salió la plata.
--
-- Semántica: SIEMPRE es una cuenta nuestra. No confundir con `cheque_bank`, que
-- en un INGRESO es el banco del cliente que nos entregó el cheque. Por eso los
-- cheques recibidos quedan con `bank` en NULL: el banco propio recién se conoce
-- cuando se deposita, y hoy eso no se registra.
--
-- Queda NULL cuando no aplica: efectivo, nota de crédito y cheques recibidos.

alter table account_movements add column if not exists bank text;
alter table payment_orders add column if not exists bank text;

-- Backfill --------------------------------------------------------------------
-- Hasta ahora las transferencias salieron siempre del Galicia, y los cheques
-- emitidos son de la chequera del banco que ya quedó guardado en cheque_bank.

-- 1) Egresos con cheque emitido: el banco propio es el del cheque.
update account_movements
set bank = cheque_bank
where bank is null
  and type = 'EGRESO'
  and is_cheque = true
  and cheque_bank is not null;

-- 2) Egresos por transferencia o débito automático: Galicia.
update account_movements
set bank = 'GALICIA'
where bank is null
  and type = 'EGRESO'
  and payment_method in ('TRANSFERENCIA', 'DEBITO AUTOMATICO', 'TARJETA DE DEBITO');

-- 3) Mismas dos reglas sobre las órdenes de pago.
update payment_orders
set bank = cheque_bank
where bank is null
  and payment_method = 'CHEQUE'
  and cheque_bank is not null;

update payment_orders
set bank = 'GALICIA'
where bank is null
  and payment_method in ('TRANSFERENCIA', 'DEBITO AUTOMATICO', 'TARJETA DE DEBITO');

-- Los INGRESOS a propósito NO se rellenan: no hay forma de pago guardada, así que
-- no se puede distinguir una transferencia de un cobro en efectivo. Se completan
-- de acá en adelante desde el formulario. Si se confirma que todos los ingresos
-- que no son cheque entraron por Galicia, correr a mano:
--
--   update account_movements
--   set bank = 'GALICIA'
--   where bank is null and type = 'INGRESO' and is_cheque = false;

create index if not exists account_movements_bank_idx on account_movements (bank);
