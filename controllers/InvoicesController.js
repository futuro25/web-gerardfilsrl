"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getInvoices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("invoices")
      .select("*")
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
    };

    const { data: newInvoice, error } = await supabase
      .from("invoices")
      .insert(invoice)
      .select();

    return res.json(newInvoice);
  } catch (e) {
    console.log("Invoice creation error", e.message);
    return res.json(e);
  }
};

self.getInvoiceByIdAndUpdate = async (req, res) => {
  try {
    const invoice_id = req.params.invoice_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedInvoice, error } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", invoice_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedInvoice);
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
