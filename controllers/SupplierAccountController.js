"use strict";

const supabase = require("./db");

const self = {};

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function effectiveInvoiceDate(row) {
  return row.due_date || row.created_at?.slice?.(0, 10) || "";
}

/** Impuestos en cashflow: taxes.invoice_id = cashflow.id */
async function fetchTaxesByCashflowIds(cashflowIds) {
  if (!cashflowIds.length) return {};
  const { data, error } = await supabase
    .from("taxes")
    .select("id, invoice_id, name, amount")
    .in("invoice_id", cashflowIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.invoice_id]) map[t.invoice_id] = [];
    map[t.invoice_id].push({ id: t.id, name: t.name, amount: t.amount });
  });
  return map;
}

/** Impuestos en facturas de proveedor (Control): taxes.supplier_invoice_id */
async function fetchTaxesBySupplierInvoiceIds(supplierInvoiceIds) {
  if (!supplierInvoiceIds.length) return {};
  const { data, error } = await supabase
    .from("taxes")
    .select("id, supplier_invoice_id, name, amount")
    .in("supplier_invoice_id", supplierInvoiceIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.supplier_invoice_id]) map[t.supplier_invoice_id] = [];
    map[t.supplier_invoice_id].push({
      id: t.id,
      name: t.name,
      amount: t.amount,
    });
  });
  return map;
}

function cashflowMovementItems(cashflowRows, taxesByCashflowId) {
  return (cashflowRows || []).map((cf) => {
    const abs = Math.abs(parseAmount(cf.amount));
    const reference = cf.reference ? String(cf.reference).trim() : "";
    // Factura de cashflow (EGRESO con referencia) = deuda (+).
    // Egreso sin referencia = pago/gasto (-). Ingreso = (+).
    const isInvoice = cf.type === "EGRESO" && reference;
    const signed =
      cf.type === "INGRESO" || isInvoice ? abs : -abs;

    return {
      id: `cashflow-${cf.id}`,
      source: "cashflow",
      source_id: cf.id,
      movement_type: cf.type,
      category:
        cf.type === "INGRESO"
          ? "INGRESO"
          : reference
            ? "FACTURA"
            : "EGRESO",
      date: cf.date,
      description:
        cf.description ||
        (reference
          ? `Factura ${reference}`
          : cf.type === "INGRESO"
            ? "Ingreso"
            : "Egreso"),
      invoice_number: reference || null,
      amount: abs,
      signed_amount: signed,
      payment_method: cf.payment_method,
      taxes: taxesByCashflowId[cf.id] || [],
    };
  });
}

function paymentOrderItems(orders) {
  return (orders || []).map((po) => {
    const amt = Math.abs(parseAmount(po.amount));
    const invoiceKey =
      po.supplier_invoice_id != null
        ? `supplier-invoice-${po.supplier_invoice_id}`
        : po.cashflow_id != null
          ? `cashflow-${po.cashflow_id}`
          : null;
    return {
      id: `payment-order-${po.id}`,
      source: "payment_order",
      invoice_key: invoiceKey,
      movement_type: "EGRESO",
      category: "ORDEN_PAGO",
      date: po.payment_date,
      description: po.description
        ? `Orden de Pago ${po.order_number} - ${po.description}`
        : `Orden de Pago ${po.order_number}`,
      invoice_number: null,
      order_number: po.order_number,
      payment_method: po.payment_method,
      amount: amt,
      // La orden de pago concilia el saldo (pago, crédito).
      signed_amount: -amt,
      display_amount: -amt,
      taxes: [],
    };
  });
}

function supplierInvoiceMovementItems(supplierInvoices, taxesBySupplierInvoiceId) {
  return (supplierInvoices || []).map((inv) => {
    const total = parseAmount(inv.total ?? inv.amount);
    return {
      id: `supplier-invoice-${inv.id}`,
      source: "control",
      source_id: inv.id,
      movement_type: "EGRESO",
      category: "FACTURA_CONTROL",
      date: effectiveInvoiceDate(inv),
      description:
        inv.description ||
        (inv.invoice_number
          ? `Factura ${inv.invoice_number}`
          : "Factura (Control)"),
      invoice_number: inv.invoice_number || null,
      amount: total,
      signed_amount: total,
      taxes: taxesBySupplierInvoiceId[inv.id] || [],
      account_movement_id: inv.account_movement_id,
    };
  });
}

function sortAndApplyBalance(movements) {
  // Fecha de cada factura/movimiento por su clave, para anclar las órdenes de pago.
  const dateByKey = {};
  movements.forEach((m) => {
    dateByKey[m.id] = m.date;
  });

  // Cada movimiento recibe una clave de orden:
  //   _chrono : fecha que define la posición cronológica
  //   _anchor : agrupa la factura con su orden de pago
  //   _seq    : 0 = factura/movimiento, 1 = orden de pago (va después)
  const enriched = movements.map((m) => {
    if (m.source === "payment_order") {
      const anchorDate =
        (m.invoice_key && dateByKey[m.invoice_key]) || m.date;
      return {
        ...m,
        _chrono: String(anchorDate || ""),
        _anchor: m.invoice_key || m.id,
        _seq: 1,
      };
    }
    return {
      ...m,
      _chrono: String(m.date || ""),
      _anchor: m.id,
      _seq: 0,
    };
  });

  const sorted = enriched.sort((a, b) => {
    const c = a._chrono.localeCompare(b._chrono);
    if (c !== 0) return c;
    const an = String(a._anchor).localeCompare(String(b._anchor));
    if (an !== 0) return an;
    if (a._seq !== b._seq) return a._seq - b._seq;
    return String(a.id).localeCompare(String(b.id));
  });

  let runningBalance = 0;
  return sorted.map((m) => {
    runningBalance += m.signed_amount;
    const { _chrono, _anchor, _seq, ...rest } = m;
    return { ...rest, balance: runningBalance };
  });
}

function computeSummary(cashflowRows, supplierInvoices, paymentOrders) {
  const cf = cashflowRows || [];
  const inv = supplierInvoices || [];
  const po = paymentOrders || [];

  const totalCashflowEgresos = cf
    .filter((r) => r.type === "EGRESO")
    .reduce((acc, r) => acc + Math.abs(parseAmount(r.amount)), 0);
  const totalCashflowIngresos = cf
    .filter((r) => r.type === "INGRESO")
    .reduce((acc, r) => acc + Math.abs(parseAmount(r.amount)), 0);
  const totalControlInvoices = inv.reduce(
    (acc, r) => acc + parseAmount(r.total ?? r.amount),
    0
  );

  const totalPaymentOrders = po.reduce(
    (acc, p) => acc + Math.abs(parseAmount(p.amount)),
    0
  );

  let balance = 0;
  cf.forEach((r) => {
    const abs = Math.abs(parseAmount(r.amount));
    const reference = r.reference ? String(r.reference).trim() : "";
    const isInvoice = r.type === "EGRESO" && reference;
    // Factura de cashflow e ingresos suman; egreso sin referencia resta.
    balance += r.type === "INGRESO" || isInvoice ? abs : -abs;
  });
  balance += totalControlInvoices;
  balance -= totalPaymentOrders;

  return {
    totalCashflowEgresos,
    totalCashflowIngresos,
    totalControlInvoices,
    totalPaymentOrders,
    totalInvoices: totalCashflowEgresos + totalControlInvoices,
    totalPayments: totalCashflowEgresos,
    totalCredits: totalCashflowIngresos,
    balance,
  };
}

async function buildMergedAccountData(
  cashflowRows,
  supplierInvoices,
  paymentOrders
) {
  const taxesByCashflowId = await fetchTaxesByCashflowIds(
    (cashflowRows || []).map((cf) => cf.id)
  );
  const taxesBySupplierInvoiceId = await fetchTaxesBySupplierInvoiceIds(
    (supplierInvoices || []).map((inv) => inv.id)
  );

  const movements = sortAndApplyBalance([
    ...cashflowMovementItems(cashflowRows, taxesByCashflowId),
    ...supplierInvoiceMovementItems(supplierInvoices, taxesBySupplierInvoiceId),
    ...paymentOrderItems(paymentOrders),
  ]);

  const summary = computeSummary(cashflowRows, supplierInvoices, paymentOrders);

  return { movements, summary };
}

self.getAllSupplierAccounts = async (req, res) => {
  try {
    const { data: suppliers, error: suppliersError } = await supabase
      .from("suppliers")
      .select("id, name, last_name, fantasy_name, cuit")
      .is("deleted_at", null)
      .order("fantasy_name", { ascending: true });

    if (suppliersError) throw suppliersError;

    const { data: cashflowRows, error: cashflowError } = await supabase
      .from("cashflow")
      .select("id, provider, type, amount, reference, date")
      .is("deleted_at", null)
      .not("provider", "is", null);

    if (cashflowError) throw cashflowError;

    const { data: supplierInvoices, error: supplierInvoicesError } =
      await supabase
        .from("supplier_invoices")
        .select(
          "id, supplier_id, amount, total, due_date, created_at, account_movement_id"
        )
        .is("deleted_at", null);

    if (supplierInvoicesError) throw supplierInvoicesError;

    const { data: paymentOrders, error: paymentOrdersError } = await supabase
      .from("payment_orders")
      .select(
        "supplier_id, supplier_invoice_id, cashflow_id, account_movement_id, amount"
      )
      .is("deleted_at", null);

    if (paymentOrdersError) throw paymentOrdersError;

    // Facturas colgadas de un movimiento de conciliación de OP no son deuda real.
    const conciliationMovementIds = new Set(
      (paymentOrders || [])
        .map((po) => po.account_movement_id)
        .filter((v) => v != null)
    );

    const ordersBySupplier = {};
    (paymentOrders || []).forEach((po) => {
      if (po.supplier_id == null) return;
      if (!ordersBySupplier[po.supplier_id]) ordersBySupplier[po.supplier_id] = [];
      ordersBySupplier[po.supplier_id].push(po);
    });

    const cashflowByProvider = {};
    (cashflowRows || []).forEach((cf) => {
      const pid = cf.provider;
      if (!cashflowByProvider[pid]) cashflowByProvider[pid] = [];
      cashflowByProvider[pid].push(cf);
    });

    const invoicesBySupplier = {};
    (supplierInvoices || [])
      .filter((inv) => !conciliationMovementIds.has(inv.account_movement_id))
      .forEach((inv) => {
        if (!invoicesBySupplier[inv.supplier_id]) {
          invoicesBySupplier[inv.supplier_id] = [];
        }
        invoicesBySupplier[inv.supplier_id].push(inv);
      });

    const list = (suppliers || []).map((supplier) => {
      const supplierCashflow = cashflowByProvider[supplier.id] || [];
      const supplierControlInvoices = invoicesBySupplier[supplier.id] || [];
      const supplierOrders = ordersBySupplier[supplier.id] || [];
      const summary = computeSummary(
        supplierCashflow,
        supplierControlInvoices,
        supplierOrders
      );

      return {
        supplier,
        summary,
        movement_count:
          supplierCashflow.length +
          supplierControlInvoices.length +
          supplierOrders.length,
      };
    });

    list.sort((a, b) => {
      const nameA = (a.supplier.fantasy_name || a.supplier.name || "").toLowerCase();
      const nameB = (b.supplier.fantasy_name || b.supplier.name || "").toLowerCase();
      return nameA.localeCompare(nameB);
    });

    return res.json(list);
  } catch (e) {
    console.error("getAllSupplierAccounts", e);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
};

self.getSupplierAccount = async (req, res) => {
  try {
    const supplierId = parseInt(req.params.supplier_id, 10);
    if (!supplierId) {
      return res.status(400).json({ error: "Proveedor inválido" });
    }

    const { data: supplier, error: supplierError } = await supabase
      .from("suppliers")
      .select("id, name, last_name, fantasy_name, cuit, email, phone")
      .eq("id", supplierId)
      .is("deleted_at", null)
      .maybeSingle();

    if (supplierError) throw supplierError;
    if (!supplier) {
      return res.status(404).json({ error: "Proveedor no encontrado" });
    }

    const { data: cashflowRows, error: cashflowError } = await supabase
      .from("cashflow")
      .select(
        "id, type, amount, net_amount, date, description, reference, payment_method"
      )
      .eq("provider", supplierId)
      .is("deleted_at", null);

    if (cashflowError) throw cashflowError;

    const { data: supplierInvoices, error: supplierInvoicesError } =
      await supabase
        .from("supplier_invoices")
        .select(
          `
        id,
        supplier_id,
        amount,
        total,
        invoice_number,
        description,
        due_date,
        account_movement_id,
        created_at
      `
        )
        .eq("supplier_id", supplierId)
        .is("deleted_at", null);

    if (supplierInvoicesError) throw supplierInvoicesError;

    const { data: paymentOrders, error: paymentOrdersError } = await supabase
      .from("payment_orders")
      .select(
        `
        id,
        order_number,
        supplier_invoice_id,
        cashflow_id,
        account_movement_id,
        payment_method,
        amount,
        description,
        payment_date
      `
      )
      .eq("supplier_id", supplierId)
      .is("deleted_at", null);

    if (paymentOrdersError) throw paymentOrdersError;

    // Excluir las facturas que son movimientos de conciliación de OP (no son deuda real).
    const conciliationMovementIds = new Set(
      (paymentOrders || [])
        .map((po) => po.account_movement_id)
        .filter((v) => v != null)
    );
    const realSupplierInvoices = (supplierInvoices || []).filter(
      (inv) => !conciliationMovementIds.has(inv.account_movement_id)
    );

    const { movements, summary } = await buildMergedAccountData(
      cashflowRows,
      realSupplierInvoices,
      paymentOrders
    );

    return res.json({
      supplier,
      movements,
      summary,
    });
  } catch (e) {
    console.error("getSupplierAccount", e);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
};

module.exports = self;
