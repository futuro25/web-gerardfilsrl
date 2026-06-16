"use strict";

const supabase = require("../controllers/db");
const { normalizeInvoiceNumber } = require("./supplierInvoiceDuplicate");

function normalizeCuit(value) {
  return String(value || "").replace(/[^0-9]/g, "");
}

function parseAmount(value) {
  const n = parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

function roundMoney(value) {
  return Math.round(parseAmount(value) * 100) / 100;
}

function buildInvoiceLinkMeta(invoices, cuitBySupplierId = {}) {
  const invoiceById = {};
  const invoiceIdByMovementId = {};
  const meta = [];

  (invoices || []).forEach((inv) => {
    invoiceById[inv.id] = inv;
    if (inv.account_movement_id != null) {
      invoiceIdByMovementId[inv.account_movement_id] = inv.id;
    }
    const cuit =
      inv.supplier?.cuit ??
      inv.supplier_cuit ??
      cuitBySupplierId[inv.supplier_id] ??
      null;
    meta.push({
      id: inv.id,
      normNum: normalizeInvoiceNumber(inv.invoice_number),
      normCuit: normalizeCuit(cuit),
      movementId: inv.account_movement_id ?? null,
    });
  });

  return { invoiceById, invoiceIdByMovementId, meta };
}

function resolveInvoiceIdForRetention(row, invoiceIdByMovementId, meta) {
  if (row.supplier_invoice_id != null) {
    return row.supplier_invoice_id;
  }
  if (
    row.account_movement_id != null &&
    invoiceIdByMovementId[row.account_movement_id] != null
  ) {
    return invoiceIdByMovementId[row.account_movement_id];
  }
  const rpNum = normalizeInvoiceNumber(row.invoice_number);
  const rpCuit = normalizeCuit(row.supplier_cuit);
  if (!rpNum) return null;
  for (const inv of meta) {
    if (inv.normNum === rpNum && inv.normCuit === rpCuit) {
      return inv.id;
    }
    if (inv.normNum === rpNum && !inv.normCuit && !rpCuit) {
      return inv.id;
    }
  }
  return null;
}

function linkRetentionsToInvoices(invoices, retentionRows, cuitBySupplierId) {
  const invoiceIds = new Set((invoices || []).map((inv) => inv.id));
  const { invoiceIdByMovementId, meta } = buildInvoiceLinkMeta(
    invoices,
    cuitBySupplierId
  );

  const amountsByInvoiceId = {};
  const rowsById = new Map();
  const assignedRetentionIds = new Set();

  (retentionRows || []).forEach((row) => {
    const invoiceId = resolveInvoiceIdForRetention(
      row,
      invoiceIdByMovementId,
      meta
    );
    if (invoiceId == null || !invoiceIds.has(invoiceId)) return;
    if (assignedRetentionIds.has(row.id)) return;
    assignedRetentionIds.add(row.id);

    amountsByInvoiceId[invoiceId] = roundMoney(
      (amountsByInvoiceId[invoiceId] || 0) + parseAmount(row.retention_amount)
    );

    const linked = {
      ...row,
      supplier_invoice_id: row.supplier_invoice_id ?? invoiceId,
    };
    rowsById.set(row.id, linked);
  });

  return {
    amountsByInvoiceId,
    linkedRetentionRows: [...rowsById.values()],
  };
}

async function fetchSupplierCuitsByIds(supplierIds) {
  if (!supplierIds?.length) return {};
  const { data, error } = await supabase
    .from("suppliers")
    .select("id, cuit")
    .in("id", supplierIds)
    .is("deleted_at", null);
  if (error) throw error;

  const map = {};
  (data || []).forEach((s) => {
    map[s.id] = s.cuit;
  });
  return map;
}

async function loadInvoicesForRetentionLink(invoiceIds) {
  if (!invoiceIds?.length) return [];
  const { data, error } = await supabase
    .from("supplier_invoices")
    .select(
      "id, supplier_id, account_movement_id, invoice_number, supplier:suppliers(cuit)"
    )
    .in("id", invoiceIds)
    .is("deleted_at", null);
  if (error) throw error;
  return data || [];
}

async function fetchRetentionPaymentRowsForInvoices(invoices) {
  const invoiceIds = [...new Set((invoices || []).map((inv) => inv.id))];
  if (!invoiceIds.length) return [];

  const movementIds = [
    ...new Set(
      (invoices || [])
        .map((inv) => inv.account_movement_id)
        .filter((id) => id != null)
    ),
  ];

  const selectFields =
    "id, supplier_invoice_id, account_movement_id, retention_amount, issue_date, category_code, invoice_number, supplier_cuit";

  const rowsById = new Map();

  const { data: byInvoiceId, error: byInvErr } = await supabase
    .from("retention_payments")
    .select(selectFields)
    .in("supplier_invoice_id", invoiceIds)
    .is("deleted_at", null);
  if (byInvErr) throw byInvErr;
  (byInvoiceId || []).forEach((row) => rowsById.set(row.id, row));

  if (movementIds.length) {
    const { data: byMovement, error: byMovErr } = await supabase
      .from("retention_payments")
      .select(selectFields)
      .in("account_movement_id", movementIds)
      .is("deleted_at", null);
    if (byMovErr) throw byMovErr;
    (byMovement || []).forEach((row) => rowsById.set(row.id, row));
  }

  const supplierIds = [
    ...new Set((invoices || []).map((inv) => inv.supplier_id).filter(Boolean)),
  ];
  const cuitBySupplierId = await fetchSupplierCuitsByIds(supplierIds);
  const { meta } = buildInvoiceLinkMeta(invoices, cuitBySupplierId);
  const normNums = [...new Set(meta.map((m) => m.normNum).filter(Boolean))];
  const normCuits = [...new Set(meta.map((m) => m.normCuit).filter(Boolean))];

  if (normNums.length) {
    const { data: orphans, error: orphanErr } = await supabase
      .from("retention_payments")
      .select(selectFields)
      .is("deleted_at", null)
      .is("supplier_invoice_id", null)
      .is("account_movement_id", null);
    if (orphanErr) throw orphanErr;

    (orphans || []).forEach((row) => {
      const rpNum = normalizeInvoiceNumber(row.invoice_number);
      const rpCuit = normalizeCuit(row.supplier_cuit);
      if (!rpNum || !normNums.includes(rpNum)) return;
      if (normCuits.length && rpCuit && !normCuits.includes(rpCuit)) return;
      rowsById.set(row.id, row);
    });
  }

  return [...rowsById.values()];
}

async function backfillResolvedRetentionLinks(invoices, retentionRows, cuitBySupplierId) {
  const { amountsByInvoiceId, linkedRetentionRows } = linkRetentionsToInvoices(
    invoices,
    retentionRows,
    cuitBySupplierId
  );

  const persistTasks = [];
  for (const row of retentionRows) {
    if (row.supplier_invoice_id != null) continue;
    const linked = linkedRetentionRows.find((item) => item.id === row.id);
    if (linked?.supplier_invoice_id) {
      persistTasks.push(
        persistRetentionInvoiceLink(row.id, linked.supplier_invoice_id)
      );
    }
  }
  if (persistTasks.length) {
    await Promise.allSettled(persistTasks);
  }

  return { amountsByInvoiceId, linkedRetentionRows };
}

async function getRetentionAmountsByInvoiceIds(invoiceIds) {
  if (!invoiceIds?.length) return {};
  const invoices = await loadInvoicesForRetentionLink(invoiceIds);
  const retentionRows = await fetchRetentionPaymentRowsForInvoices(invoices);
  const supplierIds = [
    ...new Set(invoices.map((inv) => inv.supplier_id).filter(Boolean)),
  ];
  const cuitBySupplierId = await fetchSupplierCuitsByIds(supplierIds);
  const { amountsByInvoiceId } = await backfillResolvedRetentionLinks(
    invoices,
    retentionRows,
    cuitBySupplierId
  );
  return amountsByInvoiceId;
}

async function fetchRetentionsForInvoices(invoices) {
  if (!invoices?.length) return [];
  const enriched = invoices.some((inv) => inv.invoice_number != null)
    ? invoices
    : await loadInvoicesForRetentionLink(invoices.map((inv) => inv.id));

  const retentionRows = await fetchRetentionPaymentRowsForInvoices(enriched);
  const supplierIds = [
    ...new Set(enriched.map((inv) => inv.supplier_id).filter(Boolean)),
  ];
  const cuitBySupplierId = await fetchSupplierCuitsByIds(supplierIds);
  const { linkedRetentionRows } = await backfillResolvedRetentionLinks(
    enriched,
    retentionRows,
    cuitBySupplierId
  );
  return linkedRetentionRows;
}

async function resolveControlInvoiceLink({
  supplierInvoiceId = null,
  accountMovementId = null,
  invoiceNumber = null,
  supplierCuit = null,
}) {
  if (supplierInvoiceId) {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select("id, account_movement_id, invoice_number, supplier_id")
      .eq("id", supplierInvoiceId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        supplierInvoiceId: data.id,
        accountMovementId:
          accountMovementId ?? data.account_movement_id ?? null,
        invoiceNumber: invoiceNumber || data.invoice_number || null,
      };
    }
  }

  if (accountMovementId) {
    const { data, error } = await supabase
      .from("supplier_invoices")
      .select("id, account_movement_id, invoice_number, supplier_id")
      .eq("account_movement_id", accountMovementId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      return {
        supplierInvoiceId: data.id,
        accountMovementId: data.account_movement_id ?? accountMovementId,
        invoiceNumber: invoiceNumber || data.invoice_number || null,
      };
    }
  }

  const norm = normalizeInvoiceNumber(invoiceNumber);
  const cuit = normalizeCuit(supplierCuit);
  if (!norm || !cuit) return null;

  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, cuit")
    .is("deleted_at", null);
  if (supErr) throw supErr;

  const supplier = (suppliers || []).find(
    (s) => normalizeCuit(s.cuit) === cuit
  );
  if (!supplier) return null;

  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, account_movement_id, invoice_number")
    .eq("supplier_id", supplier.id)
    .is("deleted_at", null);
  if (invErr) throw invErr;

  const match = (invoices || []).find(
    (inv) => normalizeInvoiceNumber(inv.invoice_number) === norm
  );
  if (!match) return null;

  return {
    supplierInvoiceId: match.id,
    accountMovementId: match.account_movement_id ?? null,
    invoiceNumber: match.invoice_number || invoiceNumber,
  };
}

async function persistRetentionInvoiceLink(retentionId, supplierInvoiceId) {
  if (retentionId == null || supplierInvoiceId == null) return;

  const { data: invoice, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("account_movement_id")
    .eq("id", supplierInvoiceId)
    .is("deleted_at", null)
    .maybeSingle();
  if (invErr) throw invErr;

  const patch = { supplier_invoice_id: supplierInvoiceId };
  if (invoice?.account_movement_id != null) {
    patch.account_movement_id = invoice.account_movement_id;
  }

  await supabase
    .from("retention_payments")
    .update(patch)
    .eq("id", retentionId)
    .is("deleted_at", null);
}

module.exports = {
  normalizeCuit,
  getRetentionAmountsByInvoiceIds,
  fetchRetentionsForInvoices,
  resolveControlInvoiceLink,
  persistRetentionInvoiceLink,
  linkRetentionsToInvoices,
};
