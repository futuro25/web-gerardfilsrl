-- Renombrar forma de pago en datos existentes.
UPDATE account_movements
SET payment_method = 'DEBITO AUTOMATICO'
WHERE payment_method = 'TARJETA DE DEBITO';

UPDATE payment_orders
SET payment_method = 'DEBITO AUTOMATICO'
WHERE payment_method = 'TARJETA DE DEBITO';
