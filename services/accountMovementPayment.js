"use strict";

const PAYMENT_METHODS = new Set([
  "TRANSFERENCIA",
  "CHEQUE",
  "EFECTIVO",
  "TARJETA DE CREDITO",
  "TARJETA DE DEBITO",
]);

/** Egresos con concepto distinto de factura de proveedor llevan forma de pago en el movimiento. */
function requiresDirectPaymentMethod(type, expenseCategory) {
  return (
    type === "EGRESO" &&
    expenseCategory != null &&
    expenseCategory !== "" &&
    expenseCategory !== "FACTURA"
  );
}

function validateDirectPaymentMethod(body) {
  if (!requiresDirectPaymentMethod(body.type, body.expense_category)) {
    return null;
  }
  if (!body.payment_method || !PAYMENT_METHODS.has(body.payment_method)) {
    return "Forma de pago requerida";
  }
  if (body.payment_method === "CHEQUE") {
    if (!body.cheque_number || !body.cheque_bank || !body.cheque_due_date) {
      return "Complete los datos del cheque";
    }
  }
  return null;
}

function applyDirectPaymentMethod(movement, body) {
  if (!requiresDirectPaymentMethod(body.type, body.expense_category)) {
    delete movement.payment_method;
    return movement;
  }

  movement.payment_method = body.payment_method;

  if (body.payment_method === "CHEQUE") {
    movement.is_cheque = true;
    movement.cheque_number = body.cheque_number || null;
    movement.cheque_bank = body.cheque_bank || null;
    movement.cheque_due_date = body.cheque_due_date || null;
    if (movement.cheque_due_date) {
      movement.date = movement.cheque_due_date;
    }
  } else {
    movement.is_cheque = false;
    movement.cheque_number = null;
    movement.cheque_bank = null;
    movement.cheque_due_date = null;
  }

  return movement;
}

module.exports = {
  PAYMENT_METHODS,
  requiresDirectPaymentMethod,
  validateDirectPaymentMethod,
  applyDirectPaymentMethod,
};
