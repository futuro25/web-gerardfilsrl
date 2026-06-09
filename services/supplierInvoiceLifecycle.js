"use strict";

const supabase = require("../controllers/db");
const r2 = require("./r2");
const { getActiveOrdersForInvoice } = require("./invoicePaymentSummary");

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
  const orders = await getActiveOrdersForInvoice(supplierInvoiceId);
  return orders.length ? orders[orders.length - 1] : null;
}

async function getActiveOrderForMovement(movementId) {
  const { data, error } = await supabase
    .from("payment_orders")
    .select("*")
    .eq("account_movement_id", movementId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
}

async function syncPendingMovementFromInvoice(invoice) {
  if (!invoice?.account_movement_id) return;

  const orders = await getActiveOrdersForInvoice(invoice.id);
  if (orders.length) return;

  const documentDate =
    invoice.document_date ||
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

/** Actualiza solo la fecha del comprobante en el movimiento (aunque haya OP). */
async function syncMovementDocumentDateFromInvoice(invoice) {
  if (!invoice?.account_movement_id) return;

  const documentDate =
    invoice.document_date ||
    invoice.created_at?.slice?.(0, 10) ||
    null;
  if (!documentDate) return;

  await supabase
    .from("account_movements")
    .update({ date: documentDate })
    .eq("id", invoice.account_movement_id)
    .is("deleted_at", null);
}

async function softDeletePaymentOrders({ movementId, supplierInvoiceId }) {
  const ids = new Set();

  if (movementId) {
    const { data, error } = await supabase
      .from("payment_orders")
      .select("id")
      .eq("account_movement_id", movementId)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((o) => ids.add(o.id));
  }

  if (supplierInvoiceId) {
    const { data, error } = await supabase
      .from("payment_orders")
      .select("id")
      .eq("supplier_invoice_id", supplierInvoiceId)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((o) => ids.add(o.id));
  }

  if (!ids.size) return;

  const deletedAt = new Date().toISOString();
  const { error } = await supabase
    .from("payment_orders")
    .update({ deleted_at: deletedAt })
    .in("id", [...ids])
    .is("deleted_at", null);
  if (error) throw error;
}

async function softDeleteRetentionsForInvoice({ supplierInvoiceId, accountMovementId }) {
  const paymentIds = new Set();

  if (supplierInvoiceId) {
    const { data, error } = await supabase
      .from("retention_payments")
      .select("id")
      .eq("supplier_invoice_id", supplierInvoiceId)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((p) => paymentIds.add(p.id));
  }

  if (accountMovementId) {
    const { data, error } = await supabase
      .from("retention_payments")
      .select("id")
      .eq("account_movement_id", accountMovementId)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((p) => paymentIds.add(p.id));
  }

  if (!paymentIds.size) return;

  const deletedAt = new Date().toISOString();
  const ids = [...paymentIds];

  await supabase
    .from("retention_certificates")
    .update({ deleted_at: deletedAt })
    .in("retention_payment_id", ids)
    .is("deleted_at", null);

  const { error } = await supabase
    .from("retention_payments")
    .update({ deleted_at: deletedAt })
    .in("id", ids)
    .is("deleted_at", null);
  if (error) throw error;
}

async function cascadeDeleteSupplierInvoiceForMovement(movementId) {
  const invoice = await getInvoiceByMovementId(movementId);
  if (!invoice) return null;

  await softDeletePaymentOrders({
    movementId,
    supplierInvoiceId: invoice.id,
  });
  await softDeleteRetentionsForInvoice({
    supplierInvoiceId: invoice.id,
    accountMovementId: movementId,
  });

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

  return invoice;
}

/** Elimina en cascada OP, retenciones, factura, cheque vinculado y el movimiento. */
async function cascadeDeleteMovementAndRelated(movement) {
  const movementId = movement.id;

  const invoice = await getInvoiceByMovementId(movementId);

  if (invoice) {
    await cascadeDeleteSupplierInvoiceForMovement(movementId);
  } else {
    await softDeletePaymentOrders({ movementId, supplierInvoiceId: null });
    await softDeleteRetentionsForInvoice({
      supplierInvoiceId: null,
      accountMovementId: movementId,
    });
  }

  if (movement.paycheck_id) {
    const { error: paycheckError } = await supabase
      .from("paychecks")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", movement.paycheck_id)
      .is("deleted_at", null);
    if (paycheckError) {
      console.error("Error deleting linked paycheck:", paycheckError);
    }
  }

  const { error } = await supabase
    .from("account_movements")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", movementId)
    .is("deleted_at", null);
  if (error) throw error;
}

function buildMovementPaymentFields({
  payment_method,
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
  syncMovementDocumentDateFromInvoice,
  cascadeDeleteSupplierInvoiceForMovement,
  cascadeDeleteMovementAndRelated,
  buildMovementPaymentFields,
  buildMovementPendingRevert,
};
