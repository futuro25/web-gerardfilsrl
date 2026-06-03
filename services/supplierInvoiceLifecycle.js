"use strict";

const supabase = require("../controllers/db");
const r2 = require("./r2");

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

async function getInvoiceByMovementId(movementId) {
  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("*")
    .eq("account_movement_id", movementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getActiveOrderForInvoice(supplierInvoiceId) {
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("supplier_invoice_id", supplierInvoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function getActiveOrderForMovement(movementId) {
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("account_movement_id", movementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function syncPendingMovementFromInvoice(invoice) {
  if (!invoice?.account_movement_id) return;

  const order = await getActiveOrderForInvoice(invoice.id);
  if (order) return;

  const documentDate =
    invoice.document_date ||
    invoice.due_date ||
    invoice.created_at?.slice?.(0, 10) ||
    null;

  await supabase
    .from("account_movements")
    .update({
      date: documentDate,
      amount: parseAmount(invoice.total ?? invoice.amount),
    })
    .eq("id", invoice.account_movement_id)
    .is("deleted_at", null);
}

async function cascadeDeleteSupplierInvoiceForMovement(movementId) {
  const invoice = await getInvoiceByMovementId(movementId);
  if (!invoice) return;

  const order = await getActiveOrderForInvoice(invoice.id);
  if (order) {
    throw new Error(
      "No se puede eliminar: la factura tiene una orden de pago activa. Anulá la OP primero."
    );
  }

  await supabase.from("taxes").delete().eq("supplier_invoice_id", invoice.id);

  const { error } = await supabase
    .from("supplier_invoices")
    .update({ deleted_at: new Date() })
    .eq("id", invoice.id);

  if (error) throw error;

  if (invoice.image_key) {
    try {
      await r2.deleteObject(invoice.image_key);
    } catch (e) {
      console.error("Error deleting invoice image:", e.message);
    }
  }
}

function buildMovementPaymentFields({
  payment_method,
  payment_date,
  amount,
  cheque_number,
  cheque_bank,
  cheque_due_date,
}) {
  const isCheque = payment_method === "CHEQUE";
  return {
    payment_method,
    is_cheque: isCheque,
    cheque_number: isCheque ? cheque_number : null,
    cheque_bank: isCheque ? cheque_bank : null,
    cheque_due_date: isCheque ? cheque_due_date : null,
    date: isCheque ? cheque_due_date : payment_date,
    amount: parseAmount(amount),
  };
}

function buildMovementPendingRevert(documentDate) {
  return {
    payment_method: null,
    is_cheque: false,
    cheque_number: null,
    cheque_bank: null,
    cheque_due_date: null,
    paycheck_id: null,
    date: documentDate,
  };
}

module.exports = {
  parseAmount,
  getInvoiceByMovementId,
  getActiveOrderForInvoice,
  getActiveOrderForMovement,
  syncPendingMovementFromInvoice,
  cascadeDeleteSupplierInvoiceForMovement,
  buildMovementPaymentFields,
  buildMovementPendingRevert,
};
