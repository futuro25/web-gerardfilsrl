-- Hace el certificado de retención autocontenido: guarda los totales de la
-- factura en la propia fila del certificado en vez de leerlos del pago.
-- Un certificado emitido no debe cambiar si después se edita el pago.
-- Ejecutar en Supabase SQL Editor.

ALTER TABLE retention_certificates
  ADD COLUMN IF NOT EXISTS total_amount DECIMAL(15, 2),
  ADD COLUMN IF NOT EXISTS total_to_pay DECIMAL(15, 2);

COMMENT ON COLUMN retention_certificates.total_amount IS 'Total de la factura al momento de emitir el certificado (congelado)';
COMMENT ON COLUMN retention_certificates.total_to_pay IS 'Total a pagar al proveedor al momento de emitir el certificado (total_amount - retention_amount)';

-- Backfill desde el pago asociado. Idempotente: solo completa filas vacías.
-- Incluye certificados soft-deleted para que un restore no quede en cero.
UPDATE retention_certificates rc
SET
  total_amount = COALESCE(rc.total_amount, rp.total_amount),
  total_to_pay = COALESCE(
    rc.total_to_pay,
    rp.total_to_pay,
    rp.total_amount - COALESCE(rc.retention_amount, 0)
  )
FROM retention_payments rp
WHERE rp.id = rc.retention_payment_id
  AND (rc.total_amount IS NULL OR rc.total_to_pay IS NULL);

-- Red de seguridad para certificados sin pago recuperable: reconstruir el
-- total desde el neto (IVA 21%), que es el fallback histórico de la app.
UPDATE retention_certificates rc
SET
  total_amount = round(rc.net_amount * 1.21, 2),
  total_to_pay = round(rc.net_amount * 1.21, 2) - COALESCE(rc.retention_amount, 0)
WHERE rc.total_amount IS NULL
  AND rc.net_amount IS NOT NULL;

-- Verificación: debe devolver 0 filas.
-- SELECT id, certificate_number, total_amount, total_to_pay
-- FROM retention_certificates
-- WHERE total_amount IS NULL OR total_to_pay IS NULL;
