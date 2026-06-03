"use strict";

const self = {};
const supabase = require("./db");
const {
  parseAmount,
  getInvoiceByMovementId,
  getActiveOrderForInvoice,
  getActiveOrderForMovement,
  buildMovementPaymentFields,
  buildMovementPendingRevert,
} = require("../services/supplierInvoiceLifecycle");

const PAYMENT_METHODS = new Set([
  "TRANSFERENCIA",
  "CHEQUE",
  "EFECTIVO",
  "TARJETA DE CREDITO",
  "TARJETA DE DEBITO",
]);

async function generateNextOrderNumber() {
  const { data, error } = await supabase
    .from("payment_orders")
    .select("order_number")
    .order("id", { ascending: false })
    .limit(1);

  if (error) throw error;

  if (!data || data.length === 0) return "OP-0001";

  const match = (data[0].order_number || "").match(/OP-(\d+)$/);
  if (!match) return "OP-0001";

  const next = parseInt(match[1], 10) + 1;
  return `OP-${String(next).padStart(4, "0")}`;
}

self.getNextOrderNumber = async (req, res) => {
  try {
    const number = await generateNextOrderNumber();
    res.json({ number });
  } catch (e) {
    console.error("getNextOrderNumber error:", e.message);
    res.json({ error: e.message });
  }
};

function controlInvoiceDate(inv) {
  return (
    inv.document_date ||
    inv.due_date ||
    inv.created_at?.slice?.(0, 10) ||
    ""
  );
}

// Facturas de Control sin orden de pago.
async function computePendingItems() {
  const { data: orders, error: ordersErr } = await supabase
    .from("payment_orders")
    .select("supplier_invoice_id")
    .is("deleted_at", null);

  if (ordersErr) throw ordersErr;

  const paidInvoiceIds = new Set(
    (orders || []).map((o) => o.supplier_invoice_id).filter((v) => v != null)
  );

  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, fantasy_name, name")
    .is("deleted_at", null);

  if (supErr) throw supErr;

  const supplierById = {};
  (suppliers || []).forEach((s) => {
    supplierById[s.id] = s.fantasy_name || s.name || null;
  });

  const { data: controlInvoices, error: ctrlErr } = await supabase
    .from("supplier_invoices")
    .select("*")
    .is("deleted_at", null);

  if (ctrlErr) throw ctrlErr;

  const controlItems = (controlInvoices || [])
    .filter((inv) => !paidInvoiceIds.has(inv.id) && inv.account_movement_id != null)
    .map((inv) => {
      const total = parseAmount(inv.total ?? inv.amount);
      return {
        key: `control-${inv.id}`,
        source: "control",
        supplier_invoice_id: inv.id,
        cashflow_id: null,
        account_movement_id: inv.account_movement_id || null,
        supplier_id: inv.supplier_id || null,
        supplier_name: supplierById[inv.supplier_id] || null,
        invoice_number: inv.invoice_number || null,
        description: inv.description || null,
        date: controlInvoiceDate(inv),
        amount: parseAmount(inv.amount),
        total,
      };
    });

  return controlItems.sort((a, b) => {
    const c = String(a.date || "").localeCompare(String(b.date || ""));
    if (c !== 0) return c;
    return String(a.key).localeCompare(String(b.key));
  });
}

self.computePendingItems = computePendingItems;

self.getPendingItems = async (req, res) => {
  try {
    const items = await computePendingItems();
    res.json({ data: items });
  } catch (e) {
    console.error("getPendingItems error:", e.message);
    res.json({ error: e.message });
  }
};

self.getPaymentOrders = async (req, res) => {
  try {
    const {
      source_movement_id,
      account_movement_id,
      supplier_invoice_id,
    } = req.query;

    let query = supabase
      .from("payment_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    const movementId = account_movement_id || source_movement_id;
    if (movementId) {
      query = query.eq("account_movement_id", Number(movementId));
    }
    if (supplier_invoice_id) {
      query = query.eq("supplier_invoice_id", Number(supplier_invoice_id));
    }

    const { data, error } = await query;
    if (error) throw error;

    res.json({ data: data || [] });
  } catch (e) {
    console.error("getPaymentOrders error:", e.message);
    res.json({ error: e.message });
  }
};

self.createPaymentOrder = async (req, res) => {
  try {
    const {
      supplier_invoice_id,
      supplier_id,
      payment_method,
      amount,
      description,
      payment_date,
      account_movement_id,
      source_movement_id,
      cheque_number,
      cheque_bank,
      cheque_due_date,
    } = req.body;

    if (req.body.cashflow_id && !supplier_invoice_id) {
      return res.json({
        error: "Las órdenes de pago de facturas solo se crean desde Control",
      });
    }

    const movementId = account_movement_id || source_movement_id;

    if (!supplier_invoice_id) {
      return res.json({ error: "Factura de proveedor requerida" });
    }
    if (!movementId) {
      return res.json({ error: "Movimiento de Control requerido" });
    }
    if (!payment_method || !PAYMENT_METHODS.has(payment_method)) {
      return res.json({ error: "Forma de pago inválida" });
    }
    if (!payment_date) {
      return res.json({ error: "Fecha de pago requerida" });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("supplier_invoices")
      .select("*")
      .eq("id", supplier_invoice_id)
      .is("deleted_at", null)
      .single();

    if (invErr || !invoice) {
      return res.json({ error: "Factura de proveedor no encontrada" });
    }

    if (Number(invoice.account_movement_id) !== Number(movementId)) {
      return res.json({ error: "La factura no corresponde a este movimiento" });
    }

    const invoiceTotal = parseAmount(invoice.total ?? invoice.amount);
    const payAmount = parseAmount(amount);
    if (!payAmount || payAmount <= 0) {
      return res.json({ error: "Monto inválido" });
    }
    if (Math.abs(payAmount - invoiceTotal) > 0.009) {
      return res.json({
        error: "El monto debe coincidir con el total de la factura",
      });
    }

    const existingForInvoice = await getActiveOrderForInvoice(supplier_invoice_id);
    if (existingForInvoice) {
      return res.json({
        error: `Esta factura ya tiene la orden de pago ${existingForInvoice.order_number}`,
      });
    }

    const { data: movement, error: movFetchErr } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (movFetchErr || !movement) {
      return res.json({ error: "Movimiento no encontrado" });
    }

    const isCheque = payment_method === "CHEQUE";
    if (isCheque && (!cheque_number || !cheque_bank || !cheque_due_date)) {
      return res.json({
        error:
          "Para pagos con cheque indicá número, banco y fecha de vencimiento",
      });
    }

    const order_number = await generateNextOrderNumber();

    let supplierName = "";
    const resolvedSupplierId = supplier_id || invoice.supplier_id;
    if (resolvedSupplierId) {
      const { data: sup } = await supabase
        .from("suppliers")
        .select("fantasy_name, name")
        .eq("id", resolvedSupplierId)
        .single();
      if (sup) supplierName = sup.fantasy_name || sup.name || "";
    }

    let paycheckId = movement.paycheck_id || null;

    if (isCheque) {
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({
            number: cheque_number,
            bank: cheque_bank,
            amount: payAmount,
            due_date: cheque_due_date,
            deleted_at: null,
          })
          .eq("id", paycheckId);
      } else {
        const { data: newPaycheck, error: paycheckError } = await supabase
          .from("paychecks")
          .insert({
            number: cheque_number,
            bank: cheque_bank,
            amount: payAmount,
            due_date: cheque_due_date,
            type: "OUT",
            movement_id: movementId,
          })
          .select();

        if (paycheckError) throw paycheckError;
        if (newPaycheck?.length) paycheckId = newPaycheck[0].id;
      }
    } else if (paycheckId) {
      await supabase
        .from("paychecks")
        .update({ deleted_at: new Date() })
        .eq("id", paycheckId);
      paycheckId = null;
    }

    const paymentFields = buildMovementPaymentFields({
      payment_method,
      payment_date,
      amount: payAmount,
      cheque_number,
      cheque_bank,
      cheque_due_date,
    });

    const { data: updatedMovement, error: movUpdateErr } = await supabase
      .from("account_movements")
      .update({
        ...paymentFields,
        paycheck_id: paycheckId,
      })
      .eq("id", movementId)
      .select();

    if (movUpdateErr) throw movUpdateErr;

    if (paycheckId) {
      await supabase
        .from("paychecks")
        .update({ movement_id: movementId })
        .eq("id", paycheckId);
    }

    const { data: newOrder, error: orderErr } = await supabase
      .from("payment_orders")
      .insert({
        order_number,
        supplier_invoice_id,
        cashflow_id: null,
        supplier_id: resolvedSupplierId || null,
        payment_method,
        amount: payAmount,
        description: description || null,
        payment_date,
        source_movement_id: null,
        account_movement_id: movementId,
        cheque_number: isCheque ? cheque_number : null,
        cheque_bank: isCheque ? cheque_bank : null,
        cheque_due_date: isCheque ? cheque_due_date : null,
      })
      .select();

    if (orderErr) throw orderErr;

    res.json({ data: newOrder[0], movement: updatedMovement?.[0] || null });
  } catch (e) {
    console.error("createPaymentOrder error:", e.message);
    res.json({ error: e.message });
  }
};

self.cancelPaymentOrder = async (req, res) => {
  try {
    const orderId = req.params.id;

    const { data: order, error: orderErr } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("id", orderId)
      .is("deleted_at", null)
      .single();

    if (orderErr || !order) {
      return res.json({ error: "Orden de pago no encontrada" });
    }

    const movementId = order.account_movement_id;
    if (!movementId) {
      return res.json({ error: "Orden de pago sin movimiento asociado" });
    }

    const { data: movement, error: movErr } = await supabase
      .from("account_movements")
      .select("*")
      .eq("id", movementId)
      .is("deleted_at", null)
      .single();

    if (movErr || !movement) {
      return res.json({ error: "Movimiento asociado no encontrado" });
    }

    let invoice = null;
    if (order.supplier_invoice_id) {
      const { data: inv, error: invErr } = await supabase
        .from("supplier_invoices")
        .select("*")
        .eq("id", order.supplier_invoice_id)
        .is("deleted_at", null)
        .single();
      if (invErr) throw invErr;
      invoice = inv;
    } else {
      invoice = await getInvoiceByMovementId(movementId);
    }

    const documentDate =
      invoice?.document_date ||
      invoice?.due_date ||
      movement.date;

    if (movement.paycheck_id) {
      await supabase
        .from("paychecks")
        .update({ deleted_at: new Date() })
        .eq("id", movement.paycheck_id);
    }

    const revertFields = buildMovementPendingRevert(documentDate);

    const { data: updatedMovement, error: updateErr } = await supabase
      .from("account_movements")
      .update(revertFields)
      .eq("id", movementId)
      .select();

    if (updateErr) throw updateErr;

    const { error: deleteOrderErr } = await supabase
      .from("payment_orders")
      .update({ deleted_at: new Date() })
      .eq("id", orderId);

    if (deleteOrderErr) throw deleteOrderErr;

    res.json({
      success: true,
      order_id: orderId,
      movement: updatedMovement?.[0] || null,
    });
  } catch (e) {
    console.error("cancelPaymentOrder error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
