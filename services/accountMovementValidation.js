"use strict";

const { validateDirectPaymentMethod } = require("./accountMovementPayment");
const { validateEgresoVepFields } = require("./accountMovementVep");

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Valida campos obligatorios del movimiento según tipo y concepto.
 * Solo exige lo que corresponde a cada combinación (p. ej. Otro: proveedor sí, N° factura no).
 */
function validateMovementBody(body) {
  const type = body.type;
  if (!type || !["INGRESO", "EGRESO"].includes(type)) {
    return "Tipo de movimiento inválido";
  }

  const description = String(body.description || "").trim();
  if (!description) {
    return "Detalle requerido";
  }

  if (!body.date) {
    return "Fecha requerida";
  }

  if (parseAmount(body.amount) <= 0) {
    return "Monto requerido";
  }

  if (type === "EGRESO") {
    const category = body.expense_category;
    if (!category) {
      return "Concepto del egreso requerido";
    }
  }

  const vepErr = validateEgresoVepFields(body);
  if (vepErr) return vepErr;

  if (type === "INGRESO" && body.is_cheque) {
    if (!body.cheque_number || !body.cheque_bank || !body.cheque_due_date) {
      return "Complete los datos del cheque";
    }
  }

  return validateDirectPaymentMethod(body);
}

module.exports = {
  parseAmount,
  validateMovementBody,
};
