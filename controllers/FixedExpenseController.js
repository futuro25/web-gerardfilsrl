"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");
const {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
} = require("../services/accountMovementBalance");
const {
  monthStart,
  parsePositiveAmount,
  amountForMonth,
  movementEffectiveDate,
  getFixedExpensesWithAmounts,
  getFixedExpenseNameIndex,
  getMovementsForCoverage,
  groupMovementsByExpense,
  coveredMonthsByExpense,
  projectOccurrences,
} = require("../services/fixedExpenses");

/** Acepta "2026-07" o "2026-07-15" y devuelve siempre el día 1 del mes. */
function parseMonth(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const iso = /^\d{4}-\d{2}$/.test(raw) ? `${raw}-01` : raw;
  return monthStart(iso);
}

/** Último movimiento real cargado para el gasto fijo. */
function latestMovement(movements) {
  let latest = null;
  for (const movement of movements) {
    const eff = movementEffectiveDate(movement);
    if (!eff) continue;
    if (!latest || eff > movementEffectiveDate(latest)) latest = movement;
  }
  return latest;
}

self.getFixedExpenses = async (req, res) => {
  try {
    const today = DateTime.now().toISODate();
    const thisMonth = monthStart(today);
    const horizonEnd = DateTime.fromISO(today).plus({ months: 3 }).toISODate();

    const expenses = await getFixedExpensesWithAmounts({ includeInactive: true });
    if (!expenses.length) return res.json({ data: [] });

    const movements = await getMovementsForCoverage(today);
    const movementsByExpense = groupMovementsByExpense(expenses, movements);
    const excludedIds = await getBalanceExcludedMovementIds();
    const countsInBalance = (m) => movementCountsInBalance(m, excludedIds);
    const coveredMonths = coveredMonthsByExpense(movementsByExpense, countsInBalance);

    const data = expenses.map((expense) => {
      const own = movementsByExpense.get(expense.id) || [];
      const last = latestMovement(own);
      const [next] = projectOccurrences([expense], {
        fromDate: today,
        toDate: horizonEnd,
        coveredMonths,
      });

      return {
        id: expense.id,
        description: expense.description,
        day_of_month: expense.day_of_month,
        start_month: expense.start_month,
        end_month: expense.end_month,
        active: !expense.end_month || expense.end_month >= thisMonth,
        amounts: (expense.amounts || []).map((a) => ({
          id: a.id,
          amount: parseFloat(a.amount),
          effective_from: a.effective_from,
        })),
        current_amount: amountForMonth(expense.amounts, thisMonth),
        next_occurrence: next ? { date: next.date, amount: next.amount } : null,
        last_movement: last
          ? {
              id: last.id,
              date: movementEffectiveDate(last),
              amount: parsePositiveAmount(last.amount),
            }
          : null,
        movements_count: own.length,
      };
    });

    res.json({ data });
  } catch (e) {
    console.error("getFixedExpenses error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

/** Índice liviano para sugerir el nombre correcto al cargar un movimiento. */
self.getFixedExpenseNames = async (req, res) => {
  try {
    const data = await getFixedExpenseNameIndex();
    res.json({ data });
  } catch (e) {
    console.error("getFixedExpenseNames error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.updateFixedExpense = async (req, res) => {
  try {
    const id = req.params.id;
    const update = {};

    if (req.body.description != null) {
      const description = String(req.body.description).trim();
      if (!description) return res.json({ error: "El detalle es obligatorio" });
      update.description = description;
    }

    if (req.body.day_of_month != null) {
      const day = parseInt(req.body.day_of_month, 10);
      if (!Number.isFinite(day) || day < 1 || day > 31) {
        return res.json({ error: "El día del mes debe estar entre 1 y 31" });
      }
      update.day_of_month = day;
    }

    // end_month vacío reactiva el gasto fijo (vuelve a proyectarse sin fin).
    if ("end_month" in req.body) {
      if (req.body.end_month == null || req.body.end_month === "") {
        update.end_month = null;
      } else {
        const end = parseMonth(req.body.end_month);
        if (!end) return res.json({ error: "Mes de baja inválido" });
        update.end_month = end;
      }
    }

    if (!Object.keys(update).length) {
      return res.json({ error: "No hay cambios para guardar" });
    }

    const { data, error } = await supabase
      .from("fixed_expenses")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;
    if (!data?.length) return res.json({ error: "Gasto fijo no encontrado" });

    res.json(data[0]);
  } catch (e) {
    console.error("updateFixedExpense error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteFixedExpense = async (req, res) => {
  try {
    const id = req.params.id;

    const { error } = await supabase
      .from("fixed_expenses")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .is("deleted_at", null);
    if (error) throw error;

    // Los movimientos reales quedan intactos: solo pierden la marca de fijo.
    const { error: unlinkErr } = await supabase
      .from("account_movements")
      .update({ fixed_expense_id: null, movement_kind: "UNICA VEZ" })
      .eq("fixed_expense_id", id)
      .is("deleted_at", null);
    if (unlinkErr) throw unlinkErr;

    res.json({ success: true });
  } catch (e) {
    console.error("deleteFixedExpense error:", e.message);
    res.json({ error: e.message });
  }
};

self.createFixedExpenseAmount = async (req, res) => {
  try {
    const fixedExpenseId = parseInt(req.params.id, 10);
    const amount = parsePositiveAmount(req.body.amount);
    const effectiveFrom = parseMonth(req.body.effective_from);

    if (!amount) return res.json({ error: "El importe debe ser mayor a 0" });
    if (!effectiveFrom) {
      return res.json({ error: "Indicá desde qué mes rige el importe" });
    }

    const { data: expense, error: expenseErr } = await supabase
      .from("fixed_expenses")
      .select("id")
      .eq("id", fixedExpenseId)
      .is("deleted_at", null)
      .maybeSingle();
    if (expenseErr) throw expenseErr;
    if (!expense) return res.json({ error: "Gasto fijo no encontrado" });

    // Un mes tiene un solo importe: si ya existe una vigencia ese mes, la pisa.
    const { data: existing, error: existingErr } = await supabase
      .from("fixed_expense_amounts")
      .select("id")
      .eq("fixed_expense_id", fixedExpenseId)
      .eq("effective_from", effectiveFrom)
      .maybeSingle();
    if (existingErr) throw existingErr;

    if (existing) {
      const { data, error } = await supabase
        .from("fixed_expense_amounts")
        .update({ amount })
        .eq("id", existing.id)
        .select();
      if (error) throw error;
      return res.json(data?.[0]);
    }

    const { data, error } = await supabase
      .from("fixed_expense_amounts")
      .insert({ fixed_expense_id: fixedExpenseId, amount, effective_from: effectiveFrom })
      .select();
    if (error) throw error;

    res.json(data?.[0]);
  } catch (e) {
    console.error("createFixedExpenseAmount error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteFixedExpenseAmount = async (req, res) => {
  try {
    const fixedExpenseId = parseInt(req.params.id, 10);
    const amountId = parseInt(req.params.amountId, 10);

    const { data: amounts, error: listErr } = await supabase
      .from("fixed_expense_amounts")
      .select("id")
      .eq("fixed_expense_id", fixedExpenseId);
    if (listErr) throw listErr;

    if ((amounts || []).length <= 1) {
      return res.json({
        error: "El gasto fijo necesita al menos un importe. Editalo en vez de borrarlo.",
      });
    }

    const { error } = await supabase
      .from("fixed_expense_amounts")
      .delete()
      .eq("id", amountId)
      .eq("fixed_expense_id", fixedExpenseId);
    if (error) throw error;

    res.json({ success: true });
  } catch (e) {
    console.error("deleteFixedExpenseAmount error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
