"use strict";

const {
  OWN_BANKS,
  TRANSFER_EXPENSE_CATEGORY,
  normalizeBank,
} = require("./accountMovementPayment");

/**
 * True si el movimiento es una transferencia entre cuentas propias.
 * Recibe tanto un body del formulario como una fila de la tabla.
 */
function isOwnBanksTransfer(movement) {
  return (
    movement?.type === "EGRESO" &&
    movement?.expense_category === TRANSFER_EXPENSE_CATEGORY
  );
}

/**
 * Valida origen y destino. Ambos tienen que ser cuentas nuestras y distintas:
 * la plata no sale de la empresa, solo cambia de banco.
 */
function validateTransferFields(body) {
  if (!isOwnBanksTransfer(body)) return null;

  const from = normalizeBank(body.bank);
  const to = normalizeBank(body.bank_to);

  if (!from) return "Indicá de qué banco sale la transferencia";
  if (!to) return "Indicá a qué banco entra la transferencia";
  if (!OWN_BANKS.has(from) || !OWN_BANKS.has(to)) {
    return `Banco inválido. Valores permitidos: ${[...OWN_BANKS].join(", ")}.`;
  }
  if (from === to) {
    return "El banco de origen y el de destino tienen que ser distintos";
  }
  return null;
}

/**
 * Completa los campos de la transferencia y limpia lo que no aplica.
 * La forma de pago se fuerza acá: entre cuentas propias siempre es transferencia,
 * nunca cheque ni efectivo.
 */
function applyTransferFields(movement, body) {
  if (!isOwnBanksTransfer(body)) {
    movement.bank_to = null;
    return movement;
  }

  movement.payment_method = "TRANSFERENCIA";
  movement.bank = normalizeBank(body.bank);
  movement.bank_to = normalizeBank(body.bank_to);
  movement.is_cheque = false;
  movement.cheque_number = null;
  movement.cheque_bank = null;
  movement.cheque_due_date = null;
  movement.supplier_id = null;
  movement.invoice_number = null;

  return movement;
}

module.exports = {
  TRANSFER_EXPENSE_CATEGORY,
  isOwnBanksTransfer,
  validateTransferFields,
  applyTransferFields,
};
