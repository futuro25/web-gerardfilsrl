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
    const signed = cf.type === "INGRESO" ? abs : -abs;
    const reference = cf.reference ? String(cf.reference).trim() : "";

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
  const sorted = [...movements].sort((a, b) => {
    const da = String(a.date || "");
    const db = String(b.date || "");
    const c = da.localeCompare(db);
    if (c !== 0) return c;
    return String(a.id).localeCompare(String(b.id));
  });

  let runningBalance = 0;
  return sorted.map((m) => {
    runningBalance += m.signed_amount;
    return { ...m, balance: runningBalance };
  });
}

function computeSummary(cashflowRows, supplierInvoices) {
  const cf = cashflowRows || [];
  const inv = supplierInvoices || [];

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

  let balance = 0;
  cf.forEach((r) => {
    const abs = Math.abs(parseAmount(r.amount));
    balance += r.type === "INGRESO" ? abs : -abs;
  });
  balance += totalControlInvoices;

  return {
    totalCashflowEgresos,
    totalCashflowIngresos,
    totalControlInvoices,
    totalInvoices: totalCashflowEgresos + totalControlInvoices,
    totalPayments: totalCashflowEgresos,
    totalCredits: totalCashflowIngresos,
    balance,
  };
}

async function buildMergedAccountData(cashflowRows, supplierInvoices) {
  const taxesByCashflowId = await fetchTaxesByCashflowIds(
    (cashflowRows || []).map((cf) => cf.id)
  );
  const taxesBySupplierInvoiceId = await fetchTaxesBySupplierInvoiceIds(
    (supplierInvoices || []).map((inv) => inv.id)
  );

  const movements = sortAndApplyBalance([
    ...cashflowMovementItems(cashflowRows, taxesByCashflowId),
    ...supplierInvoiceMovementItems(supplierInvoices, taxesBySupplierInvoiceId),
  ]);

  const summary = computeSummary(cashflowRows, supplierInvoices);

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
        .select("id, supplier_id, amount, total, due_date, created_at")
        .is("deleted_at", null);

    if (supplierInvoicesError) throw supplierInvoicesError;

    const cashflowByProvider = {};
    (cashflowRows || []).forEach((cf) => {
      const pid = cf.provider;
      if (!cashflowByProvider[pid]) cashflowByProvider[pid] = [];
      cashflowByProvider[pid].push(cf);
    });

    const invoicesBySupplier = {};
    (supplierInvoices || []).forEach((inv) => {
      if (!invoicesBySupplier[inv.supplier_id]) {
        invoicesBySupplier[inv.supplier_id] = [];
      }
      invoicesBySupplier[inv.supplier_id].push(inv);
    });

    const list = (suppliers || []).map((supplier) => {
      const supplierCashflow = cashflowByProvider[supplier.id] || [];
      const supplierControlInvoices = invoicesBySupplier[supplier.id] || [];
      const summary = computeSummary(supplierCashflow, supplierControlInvoices);

      return {
        supplier,
        summary,
        movement_count:
          supplierCashflow.length + supplierControlInvoices.length,
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

    const { movements, summary } = await buildMergedAccountData(
      cashflowRows,
      supplierInvoices
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
