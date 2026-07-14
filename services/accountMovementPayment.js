"use strict";

const PAYMENT_METHODS = new Set([
  "TRANSFERENCIA",
  "CHEQUE",
  "EFECTIVO",
  "TARJETA DE CREDITO",
  "DEBITO AUTOMATICO",
  "NOTA DE CREDITO",
]);

const EXPENSE_WITH_SUPPLIER_FIELDS = new Set(["OTRO", "SERVICIOS"]);
const EXPENSE_REQUIRES_SUPPLIER = new Set(["SERVICIOS"]);

/** Egresos con concepto distinto de factura de proveedor llevan forma de pago en el movimiento. */
function requiresDirectPaymentMethod(type, expenseCategory) {
  return (
    type === "EGRESO" &&
    expenseCategory != null &&
    expenseCategory !== "" &&
    expenseCategory !== "FACTURA"
  );
}

function validateEgresoSupplierFields(body) {
  if (body.type !== "EGRESO" || body.expense_category !== "SERVICIOS") {
    return null;
  }
  const supplierId = parseInt(body.supplier_id, 10);
  if (!Number.isFinite(supplierId) || supplierId <= 0) {
    return "Proveedor requerido";
  }
  const invoiceNumber = String(body.invoice_number || "").trim();
  if (!invoiceNumber) {
    return "Número de factura requerido";
  }
  return null;
}

function applyEgresoSupplierFields(movement, body) {
  if (
    body.type === "EGRESO" &&
    EXPENSE_WITH_SUPPLIER_FIELDS.has(body.expense_category)
  ) {
    const supplierId = parseInt(body.supplier_id, 10);
    movement.supplier_id =
      Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null;
    movement.invoice_number =
      body.expense_category === "SERVICIOS"
        ? String(body.invoice_number || "").trim() || null
        : null;
  } else {
    movement.supplier_id = null;
    movement.invoice_number = null;
  }
  return movement;
}

function validateDirectPaymentMethod(body) {
  const supplierErr = validateEgresoSupplierFields(body);
  if (supplierErr) return supplierErr;

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
  EXPENSE_WITH_SUPPLIER_FIELDS,
  EXPENSE_REQUIRES_SUPPLIER,
  requiresDirectPaymentMethod,
  validateEgresoSupplierFields,
  validateDirectPaymentMethod,
  applyEgresoSupplierFields,
  applyDirectPaymentMethod,
};
