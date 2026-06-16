"use strict";

const self = {};
const supabase = require("./db");
const _ = require("lodash");

async function syncDeliveryNoteLink(deliveryId, deliveryNoteId, previousDeliveryNoteId) {
  if (
    previousDeliveryNoteId &&
    previousDeliveryNoteId !== deliveryNoteId
  ) {
    await supabase
      .from("deliverynotes")
      .update({ invoice_id: null })
      .eq("id", previousDeliveryNoteId)
      .is("deleted_at", null);
  }

  if (deliveryNoteId) {
    const { error } = await supabase
      .from("deliverynotes")
      .update({ invoice_id: deliveryId })
      .eq("id", deliveryNoteId)
      .is("deleted_at", null);
    if (error) throw error;
  }
}

async function insertDeliveryTaxes(deliveryId, taxes) {
  if (!deliveryId || !Array.isArray(taxes) || !taxes.length) return [];

  const mappedTaxes = taxes
    .filter((t) => t.value !== "" && t.value != null)
    .map((t) => ({
      invoice_id: deliveryId,
      name: t.type || t.name,
      amount: parseFloat(t.value ?? t.amount),
    }));

  if (!mappedTaxes.length) return [];

  const { data, error } = await supabase
    .from("invoice_taxes")
    .insert(mappedTaxes)
    .select();
  if (error) throw error;
  return data || [];
}

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
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    res.json(data || []);
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
      description: req.body.description || null,
      due_date: req.body.due_date || null,
      type: req.body.type || null,
      total: req.body.total,
      image_key: req.body.image_key || null,
    };

    const { data: newDelivery, error } = await supabase
      .from("deliveries")
      .insert(delivery)
      .select();

    if (error) {
      console.error("Error creando factura de venta:", error);
      return res.status(500).json({ error: error.message });
    }

    const created = newDelivery?.[0];
    if (!created) {
      return res.status(500).json({ error: "No se pudo crear la factura" });
    }

    await insertDeliveryTaxes(created.id, req.body.taxes);

    const deliveryNoteId = req.body.delivery_note
      ? Number(req.body.delivery_note)
      : null;
    if (deliveryNoteId) {
      await syncDeliveryNoteLink(created.id, deliveryNoteId, null);
    }

    return res.status(201).json(created);
  } catch (e) {
    console.error("Delivery creation error", e.message);
    return res.status(500).json({ error: e.message || "Error interno" });
  }
};

self.getDeliveryByIdAndUpdate = async (req, res) => {
  try {
    const delivery_id = req.params.delivery_id;
    const update = { ...req.body };

    if (update.id) delete update.id;

    const taxes = update.taxes || [];
    const deliveryNoteId = update.delivery_note
      ? Number(update.delivery_note)
      : null;
    const previousDeliveryNoteId = update.previous_delivery_note
      ? Number(update.previous_delivery_note)
      : null;

    delete update.taxes;
    delete update.delivery_note;
    delete update.previous_delivery_note;

    const allowed = [
      "client_id",
      "amount",
      "invoice_number",
      "description",
      "due_date",
      "type",
      "total",
      "image_key",
    ];
    const patch = {};
    allowed.forEach((key) => {
      if (update[key] !== undefined) patch[key] = update[key];
    });

    const { data: updatedDelivery, error } = await supabase
      .from("deliveries")
      .update(patch)
      .eq("id", delivery_id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    await supabase.from("invoice_taxes").delete().eq("invoice_id", delivery_id);
    const newTaxes = await insertDeliveryTaxes(delivery_id, taxes);

    await syncDeliveryNoteLink(
      Number(delivery_id),
      deliveryNoteId,
      previousDeliveryNoteId
    );

    return res.status(200).json({
      delivery: updatedDelivery?.[0] || null,
      taxes: newTaxes,
    });
  } catch (e) {
    console.error("update delivery by id", e.message);
    res.status(500).json({ error: e.message });
  }
};

self.deleteDeliveryById = async (req, res) => {
  try {
    const delivery_id = req.params.delivery_id;

    await supabase
      .from("deliverynotes")
      .update({ invoice_id: null })
      .eq("invoice_id", delivery_id)
      .is("deleted_at", null);

    const update = { deleted_at: new Date().toISOString() };
    const { data: updatedDelivery, error } = await supabase
      .from("deliveries")
      .update(update)
      .eq("id", delivery_id);

    if (error) throw error;
    res.json(updatedDelivery);
  } catch (e) {
    console.error("delete delivery by id", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
