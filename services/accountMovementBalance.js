"use strict";

const supabase = require("../controllers/db");

/**
 * Movimientos vinculados a factura de proveedor sin OP no impactan saldo de caja.
 */
async function getBalanceExcludedMovementIds() {
  const { data: orders, error: ordersErr } = await supabase
    .from("payment_orders")
    .select("supplier_invoice_id")
    .is("deleted_at", null);

  if (ordersErr) throw ordersErr;

  const paidInvoiceIds = new Set(
    (orders || []).map((o) => o.supplier_invoice_id).filter((v) => v != null)
  );

  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id")
    .is("deleted_at", null);

  if (invErr) throw invErr;

  const excluded = new Set();
  (invoices || []).forEach((inv) => {
    if (
      inv.account_movement_id != null &&
      !paidInvoiceIds.has(inv.id)
    ) {
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
