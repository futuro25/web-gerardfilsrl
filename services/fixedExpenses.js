"use strict";

const { DateTime } = require("luxon");
const supabase = require("../controllers/db");

/** Primer día del mes de una fecha ISO, que es como se guardan los meses. */
function monthStart(isoDate) {
  const dt = DateTime.fromISO(String(isoDate || ""));
  if (!dt.isValid) return null;
  return dt.startOf("month").toISODate();
}

/** Clave de mes para agrupar (YYYY-MM). */
function monthKey(isoDate) {
  const start = monthStart(isoDate);
  return start ? start.slice(0, 7) : null;
}

/**
 * Fecha real de la ocurrencia: el día pactado, o el último del mes si ese mes
 * es más corto (un gasto del 31 cae el 28 en febrero).
 */
function occurrenceDate(monthStartIso, dayOfMonth) {
  const dt = DateTime.fromISO(monthStartIso);
  if (!dt.isValid) return null;
  const day = Math.min(Math.max(parseInt(dayOfMonth, 10) || 1, 1), dt.daysInMonth);
  return dt.set({ day }).toISODate();
}

/** Comparación de descripciones para no duplicar el mismo gasto fijo. */
function normalizeDescription(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function parsePositiveAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Importe vigente en un mes: el de la última vigencia que empieza en ese mes o
 * antes. Devuelve null si el gasto todavía no tenía importe asignado.
 */
function amountForMonth(amounts, monthStartIso) {
  let current = null;
  for (const row of amounts || []) {
    if (row.effective_from > monthStartIso) continue;
    if (!current || row.effective_from > current.effective_from) current = row;
  }
  return current ? parseFloat(current.amount) : null;
}

/** Fecha efectiva del movimiento: los cheques impactan al vencimiento. */
function movementEffectiveDate(movement) {
  return movement.is_cheque && movement.cheque_due_date
    ? movement.cheque_due_date
    : movement.date;
}

async function getFixedExpensesWithAmounts({ includeInactive = false } = {}) {
  const { data: expenses, error } = await supabase
    .from("fixed_expenses")
    .select("*")
    .is("deleted_at", null)
    .order("description", { ascending: true });

  if (error) throw error;
  if (!expenses?.length) return [];

  const ids = expenses.map((e) => e.id);
  const { data: amounts, error: amountsErr } = await supabase
    .from("fixed_expense_amounts")
    .select("*")
    .in("fixed_expense_id", ids)
    .order("effective_from", { ascending: true });

  if (amountsErr) throw amountsErr;

  const byExpense = new Map();
  for (const row of amounts || []) {
    if (!byExpense.has(row.fixed_expense_id)) byExpense.set(row.fixed_expense_id, []);
    byExpense.get(row.fixed_expense_id).push(row);
  }

  const withAmounts = expenses.map((expense) => ({
    ...expense,
    amounts: byExpense.get(expense.id) || [],
  }));

  if (includeInactive) return withAmounts;
  const thisMonth = monthStart(DateTime.now().toISODate());
  return withAmounts.filter((e) => !e.end_month || e.end_month >= thisMonth);
}

/** Ventana de movimientos que miramos para saber qué meses ya están cargados. */
const COVERAGE_MONTHS_BACK = 12;

/**
 * Egresos candidatos a corresponder a algún gasto fijo. Trae la ventana entera
 * y el emparejamiento se hace en groupMovementsByExpense.
 */
async function getMovementsForCoverage(fromDate) {
  const from = DateTime.fromISO(fromDate || DateTime.now().toISODate())
    .minus({ months: COVERAGE_MONTHS_BACK })
    .startOf("month")
    .toISODate();

  const { data, error } = await supabase
    .from("account_movements")
    .select("id, fixed_expense_id, description, amount, date, is_cheque, cheque_due_date")
    .eq("type", "EGRESO")
    .is("deleted_at", null)
    .or(`date.gte.${from},cheque_due_date.gte.${from}`);

  if (error) throw error;
  return data || [];
}

/**
 * Agrupa los movimientos por gasto fijo. Vale el vínculo explícito y, si no lo
 * hay, que coincida el detalle: el usuario carga el sueldo de cada mes sin
 * volver a marcarlo como fijo, y ese movimiento igual tiene que tapar el mes.
 */
function groupMovementsByExpense(expenses, movements) {
  const validIds = new Set(expenses.map((e) => e.id));
  const idByDescription = new Map();
  for (const expense of expenses) {
    const key = normalizeDescription(expense.description);
    if (!key || idByDescription.has(key)) continue;
    idByDescription.set(key, expense.id);
  }

  const grouped = new Map(expenses.map((e) => [e.id, []]));
  for (const movement of movements) {
    let expenseId = validIds.has(movement.fixed_expense_id)
      ? movement.fixed_expense_id
      : null;
    if (expenseId == null) {
      const key = normalizeDescription(movement.description);
      expenseId = key ? idByDescription.get(key) ?? null : null;
    }
    if (expenseId == null) continue;
    grouped.get(expenseId).push(movement);
  }

  return grouped;
}

/**
 * Meses ya cubiertos por un movimiento real, por gasto fijo. Se usa para no
 * proyectar un mes que ya está cargado en Control.
 * `countsInBalance` deja afuera los movimientos que no impactan la caja (p. ej.
 * facturas de proveedor sin saldar): esos no cubren nada, la plata sigue por salir.
 */
function coveredMonthsByExpense(grouped, countsInBalance = () => true) {
  const covered = new Map();
  for (const [expenseId, movements] of grouped) {
    const months = new Set();
    for (const movement of movements) {
      if (!countsInBalance(movement)) continue;
      const key = monthKey(movementEffectiveDate(movement));
      if (key) months.add(key);
    }
    covered.set(expenseId, months);
  }
  return covered;
}

/**
 * Ocurrencias proyectadas entre dos fechas (exclusiva la de inicio, inclusiva la
 * de fin). Solo devuelve las que todavía no ocurrieron y no tienen movimiento
 * real cargado en ese mes.
 */
function projectOccurrences(expenses, { fromDate, toDate, coveredMonths }) {
  const out = [];
  const firstMonth = monthStart(fromDate);
  const lastMonth = monthStart(toDate);
  if (!firstMonth || !lastMonth) return out;

  for (const expense of expenses) {
    const covered = coveredMonths?.get(expense.id) || new Set();
    let month = DateTime.fromISO(firstMonth);
    const end = DateTime.fromISO(lastMonth);

    while (month <= end) {
      const monthIso = month.toISODate();
      month = month.plus({ months: 1 });

      if (expense.start_month && monthIso < expense.start_month) continue;
      if (expense.end_month && monthIso > expense.end_month) continue;
      if (covered.has(monthIso.slice(0, 7))) continue;

      const date = occurrenceDate(monthIso, expense.day_of_month);
      if (!date || date <= fromDate || date > toDate) continue;

      const amount = amountForMonth(expense.amounts, monthIso);
      if (!amount || amount <= 0) continue;

      out.push({
        fixed_expense_id: expense.id,
        description: expense.description,
        date,
        amount,
      });
    }
  }

  return out;
}

/**
 * Nombres de los gastos fijos vigentes con sus alias: los detalles que ya se
 * usaron en movimientos vinculados. Sirve para sugerir el nombre correcto
 * cuando alguien carga el mismo gasto escrito distinto — el parecido de texto
 * no alcanza (p. ej. "SISTEMAS" es el mismo gasto que "PRIETO SABRINA SOLEDAD",
 * y eso solo se sabe porque quedó vinculado).
 */
async function getFixedExpenseNameIndex() {
  const expenses = await getFixedExpensesWithAmounts();
  if (!expenses.length) return [];

  const { data: linked, error } = await supabase
    .from("account_movements")
    .select("fixed_expense_id, description")
    .in("fixed_expense_id", expenses.map((e) => e.id))
    .is("deleted_at", null);
  if (error) throw error;

  const aliasesById = new Map();
  for (const movement of linked || []) {
    const description = String(movement.description || "").trim();
    if (!description) continue;
    if (!aliasesById.has(movement.fixed_expense_id)) {
      aliasesById.set(movement.fixed_expense_id, new Map());
    }
    // Guardamos el texto tal cual se escribió, deduplicado por su forma normalizada.
    aliasesById
      .get(movement.fixed_expense_id)
      .set(normalizeDescription(description), description);
  }

  const thisMonth = monthStart(DateTime.now().toISODate());

  return expenses.map((expense) => {
    const canonical = normalizeDescription(expense.description);
    const aliases = [...(aliasesById.get(expense.id)?.entries() || [])]
      .filter(([key]) => key !== canonical)
      .map(([, value]) => value);

    return {
      id: expense.id,
      description: expense.description,
      day_of_month: expense.day_of_month,
      current_amount: amountForMonth(expense.amounts, thisMonth),
      aliases,
    };
  });
}

/** Egresos proyectados para Saldos Futuros, listos para sumar como deltas. */
async function getProjectedFixedExpenses({ fromDate, toDate, countsInBalance }) {
  const expenses = await getFixedExpensesWithAmounts();
  if (!expenses.length) return [];

  const movements = await getMovementsForCoverage(fromDate);
  const grouped = groupMovementsByExpense(expenses, movements);
  const coveredMonths = coveredMonthsByExpense(grouped, countsInBalance);

  return projectOccurrences(expenses, { fromDate, toDate, coveredMonths });
}

/**
 * Crea el gasto fijo a partir del movimiento que se acaba de marcar, o lo
 * engancha al que ya existe con la misma descripción. Devuelve el id vinculado.
 */
async function linkMovementToFixedExpense(movement) {
  const description = String(movement.description || "").trim();
  if (!description) return null;

  const effectiveDate = movementEffectiveDate(movement);
  const start = monthStart(effectiveDate);
  if (!start) return null;

  const { data: existing, error: existingErr } = await supabase
    .from("fixed_expenses")
    .select("*")
    .is("deleted_at", null);
  if (existingErr) throw existingErr;

  const normalized = normalizeDescription(description);
  const match = (existing || []).find(
    (e) => normalizeDescription(e.description) === normalized
  );

  if (match) {
    // Si el movimiento es anterior al arranque registrado, adelantamos el inicio:
    // el gasto ya venía ocurriendo desde antes.
    if (match.start_month > start) {
      const { error } = await supabase
        .from("fixed_expenses")
        .update({ start_month: start })
        .eq("id", match.id);
      if (error) throw error;
    }
    return match.id;
  }

  const day = DateTime.fromISO(effectiveDate).day;
  const { data: created, error: createErr } = await supabase
    .from("fixed_expenses")
    .insert({
      description,
      day_of_month: day,
      start_month: start,
      source_movement_id: movement.id,
    })
    .select();
  if (createErr) throw createErr;

  const expense = created?.[0];
  if (!expense) return null;

  const amount = parsePositiveAmount(movement.amount);
  if (amount) {
    const { error: amountErr } = await supabase
      .from("fixed_expense_amounts")
      .insert({
        fixed_expense_id: expense.id,
        amount,
        effective_from: start,
      });
    if (amountErr) throw amountErr;
  }

  return expense.id;
}

/**
 * Al desmarcar un movimiento, lo desvincula. Si era el único del gasto fijo y
 * el gasto había nacido de él, lo da de baja: nadie más lo estaba usando.
 */
async function unlinkMovementFromFixedExpense(movement) {
  const fixedExpenseId = movement.fixed_expense_id;
  if (!fixedExpenseId) return;

  const { data: linked, error: linkedErr } = await supabase
    .from("account_movements")
    .select("id")
    .eq("fixed_expense_id", fixedExpenseId)
    .neq("id", movement.id)
    .is("deleted_at", null);
  if (linkedErr) throw linkedErr;
  if (linked?.length) return;

  const { data: expense, error } = await supabase
    .from("fixed_expenses")
    .select("id, source_movement_id")
    .eq("id", fixedExpenseId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) throw error;
  if (!expense || expense.source_movement_id !== movement.id) return;

  const { error: deleteErr } = await supabase
    .from("fixed_expenses")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", fixedExpenseId);
  if (deleteErr) throw deleteErr;
}

module.exports = {
  monthStart,
  monthKey,
  occurrenceDate,
  normalizeDescription,
  parsePositiveAmount,
  amountForMonth,
  movementEffectiveDate,
  getFixedExpensesWithAmounts,
  getFixedExpenseNameIndex,
  getMovementsForCoverage,
  groupMovementsByExpense,
  coveredMonthsByExpense,
  projectOccurrences,
  getProjectedFixedExpenses,
  linkMovementToFixedExpense,
  unlinkMovementFromFixedExpense,
};
