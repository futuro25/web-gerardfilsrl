"use strict";

const supabase = require("../controllers/db");
const { isOwnBanksTransfer } = require("./accountMovementTransfer");
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

/**
 * Una transferencia entre cuentas propias no cambia cuánta plata hay: solo la
 * cambia de banco. Se descuenta del saldo global (y de los saldos futuros) acá,
 * en un único lugar; el saldo por banco la suma aparte, con signo en cada cuenta.
 *
 * Requiere que la fila traiga `type` y `expense_category`.
 */
function movementCountsInBalance(movement, excludedIds) {
  if (isOwnBanksTransfer(movement)) return false;
  return !excludedIds.has(movement.id);
}

module.exports = {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
};
