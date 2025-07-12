"use strict";

const self = {};
const supabase = require("./db");
const { DateTime } = require("luxon");

const _ = require("lodash");

self.getPaychecks = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("paychecks")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getPaycheckById = async (req, res) => {
  const paycheck_id = req.params.paycheck_id;
  try {
    const { data, error } = await supabase
      .from("paychecks")
      .select("*")
      .eq("id", paycheck_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createPaycheck = async (req, res) => {
  try {
    const paycheck = {
      client_id: req.body.client_id,
      number: req.body.number,
      bank: req.body.bank,
      amount: req.body.amount,
      due_date: req.body.due_date,
      type: req.body.type,
      movement_id: req.body.movement_id || null,
    };

    const { data: newPaycheck, error } = await supabase
      .from("paychecks")
      .insert(paycheck)
      .select();

    if (error) {
      console.error("Error creating paycheck", error);
      throw error;
    }

    return res.json(newPaycheck);
  } catch (e) {
    console.log("Paycheck creation error", e.message);
    return res.json(e);
  }
};

self.getPaycheckByIdAndUpdate = async (req, res) => {
  try {
    const paycheck_id = req.params.paycheck_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedPaycheck, error } = await supabase
      .from("paychecks")
      .update(update)
      .eq("id", paycheck_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedPaycheck);
  } catch (e) {
    console.error("delete paycheck by id", e.message);
    res.json({ error: e.message });
  }
};

self.deletePaycheckById = async (req, res) => {
  try {
    const paycheck_id = req.params.paycheck_id;
    const update = { deleted_at: new Date() };
    const { data: updatedPaycheck, error } = await supabase
      .from("paychecks")
      .update(update)
      .eq("id", paycheck_id);

    res.json(updatedPaycheck);
  } catch (e) {
    console.error("delete paycheck by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
