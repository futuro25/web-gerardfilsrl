"use strict";

const supabase = require("../controllers/db");
const {
  getPaidAmountsByInvoiceIds,
  getRetentionAmountsByInvoiceIds,
  isInvoiceFullyPaid,
  invoiceTotal,
} = require("./invoicePaymentSummary");

/**
 * Movimientos vinculados a factura de proveedor sin saldar no impactan saldo de caja.
 */
async function getBalanceExcludedMovementIds() {
  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id, amount, total")
    .is("deleted_at", null);

  if (invErr) throw invErr;

  const invoiceIds = (invoices || []).map((inv) => inv.id);
  const paidByInvoiceId = await getPaidAmountsByInvoiceIds(invoiceIds);
  const retentionByInvoiceId = await getRetentionAmountsByInvoiceIds(invoiceIds);

  const excluded = new Set();
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id == null) return;
    const paid = paidByInvoiceId[inv.id] || 0;
    const retention = retentionByInvoiceId[inv.id] || 0;
    if (!isInvoiceFullyPaid(inv, paid, retention)) {
      excluded.add(inv.account_movement_id);
    }
  });

  return excluded;
}

function movementCountsInBalance(movement, excludedIds) {
  return !excludedIds.has(movement.id);
}

module.exports = {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
};
