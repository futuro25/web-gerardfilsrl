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
        ),
        taxes_deliveries:taxes_deliveries (
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
      type: req.body.type.id,
      total: req.body.total,
    };

    const { data: newDelivery, error } = await supabase
      .from("deliveries")
      .insert(delivery)
      .select();

    if (req.body.delivery_note && newDelivery?.[0]) {
      const deliveryNoteUpdate = {
        invoice_id: newDelivery[0].id,
      };

      const { error: deliveryNoteError } = await supabase
        .from("deliverynotes")
        .insert(deliveryNoteUpdate);

      if (deliveryNoteError) {
        console.error(
          "Error updating delivery note with invoice_id:",
          deliveryNoteError
        );
        return res.status(500).json({ error: deliveryNoteError.message });
      }
    }

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

    // Sacar taxes del update si viene
    const taxes = update.taxes || [];
    delete update.taxes;

    const { data: updatedDelivery, error } = await supabase
      .from("deliveries")
      .update(update)
      .eq("id", delivery_id)
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

    if (req.body.delivery_note && newDelivery?.[0]) {
      const { error: deliveryNoteError } = await supabase
        .from("deliverynotes")
        .update({
          invoice_id: delivery_id,
        })
        .eq("id", req.body.delivery_note);
      if (deliveryNoteError) {
        console.error(
          "Error updating delivery note with invoice_id:",
          deliveryNoteError
        );
        return res.status(500).json({ error: deliveryNoteError.message });
      }
    }

    return res.status(200).json({
      delivery: updatedDelivery?.[0] || null,
      taxes: newTaxes,
    });
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
