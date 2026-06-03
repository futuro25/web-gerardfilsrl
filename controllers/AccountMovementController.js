"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");
const {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
} = require("../services/accountMovementBalance");
const {
  cascadeDeleteMovementAndRelated,
  getActiveOrderForMovement,
} = require("../services/supplierInvoiceLifecycle");
const {
  validateDirectPaymentMethod,
  applyDirectPaymentMethod,
} = require("../services/accountMovementPayment");

const MOVEMENT_KINDS = new Set(["FIJO", "UNICA VEZ"]);

function normalizeMovementKind(value) {
  const v = String(value || "").trim();
  return MOVEMENT_KINDS.has(v) ? v : "UNICA VEZ";
}

/** Omite payment_method si es null (p. ej. facturas de proveedor antes de pagar). */
function stripNullPaymentMethod(row) {
  const out = { ...row };
  if (out.payment_method == null || out.payment_method === "") {
    delete out.payment_method;
  }
  return out;
}

async function attachSupplierNames(movements) {
  if (!movements?.length) return movements || [];

  const movementIds = movements.map((m) => m.id);
  const { data: invoices, error } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id, supplier_id")
    .in("account_movement_id", movementIds)
    .is("deleted_at", null);

  if (error) throw error;
  if (!invoices?.length) {
    return movements.map((m) => ({ ...m, supplier_name: null }));
  }

  const supplierIds = [...new Set(invoices.map((i) => i.supplier_id))];
  const { data: suppliers, error: suppliersError } = await supabase
    .from("suppliers")
    .select("id, fantasy_name, name")
    .in("id", supplierIds)
    .is("deleted_at", null);

  if (suppliersError) throw suppliersError;

  const supplierById = {};
  (suppliers || []).forEach((s) => {
    supplierById[s.id] = s.fantasy_name || s.name || null;
  });

  const nameByMovementId = {};
  invoices.forEach((inv) => {
    if (inv.account_movement_id != null && !nameByMovementId[inv.account_movement_id]) {
      nameByMovementId[inv.account_movement_id] =
        supplierById[inv.supplier_id] || null;
    }
  });

  return movements.map((m) => ({
    ...m,
    supplier_name: nameByMovementId[m.id] || null,
  }));
}

async function attachInvoicePaymentFlags(movements) {
  if (!movements?.length) return movements || [];

  const movementIds = movements.map((m) => m.id);
  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id")
    .in("account_movement_id", movementIds)
    .is("deleted_at", null);

  if (invErr) throw invErr;

  const invoiceByMovementId = {};
  const invoiceIds = [];
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id != null) {
      invoiceByMovementId[inv.account_movement_id] = inv.id;
      invoiceIds.push(inv.id);
    }
  });

  let orderByInvoiceId = {};
  if (invoiceIds.length) {
    const { data: orders, error: ordErr } = await supabase
      .from("payment_orders")
      .select("id, supplier_invoice_id, order_number")
      .in("supplier_invoice_id", invoiceIds)
      .is("deleted_at", null);
    if (ordErr) throw ordErr;
    (orders || []).forEach((o) => {
      orderByInvoiceId[o.supplier_invoice_id] = o;
    });
  }

  return movements.map((m) => {
    const supplierInvoiceId = invoiceByMovementId[m.id] || null;
    const order = supplierInvoiceId
      ? orderByInvoiceId[supplierInvoiceId]
      : null;
    const isInvoiceSource =
      m.expense_category === "FACTURA" && supplierInvoiceId != null;
    return {
      ...m,
      supplier_invoice_id: supplierInvoiceId,
      has_payment_order: Boolean(order),
      payment_order_id: order?.id || null,
      payment_order_number: order?.order_number || null,
      invoice_payment_pending: isInvoiceSource && !order,
    };
  });
}

/** Movimientos de Control con factura sin orden de pago activa. */
async function getPendingMovementIds() {
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
    .is("deleted_at", null)
    .not("account_movement_id", "is", null);
  if (invErr) throw invErr;

  return (invoices || [])
    .filter((inv) => !paidInvoiceIds.has(inv.id))
    .map((inv) => inv.account_movement_id)
    .filter((id) => id != null);
}

function isPendingFilter(value) {
  const v = String(value || "").toLowerCase();
  return v === "1" || v === "true" || v === "pending";
}

self.getMovements = async (req, res) => {
  try {
    const { month, year, page = 1, limit = 50, dateOrder: dateOrderParam, pending } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const ascending = String(dateOrderParam || "asc").toLowerCase() !== "desc";
    const pendingOnly = isPendingFilter(pending);

    if (pendingOnly) {
      const pendingIds = await getPendingMovementIds();
      if (!pendingIds.length) {
        return res.json({
          data: [],
          total: 0,
          page: parseInt(page),
          limit: parseInt(limit),
        });
      }

      let query = supabase
        .from("account_movements")
        .select("*", { count: "exact" })
        .is("deleted_at", null)
        .in("id", pendingIds)
        .eq("expense_category", "FACTURA")
        .order("date", { ascending })
        .order("id", { ascending })
        .range(offset, offset + parseInt(limit) - 1);

      if (month && year) {
        const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).toISODate();
        const endDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).endOf("month").toISODate();
        query = query.gte("date", startDate).lte("date", endDate);
      }

      const { data, error, count } = await query;
      if (error) throw error;

      const dataWithSuppliers = await attachSupplierNames(data || []);
      const excludedIds = await getBalanceExcludedMovementIds();
      const withInvoiceFlags = await attachInvoicePaymentFlags(dataWithSuppliers);

      const dataFinal = withInvoiceFlags.map((m) => ({
        ...m,
        excludes_from_balance: !movementCountsInBalance(m, excludedIds),
      }));

      return res.json({
        data: dataFinal,
        total: count,
        page: parseInt(page),
        limit: parseInt(limit),
      });
    }

    let query = supabase
      .from("account_movements")
      .select("*", { count: "exact" })
      .is("deleted_at", null)
      .order("date", { ascending })
      .order("id", { ascending })
      .range(offset, offset + parseInt(limit) - 1);

    if (month && year) {
      const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).toISODate();
      const endDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).endOf("month").toISODate();
      query = query.gte("date", startDate).lte("date", endDate);
    }

    const { data, error, count } = await query;

    if (error) throw error;

    const dataWithSuppliers = await attachSupplierNames(data || []);
    const excludedIds = await getBalanceExcludedMovementIds();
    const withInvoiceFlags = await attachInvoicePaymentFlags(dataWithSuppliers);

    const dataFinal = withInvoiceFlags.map((m) => ({
      ...m,
      excludes_from_balance: !movementCountsInBalance(m, excludedIds),
    }));

    res.json({
      data: dataFinal,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (e) {
    console.error("getMovements error:", e.message);
    res.json({ error: e.message });
  }
};

self.getSummary = async (req, res) => {
  try {
    const { month, year } = req.query;
    const today = DateTime.now().toISODate();

    // Current balance: all movements with effective date <= today
    const { data: allMovements, error: allError } = await supabase
      .from("account_movements")
      .select("type, amount, is_cheque, cheque_due_date, date")
      .is("deleted_at", null);

    if (allError) throw allError;

    const excludedIds = await getBalanceExcludedMovementIds();

    let balanceWithoutCheques = 0;
    let balanceWithCheques = 0;
    allMovements.forEach((m) => {
      if (!movementCountsInBalance(m, excludedIds)) return;
      const amount = m.type === "INGRESO" ? parseFloat(m.amount) : -parseFloat(m.amount);
      balanceWithCheques += amount;
      if (!m.is_cheque || !m.cheque_due_date || m.cheque_due_date <= today) {
        balanceWithoutCheques += amount;
      }
    });

    // Monthly totals
    let monthlyIncome = 0;
    let monthlyExpense = 0;

    if (month && year) {
      const startDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).toISODate();
      const endDate = DateTime.fromObject({ year: parseInt(year), month: parseInt(month), day: 1 }).endOf("month").toISODate();

      allMovements.forEach((m) => {
        if (!movementCountsInBalance(m, excludedIds)) return;
        const effectiveDate = m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;
        if (effectiveDate >= startDate && effectiveDate <= endDate) {
          if (m.type === "INGRESO") {
            monthlyIncome += parseFloat(m.amount);
          } else {
            monthlyExpense += parseFloat(m.amount);
          }
        }
      });
    }

    res.json({
      balanceWithoutCheques,
      balanceWithCheques,
      monthlyIncome,
      monthlyExpense,
    });
  } catch (e) {
    console.error("getSummary error:", e.message);
    res.json({ error: e.message });
  }
};

self.getFutureBalances = async (req, res) => {
  try {
    const today = DateTime.now().toISODate();

    const { data: rows, error } = await supabase
      .from("account_movements")
      .select("type, amount, date, is_cheque, cheque_due_date, created_at")
      .is("deleted_at", null);

    if (error) throw error;

    const excludedIds = await getBalanceExcludedMovementIds();

    const withEff = (rows || [])
      .filter((m) => movementCountsInBalance(m, excludedIds))
      .map((m) => ({
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

    const deltasByDate = new Map();
    for (const ev of withEff) {
      if (ev.eff <= today) continue;
      if (!deltasByDate.has(ev.eff)) deltasByDate.set(ev.eff, []);
      deltasByDate.get(ev.eff).push(ev.delta);
    }

    // Próximos 3 meses (día a día desde mañana hasta hoy + 3 meses inclusive)
    const out = [];
    let current = balanceThroughToday;
    let d = DateTime.fromISO(today).plus({ days: 1 });
    const endD = DateTime.fromISO(today).plus({ months: 3 });
    while (d <= endD) {
      const iso = d.toISODate();
      const deltas = deltasByDate.get(iso) || [];
      for (const del of deltas) current += del;
      out.push({ date: iso, balance: current });
      d = d.plus({ days: 1 });
    }

    res.json({ data: out });
  } catch (e) {
    console.error("getFutureBalances error:", e.message);
    res.json({ error: e.message, data: [] });
  }
};

self.getUpcomingCheques = async (req, res) => {
  try {
    const today = DateTime.now().toISODate();
    const in30Days = DateTime.now().plus({ days: 30 }).toISODate();

    const { data, error } = await supabase
      .from("account_movements")
      .select("*")
      .eq("is_cheque", true)
      .is("deleted_at", null)
      .gte("cheque_due_date", today)
      .lte("cheque_due_date", in30Days)
      .order("cheque_due_date", { ascending: true });

    if (error) throw error;

    const toExpire = data.filter((m) => m.type === "EGRESO");
    const toCredit = data.filter((m) => m.type === "INGRESO");

    res.json({ toExpire, toCredit });
  } catch (e) {
    console.error("getUpcomingCheques error:", e.message);
    res.json({ error: e.message });
  }
};

self.createMovement = async (req, res) => {
  try {
    const paymentErr = validateDirectPaymentMethod(req.body);
    if (paymentErr) return res.json({ error: paymentErr });

    const movement = applyDirectPaymentMethod(
      {
        type: req.body.type,
        responsible: "Sin especificar",
        movement_kind: normalizeMovementKind(req.body.movement_kind),
        date: req.body.date,
        amount: req.body.amount,
        description: req.body.description || null,
        is_cheque: req.body.is_cheque || false,
        cheque_number: req.body.cheque_number || null,
        cheque_bank: req.body.cheque_bank || null,
        cheque_due_date: req.body.cheque_due_date || null,
        expense_category: req.body.expense_category || null,
      },
      req.body
    );

    // Ingresos con cheque (toggle UI)
    if (movement.type === "INGRESO" && movement.is_cheque && movement.cheque_due_date) {
      movement.date = movement.cheque_due_date;
    }

    let paycheckId = null;

    // If it's an egreso cheque, also create in paychecks table
    if (movement.is_cheque && movement.type === "EGRESO") {
      const paycheck = {
        number: movement.cheque_number,
        bank: movement.cheque_bank,
        amount: movement.amount,
        due_date: movement.cheque_due_date,
        type: "OUT",
      };

      const { data: newPaycheck, error: paycheckError } = await supabase
        .from("paychecks")
        .insert(paycheck)
        .select();

      if (paycheckError) {
        console.error("Error creating paycheck:", paycheckError);
        throw paycheckError;
      }

      if (newPaycheck && newPaycheck.length > 0) {
        paycheckId = newPaycheck[0].id;
      }
    }

    movement.paycheck_id = paycheckId;

    const { data: newMovement, error } = await supabase
      .from("account_movements")
      .insert(stripNullPaymentMethod(movement))
      .select();

    if (error) {
      // Rollback paycheck if movement insert fails
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", paycheckId);
      }
      throw error;
    }

    return res.json(newMovement);
  } catch (e) {
    console.error("createMovement error:", e.message);
    return res.json({ error: e.message });
  }
};

self.updateMovement = async (req, res) => {
  try {
    const movementId = req.params.id;

    const { data: existing, error: fetchError } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (fetchError) throw fetchError;

    const activeOrder = await getActiveOrderForMovement(movementId);
    if (activeOrder) {
      return res.json({
        error:
          "No se puede editar un movimiento con orden de pago activa. Anulá la OP primero.",
      });
    }

    const paymentErr = validateDirectPaymentMethod(req.body);
    if (paymentErr) return res.json({ error: paymentErr });

    const update = applyDirectPaymentMethod(
      {
        type: req.body.type,
        responsible: "Sin especificar",
        movement_kind: normalizeMovementKind(req.body.movement_kind),
        date: req.body.date,
        amount: req.body.amount,
        description: req.body.description || null,
        is_cheque: req.body.is_cheque || false,
        cheque_number: req.body.cheque_number || null,
        cheque_bank: req.body.cheque_bank || null,
        cheque_due_date: req.body.cheque_due_date || null,
        expense_category: req.body.expense_category || null,
      },
      req.body
    );

    if (update.type === "INGRESO" && update.is_cheque && update.cheque_due_date) {
      update.date = update.cheque_due_date;
    }

    // Handle paycheck sync for cheque egresos
    if (existing.paycheck_id) {
      if (update.is_cheque && update.type === "EGRESO") {
        await supabase
          .from("paychecks")
          .update({
            number: update.cheque_number,
            bank: update.cheque_bank,
            amount: update.amount,
            due_date: update.cheque_due_date,
          })
          .eq("id", existing.paycheck_id);
      } else {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", existing.paycheck_id);
        update.paycheck_id = null;
      }
    } else if (update.is_cheque && update.type === "EGRESO") {
      const { data: newPaycheck, error: paycheckError } = await supabase
        .from("paychecks")
        .insert({
          number: update.cheque_number,
          bank: update.cheque_bank,
          amount: update.amount,
          due_date: update.cheque_due_date,
          type: "OUT",
        })
        .select();

      if (paycheckError) throw paycheckError;
      if (newPaycheck?.length > 0) {
        update.paycheck_id = newPaycheck[0].id;
      }
    }

    const { data: updated, error } = await supabase
      .from("account_movements")
      .update(stripNullPaymentMethod(update))
      .eq("id", movementId)
      .select();

    if (error) throw error;

    res.json(updated);
  } catch (e) {
    console.error("updateMovement error:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteMovement = async (req, res) => {
  try {
    const movementId = req.params.id;

    const { data: movement, error: fetchError } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (fetchError) throw fetchError;
    if (!movement) {
      return res.status(404).json({ error: "Movimiento no encontrado" });
    }

    await cascadeDeleteMovementAndRelated(movement);

    res.json({ success: true });
  } catch (e) {
    console.error("deleteMovement error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
