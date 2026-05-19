"use strict";

const supabase = require("./db");

const self = {};

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function effectiveDate(row) {
  return row.date || row.due_date || row.created_at?.slice?.(0, 10) || "";
}

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

    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
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
        created_at,
        taxes:taxes (
          id,
          name,
          amount
        )
      `
      )
      .eq("supplier_id", supplierId)
      .is("deleted_at", null);

    if (invoicesError) throw invoicesError;

    const { data: cashflowRows, error: cashflowError } = await supabase
      .from("cashflow")
      .select("id, type, amount, net_amount, date, description, reference, payment_method")
      .eq("provider", supplierId)
      .is("deleted_at", null);

    if (cashflowError) throw cashflowError;

    const movements = [];

    (invoices || []).forEach((inv) => {
      const total = parseAmount(inv.total ?? inv.amount);
      movements.push({
        id: `invoice-${inv.id}`,
        source: "invoice",
        source_id: inv.id,
        movement_type: "EGRESO",
        category: "FACTURA",
        date: effectiveDate(inv),
        description:
          inv.description ||
          (inv.invoice_number ? `Factura ${inv.invoice_number}` : "Factura"),
        invoice_number: inv.invoice_number,
        amount: total,
        signed_amount: total,
        taxes: inv.taxes || [],
        account_movement_id: inv.account_movement_id,
      });
    });

    (cashflowRows || []).forEach((cf) => {
      const raw = parseAmount(cf.amount);
      const signed = cf.type === "INGRESO" ? Math.abs(raw) : -Math.abs(raw);
      movements.push({
        id: `cashflow-${cf.id}`,
        source: "cashflow",
        source_id: cf.id,
        movement_type: cf.type,
        category: cf.type === "INGRESO" ? "INGRESO" : "PAGO",
        date: cf.date,
        description: cf.description || cf.reference || "Movimiento cashflow",
        invoice_number: cf.reference || null,
        amount: Math.abs(raw),
        signed_amount: signed,
        payment_method: cf.payment_method,
        taxes: [],
      });
    });

    movements.sort((a, b) => {
      const da = String(a.date || "");
      const db = String(b.date || "");
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      return String(a.id).localeCompare(String(b.id));
    });

    let runningBalance = 0;
    const withBalance = movements.map((m) => {
      runningBalance += m.signed_amount;
      return { ...m, balance: runningBalance };
    });

    const totalInvoices = (invoices || []).reduce(
      (acc, inv) => acc + parseAmount(inv.total ?? inv.amount),
      0
    );
    const totalPayments = (cashflowRows || [])
      .filter((cf) => cf.type === "EGRESO")
      .reduce((acc, cf) => acc + Math.abs(parseAmount(cf.amount)), 0);
    const totalCredits = (cashflowRows || [])
      .filter((cf) => cf.type === "INGRESO")
      .reduce((acc, cf) => acc + Math.abs(parseAmount(cf.amount)), 0);

    return res.json({
      supplier,
      movements: withBalance,
      summary: {
        totalInvoices,
        totalPayments,
        totalCredits,
        balance: runningBalance,
      },
    });
  } catch (e) {
    console.error("getSupplierAccount", e);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
};

module.exports = self;
