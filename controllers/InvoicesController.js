"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

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
        ),
        taxes:taxes (
          id,
          name,
          amount
        )
      `
      )
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
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

self.createInvoice = async (req, res) => {
  try {
    const invoice = {
      supplier_id: req.body.supplier_id,
      amount: req.body.amount,
      invoice_number: req.body.invoice_number,
      description: req.body.description,
      due_date: req.body.due_date,
      total: req.body.total,
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
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    // Sacar taxes del update si viene
    const taxes = update.taxes || [];
    delete update.taxes;

    const { data: updatedInvoice, error } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", invoice_id)
      .is("deleted_at", null);

    if (error) throw error;

    // Eliminar impuestos anteriores
    await supabase.from("invoice_taxes").delete().eq("invoice_id", delivery_id);

    // Insertar nuevos impuestos
    let newTaxes = [];

    if (Array.isArray(taxes) && taxes.length > 0) {
      const mappedTaxes = taxes.map((t) => ({
        invoice_id: delivery_id,
        name: t.type || t.name,
        amount: parseFloat(t.value),
      }));

      const { data: insertedTaxes, error: insertError } = await supabase
        .from("invoice_taxes")
        .insert(mappedTaxes)
        .select();

      if (insertError) throw insertError;
      newTaxes = insertedTaxes;
    }

    return res.status(200).json({
      delivery: updatedDelivery?.[0] || null,
      taxes: newTaxes,
    });
  } catch (e) {
    console.error("delete invoice by id", e.message);
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
