"use strict";

const self = {};
const supabase = require("./db");
const sendEmail = require("../utils/emails");
const { DateTime } = require("luxon");

const _ = require("lodash");

// Resuelve el proveedor (y nº de orden) de cada cheque a partir del movimiento
// de Control vinculado (movement_id): puede provenir de una orden de pago o de
// una factura de proveedor cargada directamente en Control. Los cheques cargados
// desde Cashflow se vinculan por cashflow_id y toman el proveedor del egreso (o
// el cliente, si es un ingreso). Cuando no hay proveedor ni cliente, el listado
// muestra el concepto (descripción del movimiento) y su comprobante adjunto.
async function attachPaycheckSupplier(paychecks) {
  if (!paychecks?.length) return paychecks || [];

  const movementIds = [
    ...new Set(
      paychecks.map((p) => p.movement_id).filter((v) => v != null)
    ),
  ];
  const cashflowIds = [
    ...new Set(
      paychecks.map((p) => p.cashflow_id).filter((v) => v != null)
    ),
  ];
  const paycheckIds = paychecks.map((p) => p.id);

  const [
    { data: orders },
    { data: invoices },
    { data: movementsByPaycheck },
    { data: movementsById },
    { data: cashflows },
  ] = await Promise.all([
    movementIds.length
      ? supabase
          .from("payment_orders")
          .select("account_movement_id, supplier_id, order_number")
          .in("account_movement_id", movementIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    movementIds.length
      ? supabase
          .from("supplier_invoices")
          .select("account_movement_id, supplier_id")
          .in("account_movement_id", movementIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    supabase
      .from("account_movements")
      .select("id, paycheck_id, supplier_id, description, image_key")
      .in("paycheck_id", paycheckIds)
      .is("deleted_at", null),
    movementIds.length
      ? supabase
          .from("account_movements")
          .select("id, description, image_key")
          .in("id", movementIds)
          .is("deleted_at", null)
      : Promise.resolve({ data: [] }),
    cashflowIds.length
      ? supabase
          .from("cashflow")
          .select("id, type, provider, description")
          .in("id", cashflowIds)
      : Promise.resolve({ data: [] }),
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
  const movementByPaycheckId = {};
  (movementsByPaycheck || []).forEach((m) => {
    if (m.paycheck_id != null && !movementByPaycheckId[m.paycheck_id])
      movementByPaycheckId[m.paycheck_id] = m;
  });
  const movementById = {};
  (movementsById || []).forEach((m) => {
    movementById[m.id] = m;
  });
  const cashflowById = {};
  (cashflows || []).forEach((c) => {
    cashflowById[c.id] = c;
  });

  // En Cashflow, provider es un proveedor solo en los egresos (en los ingresos
  // es un cliente).
  const cashflowSupplierById = {};
  const cashflowClientById = {};
  (cashflows || []).forEach((c) => {
    const providerId = parseInt(c.provider, 10);
    if (Number.isNaN(providerId)) return;
    if (c.type === "EGRESO") cashflowSupplierById[c.id] = providerId;
    else cashflowClientById[c.id] = providerId;
  });

  const supplierIds = [
    ...new Set(
      [...(orders || []), ...(invoices || []), ...(movementsByPaycheck || [])]
        .map((r) => r.supplier_id)
        .concat(Object.values(cashflowSupplierById))
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

  const clientIds = [...new Set(Object.values(cashflowClientById))];
  const clientById = {};
  if (clientIds.length) {
    const { data: clients } = await supabase
      .from("clients")
      .select("id, fantasy_name, name")
      .in("id", clientIds);
    (clients || []).forEach((c) => {
      clientById[c.id] = c.fantasy_name || c.name || null;
    });
  }

  return paychecks.map((p) => {
    const linkedMovement = movementByPaycheckId[p.id] || null;
    const movementId = p.movement_id ?? linkedMovement?.id ?? null;
    const movement =
      (p.movement_id != null ? movementById[p.movement_id] : null) ||
      linkedMovement;
    const cashflow = p.cashflow_id != null ? cashflowById[p.cashflow_id] : null;
    const clientId =
      p.cashflow_id != null ? cashflowClientById[p.cashflow_id] ?? null : null;
    const order = movementId != null ? orderByMovement[movementId] : null;
    const invoice = movementId != null ? invoiceByMovement[movementId] : null;
    const supplierId =
      order?.supplier_id ??
      invoice?.supplier_id ??
      linkedMovement?.supplier_id ??
      (p.cashflow_id != null ? cashflowSupplierById[p.cashflow_id] : null) ??
      null;
    return {
      ...p,
      supplier_id: supplierId,
      supplier_name: supplierId != null ? supplierById[supplierId] || null : null,
      order_number: order?.order_number || null,
      client_name: clientId != null ? clientById[clientId] || null : null,
      concept: movement?.description || cashflow?.description || null,
      attachment_key: movement?.image_key || null,
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
      cashflow_id: req.body.cashflow_id || null,
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
module.exports.attachPaycheckSupplier = attachPaycheckSupplier;
