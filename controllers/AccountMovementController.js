"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");
const {
  getBalanceExcludedMovementIds,
  movementCountsInBalance,
} = require("../services/accountMovementBalance");
const {
  getOrdersGroupedByInvoiceIds,
  buildPaymentSummary,
  isInvoiceFullyPaid,
  getPaidAmountsByInvoiceIds,
  invoiceTotal,
} = require("../services/invoicePaymentSummary");
const {
  cascadeDeleteMovementAndRelated,
  getActiveOrderForMovement,
} = require("../services/supplierInvoiceLifecycle");
const {
  applyDirectPaymentMethod,
  applyEgresoSupplierFields,
} = require("../services/accountMovementPayment");
const { assertNoDuplicateSupplierInvoice } = require("../services/supplierInvoiceDuplicate");
const { validateMovementBody } = require("../services/accountMovementValidation");

const MOVEMENT_KINDS = new Set(["FIJO", "UNICA VEZ"]);

function normalizeMovementKind(value) {
  const v = String(value || "").trim();
  return MOVEMENT_KINDS.has(v) ? v : "UNICA VEZ";
}

function parseMovementAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function normOptionalString(value) {
  if (value == null || value === "") return null;
  return String(value).trim() || null;
}

function normalizeDate(value) {
  if (value == null || value === "") return null;
  const s = String(value);
  return s.length >= 10 ? s.slice(0, 10) : s;
}

function amountsMatch(a, b) {
  return Math.abs(parseMovementAmount(a) - parseMovementAmount(b)) <= 0.009;
}

function supplierFieldsFromBody(body) {
  if (
    body.type !== "EGRESO" ||
    !["OTRO", "SERVICIOS"].includes(body.expense_category)
  ) {
    return { supplier_id: null, invoice_number: null };
  }
  const supplierId = parseInt(body.supplier_id, 10);
  return {
    supplier_id:
      Number.isFinite(supplierId) && supplierId > 0 ? supplierId : null,
    invoice_number:
      body.expense_category === "SERVICIOS"
        ? normOptionalString(body.invoice_number)
        : null,
  };
}

/** True si el body no altera nada salvo movement_kind (p. ej. marcar gasto fijo con OP activa). */
function movementBodyChangesOnlyKind(existing, body) {
  const newKind = normalizeMovementKind(body.movement_kind);
  const oldKind = normalizeMovementKind(existing.movement_kind);
  if (newKind === oldKind) return false;

  if (existing.type !== body.type) return false;
  if (!amountsMatch(existing.amount, body.amount)) return false;
  if (normalizeDate(existing.date) !== normalizeDate(body.date)) return false;
  if (
    normOptionalString(existing.description) !==
    normOptionalString(body.description)
  ) {
    return false;
  }
  if (Boolean(existing.is_cheque) !== Boolean(body.is_cheque)) return false;
  if (
    normOptionalString(existing.cheque_number) !==
    normOptionalString(body.cheque_number)
  ) {
    return false;
  }
  if (
    normOptionalString(existing.cheque_bank) !==
    normOptionalString(body.cheque_bank)
  ) {
    return false;
  }
  if (
    normalizeDate(existing.cheque_due_date) !==
    normalizeDate(body.cheque_due_date)
  ) {
    return false;
  }
  if ((existing.expense_category || null) !== (body.expense_category || null)) {
    return false;
  }

  const bodySupplier = supplierFieldsFromBody(body);
  if ((existing.supplier_id || null) !== bodySupplier.supplier_id) return false;
  if (
    normOptionalString(existing.invoice_number) !== bodySupplier.invoice_number
  ) {
    return false;
  }
  if (
    (existing.payment_method || null) !== (body.payment_method || null)
  ) {
    return false;
  }

  return true;
}

function buildMovementUpdateFromBody(body) {
  const validationErr = validateMovementBody(body);
  if (validationErr) return { error: validationErr };

  const update = applyDirectPaymentMethod(
    {
      type: body.type,
      responsible: "Sin especificar",
      movement_kind: normalizeMovementKind(body.movement_kind),
      date: body.date,
      amount: body.amount,
      description: body.description || null,
      is_cheque: body.is_cheque || false,
      cheque_number: body.cheque_number || null,
      cheque_bank: body.cheque_bank || null,
      cheque_due_date: body.cheque_due_date || null,
      expense_category: body.expense_category || null,
    },
    body
  );

  if (update.type === "INGRESO" && update.is_cheque && update.cheque_due_date) {
    update.date = update.cheque_due_date;
  }

  applyEgresoSupplierFields(update, body);

  if (body.image_key != null && body.image_key !== "") {
    update.image_key = body.image_key;
  }

  return { update };
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

  const supplierIds = new Set(
    (invoices || []).map((i) => i.supplier_id).filter((id) => id != null)
  );
  movements.forEach((m) => {
    if (m.supplier_id != null) supplierIds.add(m.supplier_id);
  });

  let supplierById = {};
  if (supplierIds.size) {
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .in("id", [...supplierIds])
      .is("deleted_at", null);

    if (suppliersError) throw suppliersError;

    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s.fantasy_name || s.name || null;
    });
  }

  const nameByMovementId = {};
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id != null && !nameByMovementId[inv.account_movement_id]) {
      nameByMovementId[inv.account_movement_id] =
        supplierById[inv.supplier_id] || null;
    }
  });

  return movements.map((m) => ({
    ...m,
    supplier_name:
      nameByMovementId[m.id] || supplierById[m.supplier_id] || null,
  }));
}

async function attachInvoicePaymentFlags(movements) {
  if (!movements?.length) return movements || [];

  const movementIds = movements.map((m) => m.id);
  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id, amount, total, document_date")
    .in("account_movement_id", movementIds)
    .is("deleted_at", null);

  if (invErr) throw invErr;

  const invoiceByMovementId = {};
  const invoiceIds = [];
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id != null) {
      invoiceByMovementId[inv.account_movement_id] = inv;
      invoiceIds.push(inv.id);
    }
  });

  const ordersByInvoiceId = await getOrdersGroupedByInvoiceIds(invoiceIds);

  const orderByMovementId = {};
  const { data: ordersByMovement, error: ordMovErr } = await supabase
    .from("payment_orders")
    .select("id, account_movement_id, source_movement_id, order_number")
    .or(
      `account_movement_id.in.(${movementIds.join(",")}),source_movement_id.in.(${movementIds.join(",")})`
    )
    .is("deleted_at", null);
  if (ordMovErr) throw ordMovErr;
  (ordersByMovement || []).forEach((o) => {
    const mid = o.account_movement_id || o.source_movement_id;
    if (mid != null && !orderByMovementId[mid]) {
      orderByMovementId[mid] = o;
    }
  });

  return movements.map((m) => {
    const invoice = invoiceByMovementId[m.id] || null;
    const supplierInvoiceId = invoice?.id || null;
    const orders = supplierInvoiceId
      ? ordersByInvoiceId[supplierInvoiceId] || []
      : [];
    const summary = invoice
      ? buildPaymentSummary(invoice, orders)
      : {
          invoiceTotal: parseMovementAmount(m.amount),
          paidAmount: 0,
          remainingAmount: parseMovementAmount(m.amount),
          fullyPaid: false,
          orders: [],
          orderCount: 0,
        };

    const isInvoiceSource =
      m.expense_category === "FACTURA" && supplierInvoiceId != null;
    const latestOrder = orders.length ? orders[orders.length - 1] : null;
    const legacyOrder = latestOrder || orderByMovementId[m.id] || null;

    return {
      ...m,
      supplier_invoice_id: supplierInvoiceId,
      has_payment_order: summary.orderCount > 0,
      invoice_fully_paid: summary.fullyPaid,
      invoice_paid_amount: summary.paidAmount,
      invoice_remaining_amount: summary.remainingAmount,
      invoice_total_amount: summary.invoiceTotal,
      invoice_document_date: invoice?.document_date || null,
      payment_orders: summary.orders,
      payment_order_id: legacyOrder?.id || null,
      payment_order_number:
        summary.orders.map((o) => o.order_number).filter(Boolean).join(", ") ||
        legacyOrder?.order_number ||
        null,
      invoice_payment_pending: isInvoiceSource && !summary.fullyPaid,
    };
  });
}

/** Movimientos de Control con factura con saldo pendiente. */
async function getPendingMovementIds() {
  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id, amount, total, document_date")
    .is("deleted_at", null)
    .not("account_movement_id", "is", null);
  if (invErr) throw invErr;

  const invoiceIds = (invoices || []).map((inv) => inv.id);
  const paidByInvoiceId = await getPaidAmountsByInvoiceIds(invoiceIds);

  return (invoices || [])
    .filter((inv) => !isInvoiceFullyPaid(inv, paidByInvoiceId[inv.id] || 0))
    .map((inv) => inv.account_movement_id)
    .filter((id) => id != null);
}

function isPendingFilter(value) {
  const v = String(value || "").toLowerCase();
  return v === "1" || v === "true" || v === "pending";
}

/** IDs de movimientos cuyo detalle coincide con el término de búsqueda. */
async function getSearchMovementIds(search) {
  const raw = String(search || "").trim();
  if (!raw) return null;

  const pattern = `%${raw}%`;
  const ids = new Set();

  const { data: direct, error: directErr } = await supabase
    .from("account_movements")
    .select("id")
    .is("deleted_at", null)
    .or(
      `description.ilike.${pattern},cheque_number.ilike.${pattern},cheque_bank.ilike.${pattern},invoice_number.ilike.${pattern}`
    );
  if (directErr) throw directErr;
  (direct || []).forEach((row) => ids.add(row.id));

  const { data: suppliers, error: supplierErr } = await supabase
    .from("suppliers")
    .select("id")
    .is("deleted_at", null)
    .or(`fantasy_name.ilike.${pattern},name.ilike.${pattern}`);
  if (supplierErr) throw supplierErr;

  const supplierIds = (suppliers || []).map((s) => s.id);
  if (supplierIds.length) {
    const { data: bySupplier, error: bySupplierErr } = await supabase
      .from("account_movements")
      .select("id")
      .is("deleted_at", null)
      .in("supplier_id", supplierIds);
    if (bySupplierErr) throw bySupplierErr;
    (bySupplier || []).forEach((row) => ids.add(row.id));

    const { data: invBySupplier, error: invBySupplierErr } = await supabase
      .from("supplier_invoices")
      .select("account_movement_id")
      .is("deleted_at", null)
      .in("supplier_id", supplierIds)
      .not("account_movement_id", "is", null);
    if (invBySupplierErr) throw invBySupplierErr;
    (invBySupplier || []).forEach((row) => {
      if (row.account_movement_id) ids.add(row.account_movement_id);
    });
  }

  const { data: invByNumber, error: invByNumberErr } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id")
    .is("deleted_at", null)
    .ilike("invoice_number", pattern)
    .not("account_movement_id", "is", null);
  if (invByNumberErr) throw invByNumberErr;
  (invByNumber || []).forEach((row) => {
    if (row.account_movement_id) ids.add(row.account_movement_id);
  });

  const { data: orders, error: orderErr } = await supabase
    .from("payment_orders")
    .select("account_movement_id, source_movement_id")
    .is("deleted_at", null)
    .ilike("order_number", pattern);
  if (orderErr) throw orderErr;
  (orders || []).forEach((row) => {
    if (row.account_movement_id) ids.add(row.account_movement_id);
    if (row.source_movement_id) ids.add(row.source_movement_id);
  });

  return [...ids];
}

function emptyMovementsPage(page, limit) {
  return {
    data: [],
    total: 0,
    page: parseInt(page),
    limit: parseInt(limit),
  };
}

self.getMovements = async (req, res) => {
  try {
    const {
      month,
      year,
      page = 1,
      limit = 50,
      dateOrder: dateOrderParam,
      pending,
      search,
    } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const ascending = String(dateOrderParam || "asc").toLowerCase() !== "desc";
    const pendingOnly = isPendingFilter(pending);

    const searchIds = search ? await getSearchMovementIds(search) : null;
    if (searchIds && !searchIds.length) {
      return res.json(emptyMovementsPage(page, limit));
    }

    if (pendingOnly) {
      let pendingIds = await getPendingMovementIds();
      if (!pendingIds.length) {
        return res.json(emptyMovementsPage(page, limit));
      }
      if (searchIds) {
        const searchSet = new Set(searchIds);
        pendingIds = pendingIds.filter((id) => searchSet.has(id));
        if (!pendingIds.length) {
          return res.json(emptyMovementsPage(page, limit));
        }
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

    if (searchIds) {
      query = query.in("id", searchIds);
    }

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
      .select(
        "id, type, amount, description, is_cheque, cheque_due_date, date, movement_kind"
      )
      .is("deleted_at", null);

    if (allError) throw allError;

    const excludedIds = await getBalanceExcludedMovementIds();

    let balanceWithoutCheques = 0;
    let balanceWithCheques = 0;
    let totalFixed = 0;
    let monthlyIncome = 0;
    let monthlyExpense = 0;
    const fixedMovements = [];

    const startDate =
      month && year
        ? DateTime.fromObject({
            year: parseInt(year),
            month: parseInt(month),
            day: 1,
          }).toISODate()
        : null;
    const endDate =
      month && year
        ? DateTime.fromObject({
            year: parseInt(year),
            month: parseInt(month),
            day: 1,
          })
            .endOf("month")
            .toISODate()
        : null;

    allMovements.forEach((m) => {
      const amount = parseFloat(m.amount) || 0;
      const signed = m.type === "INGRESO" ? amount : -amount;
      const effectiveDate =
        m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;

      const isFixed = (m.movement_kind || "UNICA VEZ") === "FIJO";
      const inMonth =
        !startDate ||
        !endDate ||
        (effectiveDate >= startDate && effectiveDate <= endDate);

      if (isFixed && inMonth) {
        totalFixed += signed;
        fixedMovements.push({
          id: m.id,
          type: m.type,
          date: effectiveDate,
          description: (m.description || "").trim(),
          amount,
          signed,
        });
      }

      if (!movementCountsInBalance(m, excludedIds)) return;

      balanceWithCheques += signed;
      if (!m.is_cheque || !m.cheque_due_date || m.cheque_due_date <= today) {
        balanceWithoutCheques += signed;
      }

      if (startDate && endDate && effectiveDate >= startDate && effectiveDate <= endDate) {
        if (m.type === "INGRESO") {
          monthlyIncome += amount;
        } else {
          monthlyExpense += amount;
        }
      }
    });

    fixedMovements.sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

    res.json({
      balanceWithoutCheques,
      balanceWithCheques,
      monthlyIncome,
      monthlyExpense,
      totalFixed,
      fixedMovements,
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
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 15, 1), 90);
    const today = DateTime.now().toISODate();
    const until = DateTime.now().plus({ days }).toISODate();

    const { data, error } = await supabase
      .from("account_movements")
      .select("*")
      .eq("is_cheque", true)
      .is("deleted_at", null)
      .gte("cheque_due_date", today)
      .lte("cheque_due_date", until)
      .order("cheque_due_date", { ascending: true });

    if (error) throw error;

    const enriched = await attachSupplierNames(data || []);
    const toExpire = enriched.filter((m) => m.type === "EGRESO");
    const toCredit = enriched.filter((m) => m.type === "INGRESO");

    res.json({ toExpire, toCredit, days });
  } catch (e) {
    console.error("getUpcomingCheques error:", e.message);
    res.json({ error: e.message });
  }
};

self.createMovement = async (req, res) => {
  try {
    const validationErr = validateMovementBody(req.body);
    if (validationErr) return res.json({ error: validationErr });

    const movement = applyEgresoSupplierFields(
      applyDirectPaymentMethod(
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
      ),
      req.body
    );

    // Ingresos con cheque (toggle UI)
    if (movement.type === "INGRESO" && movement.is_cheque && movement.cheque_due_date) {
      movement.date = movement.cheque_due_date;
    }

    if (req.body.image_key) {
      movement.image_key = req.body.image_key;
    }

    if (movement.supplier_id && movement.invoice_number) {
      await assertNoDuplicateSupplierInvoice({
        supplierId: movement.supplier_id,
        invoiceNumber: movement.invoice_number,
      });
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
    if (e.code === "DUPLICATE_INVOICE") {
      return res.json({ error: e.message });
    }
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

    const built = buildMovementUpdateFromBody(req.body);
    if (built.error) return res.json({ error: built.error });
    const update = built.update;

    if (update.supplier_id && update.invoice_number) {
      try {
        await assertNoDuplicateSupplierInvoice({
          supplierId: update.supplier_id,
          invoiceNumber: update.invoice_number,
          excludeMovementId: movementId,
        });
      } catch (dupErr) {
        if (dupErr.code === "DUPLICATE_INVOICE") {
          return res.json({ error: dupErr.message });
        }
        throw dupErr;
      }
    }

    const activeOrder = await getActiveOrderForMovement(movementId);
    if (activeOrder) {
      if (movementBodyChangesOnlyKind(existing, req.body)) {
        const { data: updated, error } = await supabase
          .from("account_movements")
          .update({
            movement_kind: normalizeMovementKind(req.body.movement_kind),
          })
          .eq("id", movementId)
          .select();

        if (error) throw error;
        return res.json(updated);
      }
      return res.json({
        error:
          "No se puede editar un movimiento con orden de pago activa. Anulá la OP primero y, si corresponde, creá una nueva al guardar.",
      });
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
