"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

self.getDeliveries = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select(
        `
        *,  
        client:clients (
          id,
          fantasy_name
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

self.getDeliveryById = async (req, res) => {
  const delivery_id = req.params.delivery_id;
  try {
    const { data, error } = await supabase
      .from("deliveries")
      .select("*")
      .eq("id", delivery_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(_.first(data));
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createDelivery = async (req, res) => {
  try {
    const delivery = {
      client_id: req.body.client_id,
      amount: req.body.amount,
      invoice_number: req.body.invoice_number,
      description: req.body.description,
      due_date: req.body.due_date,
    };

    const { data: newDelivery, error } = await supabase
      .from("deliveries")
      .insert(delivery)
      .select();

    console.log(error);
    return res.json(newDelivery);
  } catch (e) {
    console.log("Delivery creation error", e.message);
    return res.json(e);
  }
};

self.getDeliveryByIdAndUpdate = async (req, res) => {
  try {
    const delivery_id = req.params.delivery_id;
    const update = req.body;

    if (update.id) {
      delete update.id;
    }

    const { data: updatedDelivery, error } = await supabase
      .from("deliveries")
      .update(update)
      .eq("id", delivery_id)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(updatedDelivery);
  } catch (e) {
    console.error("delete delivery by id", e.message);
    res.json({ error: e.message });
  }
};

self.deleteDeliveryById = async (req, res) => {
  try {
    const delivery_id = req.params.delivery_id;
    const update = { deleted_at: new Date() };
    const { data: updatedDelivery, error } = await supabase
      .from("deliveries")
      .update(update)
      .eq("id", delivery_id);

    res.json(updatedDelivery);
  } catch (e) {
    console.error("delete delivery by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
