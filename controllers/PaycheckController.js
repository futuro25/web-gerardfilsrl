"use strict";

const self = {};
const supabase = require("./db");
const sendEmail = require("../utils/emails");
const { DateTime } = require("luxon");

const _ = require("lodash");

// Resuelve el proveedor (y nº de orden) de cada cheque a partir del movimiento
// de Control vinculado (movement_id): puede provenir de una orden de pago o de
// una factura de proveedor cargada directamente en Control.
async function attachPaycheckSupplier(paychecks) {
  const movementIds = [
    ...new Set(
      (paychecks || []).map((p) => p.movement_id).filter((v) => v != null)
    ),
  ];
  if (movementIds.length === 0) return paychecks || [];

  const [{ data: orders }, { data: invoices }] = await Promise.all([
    supabase
      .from("payment_orders")
      .select("account_movement_id, supplier_id, order_number")
      .in("account_movement_id", movementIds)
      .is("deleted_at", null),
    supabase
      .from("supplier_invoices")
      .select("account_movement_id, supplier_id")
      .in("account_movement_id", movementIds)
      .is("deleted_at", null),
  ]);

  const orderByMovement = {};
  (orders || []).forEach((o) => {
    if (o.account_movement_id != null)
      orderByMovement[o.account_movement_id] = o;
  });
  const invoiceByMovement = {};
  (invoices || []).forEach((inv) => {
    if (inv.account_movement_id != null && !invoiceByMovement[inv.account_movement_id])
      invoiceByMovement[inv.account_movement_id] = inv;
  });

  const supplierIds = [
    ...new Set(
      [...(orders || []), ...(invoices || [])]
        .map((r) => r.supplier_id)
        .filter((v) => v != null)
    ),
  ];

  const supplierById = {};
  if (supplierIds.length) {
    const { data: suppliers } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .in("id", supplierIds);
    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s.fantasy_name || s.name || null;
    });
  }

  return (paychecks || []).map((p) => {
    const order = p.movement_id != null ? orderByMovement[p.movement_id] : null;
    const invoice =
      p.movement_id != null ? invoiceByMovement[p.movement_id] : null;
    const supplierId = order?.supplier_id ?? invoice?.supplier_id ?? null;
    return {
      ...p,
      supplier_id: supplierId,
      supplier_name: supplierId != null ? supplierById[supplierId] || null : null,
      order_number: order?.order_number || null,
    };
  });
}

self.getPaychecks = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("paychecks")
      .select("*")
      .is("deleted_at", null);

    if (error) throw error;

    const enriched = await attachPaycheckSupplier(data || []);

    res.json(enriched);
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

self.getPaychecksForNextWeek = async (req, res) => {
  try {
    const yesterday = DateTime.now().minus({ days: 1 }).toISO();
    const in15Days = DateTime.now().plus({ days: 15 }).toISO();

    const { data, error } = await supabase
      .from("paychecks")
      .select("*")
      .gt("due_date", yesterday)
      .lt("due_date", in15Days)
      .is("deleted_at", null);

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

module.exports = self;
