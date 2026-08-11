"use strict";

const supabase = require("../controllers/db");

/**
 * El movimiento de Control representa plata que se movió del banco.
 * La retención practicada no sale de caja con la factura: sale después, cuando
 * se paga el VEP de SICORE. Por eso el importe del movimiento tiene que ser
 * total de la factura - retenciones practicadas.
 */

const TOLERANCE = 0.5;

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(parseAmount(value) * 100) / 100;
}

function amountsMatch(a, b) {
  return Math.abs(parseAmount(a) - parseAmount(b)) <= TOLERANCE;
}

function formatAmount(value) {
  return parseAmount(value).toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Importe que debe reflejar el movimiento de Control. */
function netMovementAmount(invoiceTotalAmount, retentionTotal = 0) {
  return roundMoney(
    Math.max(0, parseAmount(invoiceTotalAmount) - parseAmount(retentionTotal))
  );
}

async function getInvoicesForMovement(accountMovementId) {
  if (accountMovementId == null) return [];
  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, amount, total, account_movement_id")
    .eq("account_movement_id", accountMovementId)
    .is("deleted_at", null);
  if (error) throw error;
  return data || [];
}

/**
 * Suma de retenciones vigentes, tomando las vinculadas por factura y por
 * movimiento (una retención puede tener solo uno de los dos vínculos).
 */
async function getRetentionTotal({
  supplierInvoiceIds = [],
  accountMovementId = null,
} = {}) {
  const rows = new Map();

  if (supplierInvoiceIds.length) {
    const { data, error } = await supabase
      .from("retention_payments")
      .select("id, retention_amount")
      .in("supplier_invoice_id", supplierInvoiceIds)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((r) => rows.set(r.id, r));
  }

  if (accountMovementId != null) {
    const { data, error } = await supabase
      .from("retention_payments")
      .select("id, retention_amount")
      .eq("account_movement_id", accountMovementId)
      .is("deleted_at", null);
    if (error) throw error;
    (data || []).forEach((r) => rows.set(r.id, r));
  }

  let total = 0;
  rows.forEach((r) => {
    total += parseAmount(r.retention_amount);
  });
  return roundMoney(total);
}

/** Resuelve el movimiento de Control a partir de la factura o del propio id. */
async function resolveMovementId({
  supplierInvoiceId = null,
  accountMovementId = null,
} = {}) {
  if (accountMovementId != null) return Number(accountMovementId);
  if (supplierInvoiceId == null) return null;

  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id")
    .eq("id", supplierInvoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  return data?.account_movement_id ?? null;
}

/**
 * Ajusta el importe del movimiento de Control al neto (total - retenciones).
 *
 * Solo ajusta cuando el importe actual es explicable: el total de la/s factura/s
 * (nunca se ajustó) o el neto calculado con las retenciones anteriores. Si alguien
 * cargó un importe distinto a mano, no lo pisa: devuelve el desfasaje para avisar.
 *
 * @param {number|null} previousRetentionTotal retenciones vigentes antes del cambio.
 */
async function syncMovementAmountForRetention({
  supplierInvoiceId = null,
  accountMovementId = null,
  previousRetentionTotal = null,
} = {}) {
  const movementId = await resolveMovementId({
    supplierInvoiceId,
    accountMovementId,
  });
  if (movementId == null) {
    return { status: "not_applicable", reason: "sin_movimiento" };
  }

  const { data: movement, error: movErr } = await supabase
    .from("account_movements")
    .select("id, type, amount")
    .eq("id", movementId)
    .is("deleted_at", null)
    .maybeSingle();
  if (movErr) throw movErr;
  if (!movement) {
    return { status: "not_applicable", reason: "movimiento_inexistente" };
  }
  if (movement.type !== "EGRESO") {
    return { status: "not_applicable", reason: "movimiento_no_egreso" };
  }

  const invoices = await getInvoicesForMovement(movementId);
  if (!invoices.length) {
    return { status: "not_applicable", reason: "movimiento_sin_factura" };
  }

  const invoicesTotal = roundMoney(
    invoices.reduce((acc, inv) => acc + parseAmount(inv.total ?? inv.amount), 0)
  );
  const retentionTotal = await getRetentionTotal({
    supplierInvoiceIds: invoices.map((inv) => inv.id),
    accountMovementId: movementId,
  });
  const expectedAmount = netMovementAmount(invoicesTotal, retentionTotal);
  const currentAmount = roundMoney(movement.amount);

  const base = {
    movement_id: movementId,
    invoices_total: invoicesTotal,
    retention_total: retentionTotal,
    expected_amount: expectedAmount,
    current_amount: currentAmount,
  };

  if (amountsMatch(currentAmount, expectedAmount)) {
    return { ...base, status: "in_sync" };
  }

  const adjustable =
    amountsMatch(currentAmount, invoicesTotal) ||
    (previousRetentionTotal != null &&
      amountsMatch(
        currentAmount,
        netMovementAmount(invoicesTotal, previousRetentionTotal)
      ));

  if (!adjustable) {
    const message =
      `El movimiento #${movementId} de Control quedó en $${formatAmount(currentAmount)} ` +
      `y según la factura y sus retenciones debería ser $${formatAmount(expectedAmount)}. ` +
      `Como el importe fue cargado a mano, no se modificó: revisalo.`;
    console.warn("[retencion] importe manual, no se ajusta:", base);
    return { ...base, status: "skipped", reason: "importe_manual", message };
  }

  const { error: updErr } = await supabase
    .from("account_movements")
    .update({ amount: expectedAmount })
    .eq("id", movementId)
    .is("deleted_at", null);
  if (updErr) throw updErr;

  const message =
    `Se ajustó la salida del movimiento #${movementId} de ` +
    `$${formatAmount(currentAmount)} a $${formatAmount(expectedAmount)} ` +
    `(total de la factura menos la retención). La retención sale de caja al pagar el VEP.`;

  return { ...base, status: "updated", message };
}

module.exports = {
  parseAmount,
  roundMoney,
  netMovementAmount,
  getRetentionTotal,
  resolveMovementId,
  syncMovementAmountForRetention,
};
