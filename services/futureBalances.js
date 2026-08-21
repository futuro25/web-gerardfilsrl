"use strict";

const { DateTime } = require("luxon");
const supabase = require("../controllers/db");
const {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
} = require("./accountMovementBalance");
const { attachSupplierNames } = require("./accountMovementSuppliers");
const { attachVepInfo } = require("./accountMovementVep");
const { attachCreditNoteInfo } = require("./accountMovementCreditNote");
const { getProjectedFixedExpenses } = require("./fixedExpenses");

/**
 * Saldo proyectado día a día hasta `until`, con el detalle de qué compone cada día.
 * Incluye movimientos cargados con fecha efectiva futura, cheques en su
 * vencimiento, VEPs pendientes y los gastos fijos que aún no tienen movimiento.
 *
 * @param {{ until?: string, days?: number, months?: number }} options
 * @returns {Promise<{ data: Array, currentBalance: number, today: string, until: string }>}
 */
async function computeFutureBalances(options = {}) {
  const today = options.today || DateTime.now().toISODate();

  let until = options.until;
  if (!until) {
    const base = DateTime.fromISO(today);
    until = options.days
      ? base.plus({ days: options.days }).toISODate()
      : base.plus({ months: options.months || 3 }).toISODate();
  }

  const { data: rows, error } = await supabase
    .from("account_movements")
    // expense_category entra para que movementCountsInBalance pueda descartar
    // las transferencias entre cuentas propias.
    .select(
      "id, type, amount, date, is_cheque, cheque_due_date, created_at, expense_category"
    )
    .is("deleted_at", null);
  if (error) throw error;

  const excludedIds = await getBalanceExcludedMovementIds();

  const withEff = (rows || [])
    .filter((m) => movementCountsInBalance(m, excludedIds))
    .map((m) => ({
      id: m.id,
      eff: m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date,
      created_at: m.created_at || "",
      delta: m.type === "INGRESO" ? parseFloat(m.amount) : -parseFloat(m.amount),
    }));

  withEff.sort((a, b) => {
    if (a.eff !== b.eff) return a.eff.localeCompare(b.eff);
    return String(a.created_at).localeCompare(String(b.created_at));
  });

  let balanceThroughToday = 0;
  for (const ev of withEff) {
    if (ev.eff > today) break;
    balanceThroughToday += ev.delta;
  }

  // Cada día futuro guarda sus movimientos, no solo el neto: quien lo muestra
  // necesita poder decir de qué es cada uno.
  const itemsByDate = new Map();
  const pushItem = (date, item) => {
    if (!itemsByDate.has(date)) itemsByDate.set(date, []);
    itemsByDate.get(date).push(item);
  };

  // Solo los movimientos futuros necesitan el detalle completo.
  const futureMovements = withEff.filter((ev) => ev.eff > today);
  let enrichedMovements = [];
  if (futureMovements.length) {
    const { data: fullRows, error: fullErr } = await supabase
      .from("account_movements")
      .select("*")
      .in("id", futureMovements.map((ev) => ev.id));
    if (fullErr) throw fullErr;

    enrichedMovements = await attachCreditNoteInfo(
      await attachVepInfo(await attachSupplierNames(fullRows || []))
    );
  }
  const enrichedById = new Map(enrichedMovements.map((m) => [m.id, m]));

  // N° de factura de proveedor: en los egresos con concepto "Factura" no vive
  // en el movimiento sino en supplier_invoices.
  const invoiceNumberByMovementId = new Map();
  if (enrichedMovements.length) {
    const { data: invoices, error: invErr } = await supabase
      .from("supplier_invoices")
      .select("account_movement_id, invoice_number")
      .in("account_movement_id", enrichedMovements.map((m) => m.id))
      .is("deleted_at", null);
    if (invErr) throw invErr;
    for (const inv of invoices || []) {
      if (inv.account_movement_id == null) continue;
      if (!invoiceNumberByMovementId.has(inv.account_movement_id)) {
        invoiceNumberByMovementId.set(
          inv.account_movement_id,
          inv.invoice_number || null
        );
      }
    }
  }

  for (const ev of futureMovements) {
    // El fallback vacío no debería pasar, pero saltear el ítem descuadraría
    // el saldo: preferimos mostrarlo sin detalle antes que perder el delta.
    const m = enrichedById.get(ev.id) || { id: ev.id };
    pushItem(ev.eff, {
      source: "MOVIMIENTO",
      id: m.id,
      type: m.type,
      delta: ev.delta,
      amount: Math.abs(ev.delta),
      description: m.description || null,
      expense_category: m.expense_category || null,
      income_category: m.income_category || null,
      payment_method: m.payment_method || null,
      supplier_name: m.supplier_name || null,
      invoice_number:
        m.invoice_number || invoiceNumberByMovementId.get(m.id) || null,
      is_cheque: Boolean(m.is_cheque),
      cheque_number: m.cheque_number || null,
      cheque_bank: m.cheque_bank || null,
      bank: m.bank || null,
      vep_label: m.vep_label || null,
      credit_note_number: m.credit_note_number || null,
      credit_note_invoice_number: m.credit_note_invoice_number || null,
    });
  }

  // VEPs pendientes de pago: egreso proyectado en su vencimiento.
  // Los vencidos sin pagar se imputan mañana (siguen siendo plata que va a salir).
  const { data: pendingVeps, error: vepsErr } = await supabase
    .from("veps")
    .select("id, amount, due_date, category, custom_category")
    .is("deleted_at", null)
    .is("paid_at", null);
  if (vepsErr) throw vepsErr;

  const tomorrow = DateTime.fromISO(today).plus({ days: 1 }).toISODate();
  for (const vep of pendingVeps || []) {
    const amount = parseFloat(vep.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    const overdue = !vep.due_date || vep.due_date <= today;
    const eff = overdue ? tomorrow : vep.due_date;
    const label =
      vep.category === "Otros" && vep.custom_category
        ? vep.custom_category
        : vep.category || null;
    pushItem(eff, {
      source: "VEP",
      id: vep.id,
      type: "EGRESO",
      delta: -amount,
      amount,
      description: label || "VEP",
      vep_label: label,
      due_date: vep.due_date || null,
      overdue,
    });
  }

  // Gastos fijos: se proyecta cada mes del horizonte salvo los que ya tienen
  // cargado el movimiento real, que ya entró como MOVIMIENTO más arriba.
  const projectedFixed = await getProjectedFixedExpenses({
    fromDate: today,
    toDate: until,
    countsInBalance: (m) => movementCountsInBalance(m, excludedIds),
  });

  for (const occurrence of projectedFixed) {
    pushItem(occurrence.date, {
      source: "GASTO_FIJO",
      id: occurrence.fixed_expense_id,
      type: "EGRESO",
      delta: -occurrence.amount,
      amount: occurrence.amount,
      description: occurrence.description,
    });
  }

  // Día a día desde mañana hasta `until` inclusive.
  const data = [];
  let current = balanceThroughToday;
  let d = DateTime.fromISO(today).plus({ days: 1 });
  const end = DateTime.fromISO(until);
  while (d <= end) {
    const iso = d.toISODate();
    const items = itemsByDate.get(iso) || [];
    let dayDelta = 0;
    for (const item of items) dayDelta += item.delta;
    current += dayDelta;
    data.push({ date: iso, balance: current, delta: dayDelta, items });
    d = d.plus({ days: 1 });
  }

  return { data, currentBalance: balanceThroughToday, today, until };
}

module.exports = { computeFutureBalances };
