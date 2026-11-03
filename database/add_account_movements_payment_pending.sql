-- Egreso cargado como pendiente de pago, sin factura de proveedor.
--
-- Las facturas no usan esta columna: su estado sale de las órdenes de pago. Los
-- VEP tampoco, porque tienen su propio circuito.
--
-- Mientras esté en true, el movimiento no impacta ningún saldo (ver
-- getBalanceExcludedMovementIds) y no lleva forma de pago: se completa al pagarlo.

alter table account_movements
  add column if not exists payment_pending boolean not null default false;

create index if not exists account_movements_payment_pending_idx
  on account_movements (payment_pending)
  where payment_pending = true;
