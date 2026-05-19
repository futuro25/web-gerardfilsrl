"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

async function fetchTaxesByInvoiceIds(invoiceIds) {
  if (!invoiceIds.length) return {};
  const { data, error } = await supabase
    .from("taxes")
    .select("id, invoice_id, name, amount")
    .in("invoice_id", invoiceIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.invoice_id]) map[t.invoice_id] = [];
    map[t.invoice_id].push({ id: t.id, name: t.name, amount: t.amount });
  });
  return map;
}

async function attachTaxesToInvoices(invoices) {
  if (!invoices?.length) return invoices || [];
  const taxesByInvoiceId = await fetchTaxesByInvoiceIds(
    invoices.map((inv) => inv.id)
  );
  return invoices.map((inv) => ({
    ...inv,
    taxes: taxesByInvoiceId[inv.id] || [],
  }));
}

async function attachTaxesToInvoice(invoice) {
  if (!invoice) return invoice;
  const [withTaxes] = await attachTaxesToInvoices([invoice]);
  return withTaxes;
}

self.getInvoices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select(
        `
        *,  
        supplier:suppliers (
          id,
          fantasy_name
        )
      `
      )
      .is("deleted_at", null);

    if (error) throw error;

    res.json(await attachTaxesToInvoices(data || []));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getInvoiceById = async (req, res) => {
  const invoice_id = req.params.invoice_id;
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoice_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getInvoiceByAccountMovement = async (req, res) => {
  const account_movement_id = req.params.account_movement_id;
  try {
    const { data, error } = await supabase
      .from("invoices")
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

    res.json(await attachTaxesToInvoice(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createInvoice = async (req, res) => {
  try {
    const invoice = {
      supplier_id: req.body.supplier_id,
      amount: req.body.amount,
      invoice_number: req.body.invoice_number,
      description: req.body.description,
      due_date: req.body.due_date,
      total: req.body.total,
      account_movement_id: req.body.account_movement_id || null,
    };

    const { data: newInvoice, error } = await supabase
      .from("invoices")
      .insert(invoice)
      .select();

    if (error) {
      console.error("Error creando factura:", error);
      return res.status(500).json({ error: "Error al crear la factura" });
    }

    let newInvoiceTaxes = [];

    if (newInvoice?.length && Array.isArray(req.body.taxes)) {
      const taxes = req.body.taxes;

      const invoiceTaxes = taxes.map((tax) => ({
        invoice_id: newInvoice[0].id,
        name: tax.type,
        amount: parseFloat(tax.value),
      }));

      const { data, error: taxesError } = await supabase
        .from("taxes")
        .insert(invoiceTaxes);

      console.log("taxes", invoiceTaxes);
      if (taxesError) {
        console.error("Error creando impuestos de factura:", taxesError);
        return res
          .status(500)
          .json({ error: "Error al insertar los impuestos" });
      }

      newInvoiceTaxes = data;
    }

    return res.status(201).json({
      invoice: newInvoice[0],
      taxes: newInvoiceTaxes,
    });
  } catch (e) {
    console.error("Invoice creation error", e.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

self.getInvoiceByIdAndUpdate = async (req, res) => {
  try {
    const invoice_id = req.params.invoice_id;
    const update = { ...req.body };

    if (update.id) {
      delete update.id;
    }

    const taxes = update.taxes || [];
    delete update.taxes;

    const { data: updatedInvoice, error } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", invoice_id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    await supabase.from("taxes").delete().eq("invoice_id", invoice_id);

    let newTaxes = [];

    if (Array.isArray(taxes) && taxes.length > 0) {
      const mappedTaxes = taxes.map((t) => ({
        invoice_id: parseInt(invoice_id, 10),
        name: t.type || t.name,
        amount: parseFloat(t.value ?? t.amount),
      }));

      const { data: insertedTaxes, error: insertError } = await supabase
        .from("taxes")
        .insert(mappedTaxes)
        .select();

      if (insertError) throw insertError;
      newTaxes = insertedTaxes;
    }

    return res.status(200).json({
      invoice: updatedInvoice?.[0] || null,
      taxes: newTaxes,
    });
  } catch (e) {
    console.error("update invoice by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteInvoiceById = async (req, res) => {
  try {
    const invoice_id = req.params.invoice_id;
    const update = { deleted_at: new Date() };
    const { data: updatedInvoice, error } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", invoice_id);

    res.json(updatedInvoice);
  } catch (e) {
    console.error("delete invoice by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
