"use strict";

const self = {};
const supabase = require("./db");
const {
  parseAmount,
  getActiveOrdersForInvoice,
  getInvoicePaymentSummary,
  getRetentionAmountsByInvoiceIds,
  sumOrderAmounts,
  invoiceTotal,
  isInvoiceFullyPaid,
} = require("../services/invoicePaymentSummary");
const {
  getInvoiceByMovementId,
  getActiveOrderForMovement,
  buildMovementPaymentFields,
  buildMovementPendingRevert,
} = require("../services/supplierInvoiceLifecycle");

const PAYMENT_METHODS = new Set([
  "TRANSFERENCIA",
  "CHEQUE",
  "EFECTIVO",
  "TARJETA DE CREDITO",
  "DEBITO AUTOMATICO",
  "NOTA DE CREDITO",
]);

async function findPaycheckIdForOrder(order) {
  if (!order || order.payment_method !== "CHEQUE") return null;
  if (order.paycheck_id) return order.paycheck_id;

  if (
    !order.account_movement_id ||
    !order.cheque_number ||
    !order.cheque_bank ||
    !order.cheque_due_date
  ) {
    return null;
  }

  const { data: candidates, error } = await supabase
    .from("paychecks")
    .select("id, amount")
    .eq("movement_id", order.account_movement_id)
    .eq("number", order.cheque_number)
    .eq("bank", order.cheque_bank)
    .eq("due_date", order.cheque_due_date)
    .eq("type", "OUT")
    .is("deleted_at", null);

  if (error) throw error;
  if (!candidates?.length) return null;

  const orderAmount = parseAmount(order.amount);
  const match = candidates.find(
    (p) => Math.abs(parseAmount(p.amount) - orderAmount) < 0.01
  );
  return match?.id ?? candidates[0]?.id ?? null;
}

async function softDeletePaycheck(paycheckId) {
  if (!paycheckId) return;
  await supabase
    .from("paychecks")
    .update({ deleted_at: new Date() })
    .eq("id", paycheckId)
    .is("deleted_at", null);
}

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
  return inv.document_date || inv.created_at?.slice?.(0, 10) || "";
}

// Facturas de Control con saldo pendiente (total − pagos con OP).
async function computePendingItems() {
  const { data: orders, error: ordersErr } = await supabase
    .from("payment_orders")
    .select("supplier_invoice_id, amount")
    .is("deleted_at", null);

  if (ordersErr) throw ordersErr;

  const paidByInvoiceId = {};
  (orders || []).forEach((o) => {
    if (o.supplier_invoice_id == null) return;
    paidByInvoiceId[o.supplier_invoice_id] =
      (paidByInvoiceId[o.supplier_invoice_id] || 0) + parseAmount(o.amount);
  });

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

  const invoiceIds = (controlInvoices || [])
    .filter((inv) => inv.account_movement_id != null)
    .map((inv) => inv.id);
  const retentionByInvoiceId = await getRetentionAmountsByInvoiceIds(invoiceIds);

  const controlItems = (controlInvoices || [])
    .filter((inv) => {
      if (inv.account_movement_id == null) return false;
      const paid = paidByInvoiceId[inv.id] || 0;
      const retention = retentionByInvoiceId[inv.id] || 0;
      return !isInvoiceFullyPaid(inv, paid, retention);
    })
    .map((inv) => {
      const total = invoiceTotal(inv);
      const paidAmount = paidByInvoiceId[inv.id] || 0;
      const retentionAmount = retentionByInvoiceId[inv.id] || 0;
      const remainingAmount = Math.max(0, total - paidAmount - retentionAmount);
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
        paid_amount: paidAmount,
        retention_amount: retentionAmount,
        remaining_amount: remainingAmount,
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

    if (supplier_invoice_id) {
      const { data, error } = await supabase
        .from("payment_orders")
        .select("*")
        .eq("supplier_invoice_id", Number(supplier_invoice_id))
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return res.json({ data: data || [] });
    }

    const movementId = account_movement_id || source_movement_id;
    if (!movementId) {
      return res.json({ data: [] });
    }

    const mid = Number(movementId);
    const { data: invoices, error: invErr } = await supabase
      .from("supplier_invoices")
      .select("id")
      .eq("account_movement_id", mid)
      .is("deleted_at", null);
    if (invErr) throw invErr;

    const invoiceIds = (invoices || []).map((i) => i.id);
    const orClauses = [
      `account_movement_id.eq.${mid}`,
      `source_movement_id.eq.${mid}`,
    ];
    if (invoiceIds.length) {
      orClauses.push(`supplier_invoice_id.in.(${invoiceIds.join(",")})`);
    }

    const { data, error } = await supabase
      .from("payment_orders")
      .select("*")
      .is("deleted_at", null)
      .or(orClauses.join(","))
      .order("created_at", { ascending: false });
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
      credit_note_number,
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

    const invoiceTotalAmount = invoiceTotal(invoice);
    const payAmount = parseAmount(amount);
    if (!payAmount || payAmount <= 0) {
      return res.json({ error: "Monto inválido" });
    }

    const existingOrders = await getActiveOrdersForInvoice(supplier_invoice_id);
    const paidSoFar = sumOrderAmounts(existingOrders);
    const retentionById = await getRetentionAmountsByInvoiceIds([
      supplier_invoice_id,
    ]);
    const retentionAmount = retentionById[supplier_invoice_id] || 0;
    const remainingBefore = Math.max(
      0,
      invoiceTotalAmount - paidSoFar - retentionAmount
    );
    if (payAmount > remainingBefore + 0.009) {
      return res.json({
        error: `El monto supera el saldo pendiente (${remainingBefore.toFixed(2)})`,
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

    const documentDate =
      invoice.document_date ||
      movement.date;

    const paidAfter = paidSoFar + payAmount;
    const fullyPaid = isInvoiceFullyPaid(invoice, paidAfter, retentionAmount);

    let movementUpdate;
    if (fullyPaid) {
      const paymentFields = buildMovementPaymentFields({
        payment_method,
        amount: invoiceTotalAmount,
        cheque_number,
        cheque_bank,
        cheque_due_date,
      });
      movementUpdate = {
        ...paymentFields,
        date: documentDate,
        paycheck_id: isCheque ? paycheckId : null,
      };
    } else {
      movementUpdate = {
        ...buildMovementPendingRevert(documentDate),
        paycheck_id: null,
      };
    }

    const { data: updatedMovement, error: movUpdateErr } = await supabase
      .from("account_movements")
      .update(movementUpdate)
      .eq("id", movementId)
      .select();

    if (movUpdateErr) throw movUpdateErr;

    if (fullyPaid && paycheckId && isCheque) {
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
        credit_note_number:
          payment_method === "NOTA DE CREDITO"
            ? credit_note_number?.trim() || null
            : null,
        paycheck_id: isCheque ? paycheckId : null,
      })
      .select();

    if (orderErr) throw orderErr;

    res.json({
      data: newOrder[0],
      movement: updatedMovement?.[0] || null,
      fully_paid: fullyPaid,
      remaining_amount: Math.max(
        0,
        invoiceTotalAmount - paidAfter - retentionAmount
      ),
    });
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
      movement.date;

    const cancelledPaycheckId = await findPaycheckIdForOrder(order);
    if (cancelledPaycheckId) {
      await softDeletePaycheck(cancelledPaycheckId);
    }

    const { error: deleteOrderErr } = await supabase
      .from("payment_orders")
      .update({ deleted_at: new Date() })
      .eq("id", orderId);

    if (deleteOrderErr) throw deleteOrderErr;

    const remainingOrders = invoice
      ? await getActiveOrdersForInvoice(invoice.id)
      : [];
    const paidRemaining = sumOrderAmounts(remainingOrders);
    const retentionById = invoice
      ? await getRetentionAmountsByInvoiceIds([invoice.id])
      : {};
    const retentionAmount = invoice ? retentionById[invoice.id] || 0 : 0;

    let movementUpdate;
    if (invoice && isInvoiceFullyPaid(invoice, paidRemaining, retentionAmount)) {
      const latest = remainingOrders[remainingOrders.length - 1];
      movementUpdate = buildMovementPaymentFields({
        payment_method: latest.payment_method,
        amount: invoiceTotal(invoice),
        cheque_number: latest.cheque_number,
        cheque_bank: latest.cheque_bank,
        cheque_due_date: latest.cheque_due_date,
      });
      const latestPaycheckId =
        latest.payment_method === "CHEQUE"
          ? await findPaycheckIdForOrder(latest)
          : null;
      movementUpdate = {
        ...movementUpdate,
        date: documentDate,
        paycheck_id: latestPaycheckId,
      };
    } else {
      movementUpdate = buildMovementPendingRevert(documentDate);
    }

    const { data: updatedMovement, error: updateErr } = await supabase
      .from("account_movements")
      .update(movementUpdate)
      .eq("id", movementId)
      .select();

    if (updateErr) throw updateErr;

    res.json({
      success: true,
      order_id: orderId,
      movement: updatedMovement?.[0] || null,
      fully_paid: invoice
        ? isInvoiceFullyPaid(invoice, paidRemaining, retentionAmount)
        : false,
      remaining_amount: invoice
        ? Math.max(0, invoiceTotal(invoice) - paidRemaining - retentionAmount)
        : null,
    });
  } catch (e) {
    console.error("cancelPaymentOrder error:", e.message);
    res.json({ error: e.message });
  }
};

self.updatePaymentOrder = async (req, res) => {
  try {
    const orderId = req.params.id;
    const payment_date = req.body.payment_date;

    if (!payment_date) {
      return res.json({ error: "Ingrese la fecha de pago" });
    }

    const { data: order, error: orderErr } = await supabase
      .from("payment_orders")
      .select("*")
      .eq("id", orderId)
      .is("deleted_at", null)
      .single();

    if (orderErr || !order) {
      return res.json({ error: "Orden de pago no encontrada" });
    }

    const isCheque = order.payment_method === "CHEQUE";
    const orderUpdate = {
      payment_date,
      ...(isCheque ? { cheque_due_date: payment_date } : {}),
    };

    const { data: updatedOrder, error: updateErr } = await supabase
      .from("payment_orders")
      .update(orderUpdate)
      .eq("id", orderId)
      .select();

    if (updateErr) throw updateErr;

    if (isCheque && order.account_movement_id) {
      const paycheckId = await findPaycheckIdForOrder(order);
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({ due_date: payment_date })
          .eq("id", paycheckId)
          .is("deleted_at", null);
      }
    }

    res.json({ data: updatedOrder?.[0] || null });
  } catch (e) {
    console.error("updatePaymentOrder error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
