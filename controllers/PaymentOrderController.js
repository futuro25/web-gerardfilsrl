"use strict";

const self = {};
const supabase = require("./db");

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

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function controlInvoiceDate(inv) {
  return inv.due_date || inv.created_at?.slice?.(0, 10) || "";
}

// Devuelve todas las facturas (Control + Cashflow) que no tienen orden de pago.
async function computePendingItems() {
  {
    // Órdenes de pago existentes para excluir lo ya pagado
    const { data: orders, error: ordersErr } = await supabase
      .from("payment_orders")
      .select("supplier_invoice_id, cashflow_id, account_movement_id")
      .is("deleted_at", null);

    if (ordersErr) throw ordersErr;

    const paidInvoiceIds = new Set(
      (orders || []).map((o) => o.supplier_invoice_id).filter((v) => v != null)
    );
    const paidCashflowIds = new Set(
      (orders || []).map((o) => o.cashflow_id).filter((v) => v != null)
    );
    // Movimientos de conciliación de órdenes de pago: las facturas colgadas de
    // ellos no son compras reales y no deben figurar como pendientes.
    const conciliationMovementIds = new Set(
      (orders || []).map((o) => o.account_movement_id).filter((v) => v != null)
    );

    // Proveedores (para resolver nombres)
    const { data: suppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .is("deleted_at", null);

    if (supErr) throw supErr;

    const supplierById = {};
    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s.fantasy_name || s.name || null;
    });

    // ── Facturas de Control (supplier_invoices) ──
    const { data: controlInvoices, error: ctrlErr } = await supabase
      .from("supplier_invoices")
      .select("*")
      .is("deleted_at", null);

    if (ctrlErr) throw ctrlErr;

    const controlItems = (controlInvoices || [])
      .filter(
        (inv) =>
          !paidInvoiceIds.has(inv.id) &&
          !conciliationMovementIds.has(inv.account_movement_id)
      )
      .map((inv) => {
        const total = parseAmount(inv.total ?? inv.amount);
        return {
          key: `control-${inv.id}`,
          source: "control",
          supplier_invoice_id: inv.id,
          cashflow_id: null,
          source_movement_id: inv.account_movement_id || null,
          supplier_id: inv.supplier_id || null,
          supplier_name: supplierById[inv.supplier_id] || null,
          invoice_number: inv.invoice_number || null,
          description: inv.description || null,
          date: controlInvoiceDate(inv),
          amount: parseAmount(inv.amount),
          total,
        };
      });

    // ── Facturas de Cashflow (EGRESO con referencia) ──
    const { data: cashflowRows, error: cfErr } = await supabase
      .from("cashflow")
      .select("id, type, amount, net_amount, date, description, reference, provider")
      .is("deleted_at", null)
      .eq("type", "EGRESO")
      .not("reference", "is", null);

    if (cfErr) throw cfErr;

    const cashflowItems = (cashflowRows || [])
      .filter((cf) => {
        if (paidCashflowIds.has(cf.id)) return false;
        const ref = cf.reference ? String(cf.reference).trim() : "";
        return ref.length > 0;
      })
      .map((cf) => {
        const total = Math.abs(parseAmount(cf.amount));
        const net = cf.net_amount != null ? Math.abs(parseAmount(cf.net_amount)) : total;
        return {
          key: `cashflow-${cf.id}`,
          source: "cashflow",
          supplier_invoice_id: null,
          cashflow_id: cf.id,
          source_movement_id: null,
          supplier_id: cf.provider || null,
          supplier_name: supplierById[cf.provider] || null,
          invoice_number: cf.reference ? String(cf.reference).trim() : null,
          description: cf.description || null,
          date: cf.date || "",
          amount: net,
          total,
        };
      });

    // Unir y ordenar por fecha ascendente (más antiguas primero)
    const items = [...controlItems, ...cashflowItems].sort((a, b) => {
      const c = String(a.date || "").localeCompare(String(b.date || ""));
      if (c !== 0) return c;
      return String(a.key).localeCompare(String(b.key));
    });

    return items;
  }
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
    const { source_movement_id, supplier_invoice_id } = req.query;

    let query = supabase
      .from("payment_orders")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (source_movement_id) {
      query = query.eq("source_movement_id", Number(source_movement_id));
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
      cashflow_id,
      supplier_id,
      payment_method,
      amount,
      description,
      payment_date,
      source_movement_id,
      cheque_number,
      cheque_bank,
      cheque_due_date,
    } = req.body;

    if (!payment_method || !PAYMENT_METHODS.has(payment_method)) {
      return res.json({ error: "Forma de pago inválida" });
    }
    if (!payment_date) {
      return res.json({ error: "Fecha de pago requerida" });
    }
    if (!amount || parseFloat(amount) <= 0) {
      return res.json({ error: "Monto inválido" });
    }

    const isCheque = payment_method === "CHEQUE";
    if (isCheque && (!cheque_number || !cheque_bank || !cheque_due_date)) {
      return res.json({
        error:
          "Para pagos con cheque indicá número, banco y fecha de vencimiento",
      });
    }

    const order_number = await generateNextOrderNumber();

    // Fetch supplier name for the movement description
    let supplierName = "";
    if (supplier_id) {
      const { data: sup } = await supabase
        .from("suppliers")
        .select("fantasy_name, name")
        .eq("id", supplier_id)
        .single();
      if (sup) supplierName = sup.fantasy_name || sup.name || "";
    }

    const movDescription =
      description ||
      [
        `Orden de Pago ${order_number}`,
        supplierName ? `- ${supplierName}` : null,
      ]
        .filter(Boolean)
        .join(" ");

    // Para cheques, el movimiento se ordena por la fecha de vencimiento.
    const movementDate = isCheque ? cheque_due_date : payment_date;

    // Si es cheque (egreso), también registramos el cheque en "paychecks".
    let paycheckId = null;
    if (isCheque) {
      const { data: newPaycheck, error: paycheckError } = await supabase
        .from("paychecks")
        .insert({
          number: cheque_number,
          bank: cheque_bank,
          amount: parseFloat(amount),
          due_date: cheque_due_date,
          type: "OUT",
        })
        .select();

      if (paycheckError) throw paycheckError;
      if (newPaycheck?.length) paycheckId = newPaycheck[0].id;
    }

    // Create the conciliation movement in account_movements
    const { data: newMovement, error: movErr } = await supabase
      .from("account_movements")
      .insert({
        type: "EGRESO",
        responsible: "Sin especificar",
        movement_kind: "UNICA VEZ",
        date: movementDate,
        amount: parseFloat(amount),
        description: movDescription,
        is_cheque: isCheque,
        cheque_number: isCheque ? cheque_number : null,
        cheque_bank: isCheque ? cheque_bank : null,
        cheque_due_date: isCheque ? cheque_due_date : null,
        paycheck_id: paycheckId,
      })
      .select();

    if (movErr) {
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", paycheckId);
      }
      throw movErr;
    }

    const movementId = newMovement[0].id;

    // Vincular el cheque al movimiento de conciliación (relación bidireccional)
    if (paycheckId) {
      await supabase
        .from("paychecks")
        .update({ movement_id: movementId })
        .eq("id", paycheckId);
    }

    // Create the payment order
    const { data: newOrder, error: orderErr } = await supabase
      .from("payment_orders")
      .insert({
        order_number,
        supplier_invoice_id: supplier_invoice_id || null,
        cashflow_id: cashflow_id || null,
        supplier_id: supplier_id || null,
        payment_method,
        amount: parseFloat(amount),
        description: description || null,
        payment_date,
        source_movement_id: source_movement_id || null,
        account_movement_id: movementId,
        cheque_number: isCheque ? cheque_number : null,
        cheque_bank: isCheque ? cheque_bank : null,
        cheque_due_date: isCheque ? cheque_due_date : null,
      })
      .select();

    if (orderErr) {
      // Rollback the movement and paycheck
      await supabase
        .from("account_movements")
        .update({ deleted_at: new Date() })
        .eq("id", movementId);
      if (paycheckId) {
        await supabase
          .from("paychecks")
          .update({ deleted_at: new Date() })
          .eq("id", paycheckId);
      }
      throw orderErr;
    }

    res.json({ data: newOrder[0], movement: newMovement[0] });
  } catch (e) {
    console.error("createPaymentOrder error:", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
