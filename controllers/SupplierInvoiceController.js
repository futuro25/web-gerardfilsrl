"use strict";

const supabase = require("./db");

const self = {};

const {
  getActiveOrderForInvoice,
  syncPendingMovementFromInvoice,
  syncMovementDocumentDateFromInvoice,
} = require("../services/supplierInvoiceLifecycle");
const {
  getPaidAmountsByInvoiceIds,
  getOrdersGroupedByInvoiceIds,
  getRetentionAmountsByInvoiceIds,
  buildPaymentSummary,
} = require("../services/invoicePaymentSummary");
const {
  findDuplicateSupplierInvoice,
  assertNoDuplicateSupplierInvoice,
} = require("../services/supplierInvoiceDuplicate");

async function fetchTaxesBySupplierInvoiceIds(supplierInvoiceIds) {
  if (!supplierInvoiceIds.length) return {};
  const { data, error } = await supabase
    .from("taxes")
    .select("id, supplier_invoice_id, name, amount")
    .in("supplier_invoice_id", supplierInvoiceIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.supplier_invoice_id]) map[t.supplier_invoice_id] = [];
    map[t.supplier_invoice_id].push({
      id: t.id,
      name: t.name,
      amount: t.amount,
    });
  });
  return map;
}

async function attachTaxes(rows) {
  if (!rows?.length) return rows || [];
  const taxesMap = await fetchTaxesBySupplierInvoiceIds(rows.map((r) => r.id));
  return rows.map((row) => ({
    ...row,
    taxes: taxesMap[row.id] || [],
  }));
}

self.getSupplierInvoices = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select(
        `
        *,
        supplier:suppliers (id, fantasy_name, name)
      `
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (error) throw error;

    const rows = data || [];
    const ids = rows.map((r) => r.id);

    let paidByInvoiceId = {};
    let ordersByInvoiceId = {};
    let retentionByInvoiceId = {};
    if (ids.length) {
      paidByInvoiceId = await getPaidAmountsByInvoiceIds(ids);
      ordersByInvoiceId = await getOrdersGroupedByInvoiceIds(ids);
      retentionByInvoiceId = await getRetentionAmountsByInvoiceIds(ids);
    }

    const withTaxes = await attachTaxes(rows);
    const result = withTaxes.map((r) => {
      const orders = ordersByInvoiceId[r.id] || [];
      const summary = buildPaymentSummary(
        r,
        orders,
        retentionByInvoiceId[r.id] || 0
      );
      return {
        ...r,
        has_payment_order: summary.orderCount > 0,
        invoice_fully_paid: summary.fullyPaid,
        invoice_paid_amount: summary.paidAmount,
        invoice_retention_amount: summary.retentionAmount,
        invoice_settled_amount: summary.settledAmount,
        invoice_remaining_amount: summary.remainingAmount,
        payment_orders: summary.orders,
      };
    });
    res.json({ data: result });
  } catch (e) {
    console.error("getSupplierInvoices error:", e.message);
    res.json({ error: e.message });
  }
};

async function fetchTaxesByCashflowIds(cashflowIds) {
  if (!cashflowIds.length) return {};
  const { data, error } = await supabase
    .from("taxes")
    .select("id, invoice_id, name, amount")
    .in("invoice_id", cashflowIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.invoice_id]) map[t.invoice_id] = [];
    map[t.invoice_id].push({ id: t.id, name: t.name, amount: t.amount });
  });
  return map;
}

function parseNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

// Listado unificado y paginado de TODAS las facturas de compra:
// supplier_invoices (Control) + cashflow (EGRESO con referencia).
self.getPurchaseInvoices = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(
      Math.max(parseInt(req.query.limit, 10) || 25, 1),
      200
    );
    const search = String(req.query.search || "").trim().toLowerCase();
    const status = String(req.query.status || ""); // "", "con", "sin"
    const supplierId = req.query.supplier_id
      ? String(req.query.supplier_id)
      : "";
    const sourceFilter = String(req.query.source || ""); // "", "control", "cashflow"
    const dateFrom = req.query.date_from || "";
    const dateTo = req.query.date_to || "";

    // Órdenes de pago (para has_payment_order + detalle)
    const { data: orders, error: ordersErr } = await supabase
      .from("payment_orders")
      .select(
        "supplier_invoice_id, cashflow_id, account_movement_id, order_number, payment_method, amount, payment_date, cheque_number, cheque_bank, cheque_due_date"
      )
      .is("deleted_at", null);
    if (ordersErr) throw ordersErr;

    const ordersByInvoiceId = {};
    const ordersByCashflowId = {};
    (orders || []).forEach((o) => {
      if (o.supplier_invoice_id != null) {
        if (!ordersByInvoiceId[o.supplier_invoice_id]) {
          ordersByInvoiceId[o.supplier_invoice_id] = [];
        }
        ordersByInvoiceId[o.supplier_invoice_id].push(o);
      }
      if (o.cashflow_id != null) {
        if (!ordersByCashflowId[o.cashflow_id]) {
          ordersByCashflowId[o.cashflow_id] = [];
        }
        ordersByCashflowId[o.cashflow_id].push(o);
      }
    });

    // Proveedores (nombres)
    const { data: suppliers, error: supErr } = await supabase
      .from("suppliers")
      .select("id, fantasy_name, name")
      .is("deleted_at", null);
    if (supErr) throw supErr;
    const supplierById = {};
    (suppliers || []).forEach((s) => {
      supplierById[s.id] = s;
    });

    // Control
    const { data: controlRows, error: ctrlErr } = await supabase
      .from("supplier_invoices")
      .select("*")
      .is("deleted_at", null);
    if (ctrlErr) throw ctrlErr;

    // Cashflow (EGRESO con referencia)
    const { data: cashflowRows, error: cfErr } = await supabase
      .from("cashflow")
      .select(
        "id, type, amount, net_amount, date, description, reference, provider, payment_method"
      )
      .is("deleted_at", null)
      .eq("type", "EGRESO")
      .not("reference", "is", null);
    if (cfErr) throw cfErr;

    const taxesByInvoice = await fetchTaxesBySupplierInvoiceIds(
      (controlRows || []).map((r) => r.id)
    );
    const taxesByCashflow = await fetchTaxesByCashflowIds(
      (cashflowRows || []).map((r) => r.id)
    );
    const retentionByInvoiceId = await getRetentionAmountsByInvoiceIds(
      (controlRows || []).map((r) => r.id)
    );

    const orderSummary = (o) =>
      o
        ? {
            order_number: o.order_number,
            payment_method: o.payment_method,
            amount: o.amount,
            payment_date: o.payment_date,
            cheque_number: o.cheque_number,
            cheque_bank: o.cheque_bank,
            cheque_due_date: o.cheque_due_date,
          }
        : null;

    const controlItems = (controlRows || []).map((inv) => {
      const sup = supplierById[inv.supplier_id];
      const invOrders = ordersByInvoiceId[inv.id] || [];
      const order = invOrders[invOrders.length - 1] || null;
      const summary = buildPaymentSummary(
        inv,
        invOrders,
        retentionByInvoiceId[inv.id] || 0
      );
      return {
        key: `control-${inv.id}`,
        source: "control",
        supplier_invoice_id: inv.id,
        cashflow_id: null,
        source_movement_id: inv.account_movement_id || null,
        supplier_id: inv.supplier_id || null,
        supplier_name: sup ? sup.fantasy_name || sup.name || null : null,
        supplier: sup
          ? { id: sup.id, fantasy_name: sup.fantasy_name, name: sup.name }
          : null,
        invoice_number: inv.invoice_number || null,
        description: inv.description || null,
        date: inv.document_date || inv.created_at?.slice?.(0, 10) || "",
        created_at: inv.created_at || null,
        amount: parseNum(inv.amount),
        total: parseNum(inv.total ?? inv.amount),
        image_key: inv.image_key || null,
        has_payment_order: summary.orderCount > 0,
        invoice_fully_paid: summary.fullyPaid,
        invoice_paid_amount: summary.paidAmount,
        invoice_retention_amount: summary.retentionAmount,
        invoice_settled_amount: summary.settledAmount,
        invoice_remaining_amount: summary.remainingAmount,
        payment_order: orderSummary(order),
        payment_orders: invOrders.map(orderSummary),
        taxes: taxesByInvoice[inv.id] || [],
      };
    });

    const cashflowItems = (cashflowRows || [])
      .filter((cf) => String(cf.reference || "").trim().length > 0)
      .map((cf) => {
        const cfOrders = ordersByCashflowId[cf.id] || [];
        const order = cfOrders[cfOrders.length - 1] || null;
        const sup = supplierById[cf.provider];
        const total = Math.abs(parseNum(cf.amount));
        const net =
          cf.net_amount != null ? Math.abs(parseNum(cf.net_amount)) : total;
        const summary = buildPaymentSummary({ total, amount: net }, cfOrders);
        return {
          key: `cashflow-${cf.id}`,
          source: "cashflow",
          supplier_invoice_id: null,
          cashflow_id: cf.id,
          source_movement_id: null,
          supplier_id: cf.provider || null,
          supplier_name: sup ? sup.fantasy_name || sup.name || null : null,
          supplier: sup
            ? { id: sup.id, fantasy_name: sup.fantasy_name, name: sup.name }
            : null,
          invoice_number: String(cf.reference).trim(),
          description: cf.description || null,
          date: cf.date ? String(cf.date).slice(0, 10) : "",
          created_at: cf.date || null,
          amount: net,
          total,
          image_key: null,
          has_payment_order: summary.orderCount > 0,
          invoice_fully_paid: summary.fullyPaid,
          invoice_paid_amount: summary.paidAmount,
          invoice_remaining_amount: summary.remainingAmount,
          payment_order: orderSummary(order),
          payment_orders: cfOrders.map(orderSummary),
          taxes: taxesByCashflow[cf.id] || [],
        };
      });

    let all = [...controlItems, ...cashflowItems];

    // Filtros
    if (sourceFilter) all = all.filter((it) => it.source === sourceFilter);
    if (status === "con") all = all.filter((it) => it.invoice_fully_paid);
    if (status === "sin") all = all.filter((it) => !it.invoice_fully_paid);
    if (supplierId)
      all = all.filter((it) => String(it.supplier_id ?? "") === supplierId);
    if (dateFrom) all = all.filter((it) => it.date && it.date >= dateFrom);
    if (dateTo) all = all.filter((it) => it.date && it.date <= dateTo);
    if (search) {
      all = all.filter((it) => {
        const supplier = (it.supplier_name || "").toLowerCase();
        const num = (it.invoice_number || "").toLowerCase();
        const desc = (it.description || "").toLowerCase();
        return (
          supplier.includes(search) ||
          num.includes(search) ||
          desc.includes(search)
        );
      });
    }

    // Orden por fecha descendente (más recientes primero)
    all.sort((a, b) => {
      const c = String(b.date || "").localeCompare(String(a.date || ""));
      if (c !== 0) return c;
      return String(b.key).localeCompare(String(a.key));
    });

    const total = all.length;
    const offset = (page - 1) * limit;
    const pageItems = all.slice(offset, offset + limit);

    res.json({ data: pageItems, total, page, limit });
  } catch (e) {
    console.error("getPurchaseInvoices error:", e.message);
    res.json({ error: e.message });
  }
};

self.checkDuplicateSupplierInvoice = async (req, res) => {
  try {
    const supplierId = parseInt(req.query.supplier_id, 10);
    const invoiceNumber = req.query.invoice_number || "";
    const excludeInvoiceId = req.query.exclude_invoice_id
      ? parseInt(req.query.exclude_invoice_id, 10)
      : null;
    const excludeMovementId = req.query.exclude_movement_id
      ? parseInt(req.query.exclude_movement_id, 10)
      : null;

    const existing = await findDuplicateSupplierInvoice({
      supplierId,
      invoiceNumber,
      excludeInvoiceId,
      excludeMovementId,
    });

    return res.json({
      duplicate: Boolean(existing),
      existing,
    });
  } catch (e) {
    console.error("checkDuplicateSupplierInvoice", e.message);
    return res.json({ error: e.message });
  }
};

self.getSupplierInvoiceByAccountMovement = async (req, res) => {
  const account_movement_id = req.params.account_movement_id;
  try {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select(
        `
        *,
        supplier:suppliers (
          id,
          fantasy_name,
          name
        )
      `
      )
      .eq("account_movement_id", account_movement_id)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.json(null);

    const [withTaxes] = await attachTaxes([data]);
    res.json(withTaxes);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createSupplierInvoice = async (req, res) => {
  try {
    const row = {
      supplier_id: req.body.supplier_id,
      amount: req.body.amount,
      invoice_number: req.body.invoice_number || "",
      description: req.body.description,
      document_date: req.body.document_date || null,
      due_date: req.body.document_date || req.body.due_date || null,
      total: req.body.total,
      account_movement_id: req.body.account_movement_id || null,
      image_key: req.body.image_key || null,
    };

    await assertNoDuplicateSupplierInvoice({
      supplierId: row.supplier_id,
      invoiceNumber: row.invoice_number,
      excludeMovementId: row.account_movement_id,
    });

    const { data: created, error } = await supabase
      .from("supplier_invoices")
      .insert(row)
      .select();

    if (error) {
      console.error("Error creando factura de proveedor:", error);
      return res.status(500).json({ error: "Error al crear la factura" });
    }

    let newTaxes = [];
    if (created?.length && Array.isArray(req.body.taxes)) {
      const mapped = req.body.taxes.map((tax) => ({
        supplier_invoice_id: created[0].id,
        name: tax.type || tax.name,
        amount: parseFloat(tax.value ?? tax.amount),
      }));

      const { data: taxRows, error: taxesError } = await supabase
        .from("taxes")
        .insert(mapped)
        .select();

      if (taxesError) {
        console.error("Error creando impuestos:", taxesError);
        return res
          .status(500)
          .json({ error: "Error al insertar los impuestos" });
      }
      newTaxes = taxRows;
    }

    if (created?.[0]) {
      await syncPendingMovementFromInvoice(created[0]);
    }

    return res.status(201).json({
      invoice: created[0],
      taxes: newTaxes,
    });
  } catch (e) {
    if (e.code === "DUPLICATE_INVOICE") {
      return res.status(400).json({ error: e.message });
    }
    console.error("createSupplierInvoice", e.message);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
};

self.setSupplierInvoiceImage = async (req, res) => {
  try {
    const id = req.params.id;
    const { data, error } = await supabase
      .from("supplier_invoices")
      .update({ image_key: req.body.image_key || null })
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;
    return res.json({ invoice: data?.[0] || null });
  } catch (e) {
    console.error("setSupplierInvoiceImage", e.message);
    return res.status(500).json({ error: e.message });
  }
};

self.patchSupplierInvoiceDates = async (req, res) => {
  try {
    const id = req.params.id;
    const document_date = req.body.document_date;

    if (!document_date) {
      return res.status(400).json({ error: "Ingrese la fecha del comprobante" });
    }

    const { data: updated, error } = await supabase
      .from("supplier_invoices")
      .update({
        document_date,
        due_date: document_date,
      })
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;
    if (!updated?.length) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    await syncMovementDocumentDateFromInvoice(updated[0]);

    return res.json({ invoice: updated[0] });
  } catch (e) {
    console.error("patchSupplierInvoiceDates", e.message);
    return res.status(500).json({ error: e.message || "Error al actualizar la fecha" });
  }
};

self.updateSupplierInvoice = async (req, res) => {
  try {
    const id = req.params.id;

    const activeOrder = await getActiveOrderForInvoice(id);
    if (activeOrder) {
      return res.status(400).json({
        error:
          "No se puede editar la factura: tiene una orden de pago activa. Anulá la OP primero.",
      });
    }

    const update = { ...req.body };
    if (update.id) delete update.id;
    if (update.document_date) {
      update.due_date = update.document_date;
    }

    const { data: current, error: currentErr } = await supabase
      .from("supplier_invoices")
      .select("supplier_id, invoice_number, account_movement_id")
      .eq("id", id)
      .is("deleted_at", null)
      .single();

    if (currentErr || !current) {
      return res.status(404).json({ error: "Factura no encontrada" });
    }

    await assertNoDuplicateSupplierInvoice({
      supplierId: update.supplier_id ?? current.supplier_id,
      invoiceNumber: update.invoice_number ?? current.invoice_number,
      excludeInvoiceId: id,
      excludeMovementId:
        update.account_movement_id ?? current.account_movement_id,
    });

    const taxes = update.taxes || [];
    delete update.taxes;

    const { data: updated, error } = await supabase
      .from("supplier_invoices")
      .update(update)
      .eq("id", id)
      .is("deleted_at", null)
      .select();

    if (error) throw error;

    await supabase.from("taxes").delete().eq("supplier_invoice_id", id);

    let newTaxes = [];
    if (Array.isArray(taxes) && taxes.length > 0) {
      const mapped = taxes.map((t) => ({
        supplier_invoice_id: parseInt(id, 10),
        name: t.type || t.name,
        amount: parseFloat(t.value ?? t.amount),
      }));

      const { data: inserted, error: insertError } = await supabase
        .from("taxes")
        .insert(mapped)
        .select();

      if (insertError) throw insertError;
      newTaxes = inserted;
    }

    if (updated?.[0]) {
      await syncPendingMovementFromInvoice(updated[0]);
    }

    return res.status(200).json({
      invoice: updated?.[0] || null,
      taxes: newTaxes,
    });
  } catch (e) {
    if (e.code === "DUPLICATE_INVOICE") {
      return res.status(400).json({ error: e.message });
    }
    console.error("updateSupplierInvoice", e.message);
    res.json({ error: e.message });
  }
};

module.exports = self;
