"use strict";

const supabase = require("../controllers/db");
const { normalizeInvoiceNumber } = require("./supplierInvoiceDuplicate");

function parseNum(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function absMoney(value) {
  return Math.abs(parseNum(value));
}

function invoiceDedupKey(supplierOrClientId, reference) {
  const sid = supplierOrClientId != null ? String(supplierOrClientId) : "";
  const ref = normalizeInvoiceNumber(reference);
  if (!sid || !ref) return null;
  return `${sid}:${ref}`;
}

function mapSupplier(supplier) {
  if (!supplier) return {};
  return {
    id: supplier.id,
    name: supplier.fantasy_name || supplier.name || "",
    fantasy_name: supplier.fantasy_name || null,
    cuit: supplier.cuit || null,
  };
}

function mapClient(client) {
  if (!client) return {};
  const docType = String(client.document_type || "").toUpperCase();
  const cuit =
    docType === "CUIT" || docType === "CUIL" ? client.document_number : null;
  const fullName = [client.name, client.last_name].filter(Boolean).join(" ");
  return {
    id: client.id,
    name: client.fantasy_name || fullName || "",
    fantasy_name: client.fantasy_name || null,
    cuit: cuit || null,
    document_number: client.document_number || null,
    document_type: client.document_type || null,
  };
}

function mapTaxes(rows) {
  return (rows || []).map((t) => ({
    id: t.id,
    name: t.name,
    amount: parseNum(t.amount),
  }));
}

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

async function fetchTaxesByDeliveryIds(deliveryIds) {
  if (!deliveryIds.length) return {};
  const { data, error } = await supabase
    .from("invoice_taxes")
    .select("id, invoice_id, name, amount")
    .in("invoice_id", deliveryIds);
  if (error) throw error;

  const map = {};
  (data || []).forEach((t) => {
    if (!map[t.invoice_id]) map[t.invoice_id] = [];
    map[t.invoice_id].push({ id: t.id, name: t.name, amount: t.amount });
  });
  return map;
}

function dedupeFiscalRecords(items) {
  const byKey = new Map();

  const score = (item) => {
    let s = 0;
    if (item.source === "control" || item.source === "delivery") s += 10;
    s += (item.taxes || []).length;
    if (item.net_amount > 0) s += 1;
    return s;
  };

  items.forEach((item) => {
    const key = invoiceDedupKey(
      item.supplier?.id ?? item.client?.id,
      item.reference
    );
    if (!key) {
      byKey.set(`${item.source}-${item.id}`, item);
      return;
    }
    const existing = byKey.get(key);
    if (!existing || score(item) > score(existing)) {
      byKey.set(key, item);
    }
  });

  return Array.from(byKey.values()).sort((a, b) =>
    String(b.date || "").localeCompare(String(a.date || ""))
  );
}

async function buildComprasComprobantes(from, to) {
  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, name, fantasy_name, cuit")
    .is("deleted_at", null);
  if (supErr) throw supErr;

  const supplierById = {};
  (suppliers || []).forEach((s) => {
    supplierById[s.id] = s;
  });

  const { data: controlRows, error: ctrlErr } = await supabase
    .from("supplier_invoices")
    .select(
      "id, supplier_id, invoice_number, document_date, amount, total, created_at"
    )
    .gte("document_date", from)
    .lte("document_date", to)
    .is("deleted_at", null);
  if (ctrlErr) throw ctrlErr;

  const { data: cashflowRows, error: cfErr } = await supabase
    .from("cashflow")
    .select("id, amount, net_amount, date, reference, provider")
    .eq("type", "EGRESO")
    .gte("date", from)
    .lte("date", to)
    .is("deleted_at", null)
    .not("reference", "is", null);
  if (cfErr) throw cfErr;

  const taxesByInvoice = await fetchTaxesBySupplierInvoiceIds(
    (controlRows || []).map((r) => r.id)
  );
  const taxesByCashflow = await fetchTaxesByCashflowIds(
    (cashflowRows || []).map((r) => r.id)
  );

  const controlItems = (controlRows || [])
    .filter((inv) => String(inv.invoice_number || "").trim())
    .map((inv) => {
      const taxes = mapTaxes(taxesByInvoice[inv.id] || []);
      const net = absMoney(inv.amount);
      const total = absMoney(inv.total ?? inv.amount);
      return {
        id: `control-${inv.id}`,
        source: "control",
        reference: String(inv.invoice_number).trim(),
        date: inv.document_date || inv.created_at?.slice?.(0, 10) || "",
        total,
        net_amount: net,
        amount: total,
        taxes,
        supplier: mapSupplier(supplierById[inv.supplier_id]),
      };
    });

  const cashflowItems = (cashflowRows || [])
    .filter((cf) => String(cf.reference || "").trim())
    .map((cf) => {
      const taxes = mapTaxes(taxesByCashflow[cf.id] || []);
      const total = absMoney(cf.amount);
      const net =
        cf.net_amount != null ? absMoney(cf.net_amount) : total;
      return {
        id: `cashflow-${cf.id}`,
        source: "cashflow",
        reference: String(cf.reference).trim(),
        date: cf.date ? String(cf.date).slice(0, 10) : "",
        total,
        net_amount: net,
        amount: total,
        taxes,
        supplier: mapSupplier(supplierById[cf.provider]),
      };
    });

  return dedupeFiscalRecords([...controlItems, ...cashflowItems]);
}

async function buildVentasComprobantes(from, to) {
  const { data: clients, error: cliErr } = await supabase
    .from("clients")
    .select(
      "id, name, last_name, fantasy_name, document_number, document_type"
    )
    .is("deleted_at", null);
  if (cliErr) throw cliErr;

  const clientById = {};
  (clients || []).forEach((c) => {
    clientById[c.id] = c;
  });

  const { data: cashflowRows, error: cfErr } = await supabase
    .from("cashflow")
    .select("id, amount, net_amount, date, reference, provider")
    .eq("type", "INGRESO")
    .gte("date", from)
    .lte("date", to)
    .is("deleted_at", null);
  if (cfErr) throw cfErr;

  const { data: deliveryRows, error: delErr } = await supabase
    .from("deliveries")
    .select(
      "id, client_id, invoice_number, amount, total, due_date, created_at"
    )
    .is("deleted_at", null);
  if (delErr) throw delErr;

  const filteredDeliveries = (deliveryRows || []).filter((d) => {
    const date =
      d.due_date || d.created_at?.slice?.(0, 10) || "";
    return date && date >= from && date <= to;
  });

  const taxesByCashflow = await fetchTaxesByCashflowIds(
    (cashflowRows || []).map((r) => r.id)
  );
  const taxesByDelivery = await fetchTaxesByDeliveryIds(
    filteredDeliveries.map((r) => r.id)
  );

  const cashflowItems = (cashflowRows || [])
    .filter((cf) => String(cf.reference || "").trim())
    .map((cf) => {
      const taxes = mapTaxes(taxesByCashflow[cf.id] || []);
      const total = absMoney(cf.amount);
      const net =
        cf.net_amount != null ? absMoney(cf.net_amount) : total;
      return {
        id: `cashflow-${cf.id}`,
        source: "cashflow",
        reference: String(cf.reference).trim(),
        date: cf.date ? String(cf.date).slice(0, 10) : "",
        total,
        net_amount: net,
        amount: total,
        taxes,
        client: mapClient(clientById[+cf.provider]),
      };
    });

  const deliveryItems = filteredDeliveries
    .filter((d) => String(d.invoice_number || "").trim())
    .map((d) => {
      const taxes = mapTaxes(taxesByDelivery[d.id] || []);
      const net = absMoney(d.amount);
      const total = absMoney(d.total ?? d.amount);
      const date = d.due_date || d.created_at?.slice?.(0, 10) || "";
      return {
        id: `delivery-${d.id}`,
        source: "delivery",
        reference: String(d.invoice_number).trim(),
        date,
        total,
        net_amount: net,
        amount: total,
        taxes,
        client: mapClient(clientById[d.client_id]),
      };
    });

  return dedupeFiscalRecords([...cashflowItems, ...deliveryItems]);
}

module.exports = {
  buildComprasComprobantes,
  buildVentasComprobantes,
};
