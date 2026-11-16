"use strict";

const supabase = require("../controllers/db");
const { DateTime } = require("luxon");

// Un mismo cheque físico no puede cargarse dos veces. El número se compara sin
// ceros a la izquierda ("00000048" y "48" son el mismo cheque) y el banco sin
// distinguir mayúsculas.
//
// Única excepción: un cheque que paga varias facturas genera una OP por factura,
// cada una con su propio registro en paychecks. Mientras no se unifique ese
// modelo, se admite repetir el número solo si todos los registros existentes
// son de OP activas de OTRAS facturas.

function normalizeChequeNumber(value) {
  if (value == null) return null;
  const s = String(value).trim();
  if (!s) return null;
  if (/^\d+$/.test(s)) return s.replace(/^0+(?=\d)/, "");
  return s.toUpperCase();
}

function normalizeBankName(value) {
  return String(value || "").trim().toUpperCase();
}

function formatDate(value) {
  if (!value) return "";
  const dt = DateTime.fromISO(String(value).slice(0, 10));
  return dt.isValid ? dt.toFormat("dd/MM/yyyy") : String(value);
}

async function findActiveOutPaychecks({ number, bank, excludeIds = [] }) {
  const norm = normalizeChequeNumber(number);
  const bankNorm = normalizeBankName(bank);
  if (!norm || !bankNorm) return [];

  const exclude = new Set(
    excludeIds.filter((v) => v != null).map((v) => Number(v))
  );

  // El filtro por sufijo acota la consulta; la comparación exacta va abajo.
  const { data, error } = await supabase
    .from("paychecks")
    .select("id, number, bank, amount, due_date, movement_id, cashflow_id")
    .eq("type", "OUT")
    .is("deleted_at", null)
    .ilike("number", `%${norm}`);

  if (error) throw error;

  return (data || []).filter(
    (p) =>
      !exclude.has(Number(p.id)) &&
      normalizeChequeNumber(p.number) === norm &&
      normalizeBankName(p.bank) === bankNorm
  );
}

// Dónde está cargado cada cheque, para que el mensaje diga qué revisar.
async function describePaychecks(paychecks) {
  const ids = paychecks.map((p) => p.id);
  const cashflowIds = paychecks.map((p) => p.cashflow_id).filter(Boolean);

  const [{ data: orders }, { data: movements }, { data: cashflows }] =
    await Promise.all([
      supabase
        .from("payment_orders")
        .select("paycheck_id, order_number, supplier_invoice_id")
        .in("paycheck_id", ids)
        .is("deleted_at", null),
      supabase
        .from("account_movements")
        .select("id, paycheck_id, description, date")
        .or(
          [
            `paycheck_id.in.(${ids.join(",")})`,
            ...paychecks
              .filter((p) => p.movement_id)
              .map((p) => `id.eq.${p.movement_id}`),
          ].join(",")
        )
        .is("deleted_at", null),
      cashflowIds.length
        ? supabase
            .from("cashflow")
            .select("id, description, date")
            .in("id", cashflowIds)
            .is("deleted_at", null)
        : Promise.resolve({ data: [] }),
    ]);

  return paychecks.map((p) => {
    const order = (orders || []).find((o) => o.paycheck_id === p.id);
    const movement = (movements || []).find(
      (m) => m.paycheck_id === p.id || (p.movement_id && m.id === p.movement_id)
    );
    const cashflow = (cashflows || []).find((c) => c.id === p.cashflow_id);

    let where;
    if (order) where = `la ${order.order_number}`;
    else if (movement)
      where = `el movimiento de Control "${movement.description || "sin descripción"}" del ${formatDate(movement.date)}`;
    else if (cashflow)
      where = `el egreso de Cashflow "${cashflow.description || "sin descripción"}" del ${formatDate(cashflow.date)}`;
    else where = `el listado de Cheques (registro #${p.id})`;

    return { paycheck: p, order: order || null, where };
  });
}

function duplicateError(message) {
  const err = new Error(message);
  err.code = "DUPLICATE_PAYCHECK";
  return err;
}

/**
 * Lanza DUPLICATE_PAYCHECK si el cheque (banco + número) ya está cargado y
 * activo. `supplierInvoiceId` se pasa solo desde una orden de pago: habilita el
 * caso de un cheque que paga varias facturas distintas.
 */
async function assertChequeNotDuplicated({
  number,
  bank,
  excludePaycheckIds = [],
  supplierInvoiceId = null,
}) {
  const existing = await findActiveOutPaychecks({
    number,
    bank,
    excludeIds: excludePaycheckIds,
  });
  if (!existing.length) return;

  const described = await describePaychecks(existing);
  const label = `El cheque ${normalizeChequeNumber(number)} del ${normalizeBankName(bank)}`;

  if (supplierInvoiceId != null) {
    const sameInvoice = described.find(
      (d) =>
        d.order &&
        Number(d.order.supplier_invoice_id) === Number(supplierInvoiceId)
    );
    if (sameInvoice) {
      throw duplicateError(
        `${label} ya está usado en ${sameInvoice.where} de esta misma factura. Revisá el número del cheque.`
      );
    }
    const allFromOtherOrders = described.every((d) => d.order);
    if (allFromOtherOrders) return;
  }

  const list = described.map((d) => d.where);
  const places =
    list.length > 1
      ? `${list.slice(0, -1).join(", ")} y en ${list[list.length - 1]}`
      : list[0];
  throw duplicateError(
    `${label} ya está cargado en ${places}. No se puede cargar dos veces el mismo cheque: revisá el número o unificá los registros.`
  );
}

module.exports = {
  normalizeChequeNumber,
  normalizeBankName,
  findActiveOutPaychecks,
  assertChequeNotDuplicated,
};
