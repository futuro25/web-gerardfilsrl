"use strict";

const supabase = require("../controllers/db");
const {
  getRetentionAmountsByInvoiceIds,
} = require("./retentionInvoiceLink");

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function invoiceTotal(invoice) {
  return parseAmount(invoice?.total ?? invoice?.amount);
}

function sumOrderAmounts(orders) {
  return (orders || []).reduce(
    (acc, order) => acc + parseAmount(order.amount),
    0
  );
}

function roundMoney(value) {
  return Math.round(parseAmount(value) * 100) / 100;
}

function buildPaymentSummary(invoice, orders, retentionAmount = 0) {
  const total = invoiceTotal(invoice);
  const paidAmount = roundMoney(sumOrderAmounts(orders));
  const retention = roundMoney(retentionAmount);
  const settledAmount = roundMoney(paidAmount + retention);
  const remainingAmount = roundMoney(Math.max(0, total - settledAmount));
  const fullyPaid = remainingAmount <= 0.009;

  return {
    invoiceTotal: total,
    paidAmount,
    retentionAmount: retention,
    settledAmount,
    remainingAmount,
    fullyPaid,
    orders: orders || [],
    orderCount: (orders || []).length,
  };
}

async function getActiveOrdersForInvoice(supplierInvoiceId) {
  if (supplierInvoiceId == null) return [];
  const { data, error } = await supabase
    .from("payment_orders")
    .select(
      "id, order_number, supplier_invoice_id, amount, payment_method, payment_date, cheque_number, cheque_bank, cheque_due_date, created_at"
    )
    .eq("supplier_invoice_id", supplierInvoiceId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function getInvoicePaymentSummary(invoice) {
  if (!invoice?.id) {
    return buildPaymentSummary(invoice, []);
  }
  const orders = await getActiveOrdersForInvoice(invoice.id);
  const retentionById = await getRetentionAmountsByInvoiceIds([invoice.id]);
  return buildPaymentSummary(
    invoice,
    orders,
    retentionById[invoice.id] || 0
  );
}

async function getPaidAmountsByInvoiceIds(invoiceIds) {
  if (!invoiceIds?.length) return {};
  const { data, error } = await supabase
    .from("payment_orders")
    .select("supplier_invoice_id, amount")
    .in("supplier_invoice_id", invoiceIds)
    .is("deleted_at", null);
  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    if (row.supplier_invoice_id == null) return;
    map[row.supplier_invoice_id] =
      roundMoney((map[row.supplier_invoice_id] || 0) + parseAmount(row.amount));
  });
  return map;
}

async function getOrdersGroupedByInvoiceIds(invoiceIds) {
  if (!invoiceIds?.length) return {};
  const { data, error } = await supabase
    .from("payment_orders")
    .select(
      "id, order_number, supplier_invoice_id, amount, payment_method, payment_date, cheque_number, cheque_bank, cheque_due_date, created_at"
    )
    .in("supplier_invoice_id", invoiceIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const map = {};
  (data || []).forEach((row) => {
    if (row.supplier_invoice_id == null) return;
    if (!map[row.supplier_invoice_id]) map[row.supplier_invoice_id] = [];
    map[row.supplier_invoice_id].push(row);
  });
  return map;
}

function isInvoiceFullyPaid(invoice, paidAmount, retentionAmount = 0) {
  const total = invoiceTotal(invoice);
  const settled = roundMoney(parseAmount(paidAmount) + parseAmount(retentionAmount));
  return roundMoney(Math.max(0, total - settled)) <= 0.009;
}

module.exports = {
  parseAmount,
  invoiceTotal,
  sumOrderAmounts,
  roundMoney,
  buildPaymentSummary,
  getActiveOrdersForInvoice,
  getInvoicePaymentSummary,
  getPaidAmountsByInvoiceIds,
  getRetentionAmountsByInvoiceIds,
  getOrdersGroupedByInvoiceIds,
  isInvoiceFullyPaid,
};
