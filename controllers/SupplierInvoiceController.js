"use strict";

const supabase = require("./db");

const self = {};

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

async function attachTaxes(rows) {
  if (!rows?.length) return rows || [];
  const taxesMap = await fetchTaxesBySupplierInvoiceIds(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    taxes: taxesMap[row.id] || [],
  }));
}

self.getSupplierInvoiceByAccountMovement = async (req, res) => {
  const account_movement_id = req.params.account_movement_id;
  try {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select(
        `
        *,
        supplier:suppliers (
          id,
          fantasy_name,
          name
        )
      `
      )
      .eq("account_movement_id", account_movement_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    const [withTaxes] = await attachTaxes([data]);
    res.json(withTaxes);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createSupplierInvoice = async (req, res) => {
  try {
    const row = {
      supplier_id: req.body.supplier_id,
      amount: req.body.amount,
      invoice_number: req.body.invoice_number || "",
      description: req.body.description,
      due_date: req.body.due_date,
      total: req.body.total,
      account_movement_id: req.body.account_movement_id || null,
    };

    const { data: created, error } = await supabase
      .from("supplier_invoices")
      .insert(row)
      .select();

    if (error) {
      console.error("Error creando factura de proveedor:", error);
      return res.status(500).json({ error: "Error al crear la factura" });
    }

    let newTaxes = [];
    if (created?.length && Array.isArray(req.body.taxes)) {
      const mapped = req.body.taxes.map((tax) => ({
        supplier_invoice_id: created[0].id,
        name: tax.type || tax.name,
        amount: parseFloat(tax.value ?? tax.amount),
      }));

      const { data: taxRows, error: taxesError } = await supabase
        .from("taxes")
        .insert(mapped)
        .select();

      if (taxesError) {
        console.error("Error creando impuestos:", taxesError);
        return res
          .status(500)
          .json({ error: "Error al insertar los impuestos" });
      }
      newTaxes = taxRows;
    }

    return res.status(201).json({
      invoice: created[0],
      taxes: newTaxes,
    });
  } catch (e) {
    console.error("createSupplierInvoice", e.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

self.updateSupplierInvoice = async (req, res) => {
  try {
    const id = req.params.id;
    const update = { ...req.body };
    if (update.id) delete update.id;

    const taxes = update.taxes || [];
    delete update.taxes;

    const { data: updated, error } = await supabase
      .from("supplier_invoices")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    await supabase.from("taxes").delete().eq("supplier_invoice_id", id);

    let newTaxes = [];
    if (Array.isArray(taxes) && taxes.length > 0) {
      const mapped = taxes.map((t) => ({
        supplier_invoice_id: parseInt(id, 10),
        name: t.type || t.name,
        amount: parseFloat(t.value ?? t.amount),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("taxes")
        .insert(mapped)
        .select();

      if (insertError) throw insertError;
      newTaxes = inserted;
    }

    return res.status(200).json({
      invoice: updated?.[0] || null,
      taxes: newTaxes,
    });
  } catch (e) {
    console.error("updateSupplierInvoice", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
