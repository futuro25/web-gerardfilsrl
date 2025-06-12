"use strict";

const self = {};
const supabase = require("./db.js");
const _ = require("lodash");

self.getPayments = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createPayment = async (req, res) => {
  try {
    const payment = {
      supplier: req.body.supplier,
      cuit: req.body.cuit,
      net_amount: req.body.netAmount,
      iva: req.body.iva,
      condition: req.body.condition,
      retention: req.body.retention,
      total_invoice: req.body.totalInvoice,
      amount_to_pay: req.body.amountToPay,
    };

    const { data: newPayment, error } = await supabase
      .from("payments")
      .insert(payment)
      .select();

    return res.json(newPayment);
  } catch (e) {
    console.log("Payment creation error", e.message);
    return res.json(e);
  }
};

self.getPaymentByIdAndUpdate = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;

    const update = {
      amount_to_pay: req.body.amountToPay,
      condition: req.body.condition,
      cuit: req.body.cuit,
      id: req.body.id,
      iva: req.body.iva,
      net_amount: req.body.netAmount,
      retention: req.body.retention,
      supplier: req.body.supplier,
      total_invoice: req.body.totalInvoice,
    };

    const { data: updatedPayment, error } = await supabase
      .from("payments")
      .update(update)
      .eq("id", payment_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedPayment);
  } catch (e) {
    console.error("delete payment by id", e.message);
    res.json({ error: e.message });
  }
};

self.deletePaymentById = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;
    const update = { deleted_at: new Date() };
    const { data: updatedPayment, error } = await supabase
      .from("payments")
      .update(update)
      .eq("id", payment_id);

    res.json(updatedPayment);
  } catch (e) {
    console.error("delete payment by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
