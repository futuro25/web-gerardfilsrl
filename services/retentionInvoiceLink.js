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
      total: roundMoney(parseAmount(inv.total ?? inv.amount)),
    });
  });

  return { invoiceById, invoiceIdByMovementId, meta };
}

function amountsRoughlyEqual(a, b, tolerance = 1) {
  return Math.abs(parseAmount(a) - parseAmount(b)) <= tolerance;
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
  if (rpNum) {
    for (const inv of meta) {
      if (inv.normNum === rpNum && inv.normCuit === rpCuit) {
        return inv.id;
      }
      if (inv.normNum === rpNum && !inv.normCuit && !rpCuit) {
        return inv.id;
      }
    }
  }

  if (!rpCuit) return null;

  const rpTotal = parseAmount(row.total_amount);
  const rpSettled = roundMoney(
    parseAmount(row.total_to_pay) + parseAmount(row.retention_amount)
  );

  const amountCandidates = meta.filter((inv) => {
    if (inv.normCuit !== rpCuit) return false;
    if (rpTotal > 0 && amountsRoughlyEqual(inv.total, rpTotal)) return true;
    if (rpSettled > 0 && amountsRoughlyEqual(inv.total, rpSettled)) return true;
    return false;
  });

  if (amountCandidates.length === 1) {
    return amountCandidates[0].id;
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
      "id, supplier_id, account_movement_id, invoice_number, total, amount, supplier:suppliers(cuit)"
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
    "id, supplier_invoice_id, account_movement_id, retention_amount, total_amount, total_to_pay, issue_date, category_code, invoice_number, supplier_cuit";

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

  if (normNums.length || normCuits.length) {
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
      if (rpNum && normNums.includes(rpNum)) {
        if (normCuits.length && rpCuit && !normCuits.includes(rpCuit)) return;
        rowsById.set(row.id, row);
        return;
      }
      if (!rpNum && rpCuit && normCuits.includes(rpCuit)) {
        const invoiceId = resolveInvoiceIdForRetention(
          row,
          {},
          meta.filter((m) => m.normCuit === rpCuit)
        );
        if (invoiceId != null) {
          rowsById.set(row.id, row);
        }
      }
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
  totalAmount = null,
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
  if (!cuit) return null;

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
    .select("id, account_movement_id, invoice_number, total, amount")
    .eq("supplier_id", supplier.id)
    .is("deleted_at", null);
  if (invErr) throw invErr;

  if (norm) {
    const match = (invoices || []).find(
      (inv) => normalizeInvoiceNumber(inv.invoice_number) === norm
    );
    if (match) {
      return {
        supplierInvoiceId: match.id,
        accountMovementId: match.account_movement_id ?? null,
        invoiceNumber: match.invoice_number || invoiceNumber,
      };
    }
  }

  const totalHint = parseAmount(totalAmount);
  if (totalHint > 0) {
    const amountMatches = (invoices || []).filter((inv) =>
      amountsRoughlyEqual(inv.total ?? inv.amount, totalHint)
    );
    if (amountMatches.length === 1) {
      const match = amountMatches[0];
      return {
        supplierInvoiceId: match.id,
        accountMovementId: match.account_movement_id ?? null,
        invoiceNumber: match.invoice_number || invoiceNumber,
      };
    }
  }

  return null;
}

async function resolveCashflowInvoiceReference(supplierCuit, totalAmount) {
  const cuit = normalizeCuit(supplierCuit);
  const totalHint = parseAmount(totalAmount);
  if (!cuit || totalHint <= 0) return null;

  const { data: suppliers, error: supErr } = await supabase
    .from("suppliers")
    .select("id, cuit")
    .is("deleted_at", null);
  if (supErr) throw supErr;

  const supplier = (suppliers || []).find(
    (s) => normalizeCuit(s.cuit) === cuit
  );
  if (!supplier) return null;

  const { data: cashflows, error: cfErr } = await supabase
    .from("cashflow")
    .select("id, reference, amount")
    .eq("type", "EGRESO")
    .eq("provider", supplier.id)
    .not("reference", "is", null)
    .is("deleted_at", null);
  if (cfErr) throw cfErr;

  const matches = (cashflows || []).filter((cf) =>
    amountsRoughlyEqual(Math.abs(parseAmount(cf.amount)), totalHint)
  );
  if (matches.length !== 1) return null;

  return {
    cashflowId: matches[0].id,
    invoiceNumber: String(matches[0].reference || "").trim() || null,
  };
}

async function batchResolveRetentionInvoiceNumbers(payments) {
  if (!payments?.length) return [];

  const unresolved = payments.filter((p) => !p.invoice_number);
  if (!unresolved.length) return payments;

  const [{ data: suppliers, error: supErr }, { data: invoices, error: invErr }, { data: cashflows, error: cfErr }] =
    await Promise.all([
      supabase.from("suppliers").select("id, cuit").is("deleted_at", null),
      supabase
        .from("supplier_invoices")
        .select(
          "id, invoice_number, total, amount, supplier_id, account_movement_id, supplier:suppliers(cuit)"
        )
        .is("deleted_at", null),
      supabase
        .from("cashflow")
        .select("id, reference, amount, provider")
        .eq("type", "EGRESO")
        .not("reference", "is", null)
        .is("deleted_at", null),
    ]);

  if (supErr) throw supErr;
  if (invErr) throw invErr;
  if (cfErr) throw cfErr;

  const cuitBySupplierId = {};
  (suppliers || []).forEach((s) => {
    cuitBySupplierId[s.id] = s.cuit;
  });

  const { invoiceIdByMovementId, meta } = buildInvoiceLinkMeta(
    invoices || [],
    cuitBySupplierId
  );
  const invoiceById = {};
  (invoices || []).forEach((inv) => {
    invoiceById[inv.id] = inv;
  });

  const supplierIdByCuit = {};
  (suppliers || []).forEach((s) => {
    supplierIdByCuit[normalizeCuit(s.cuit)] = s.id;
  });

  const cashflowByProviderAmount = {};
  (cashflows || []).forEach((cf) => {
    const amountKey = roundMoney(Math.abs(parseAmount(cf.amount)));
    const key = `${cf.provider}:${amountKey}`;
    if (!cashflowByProviderAmount[key]) cashflowByProviderAmount[key] = [];
    cashflowByProviderAmount[key].push(cf);
  });

  return payments.map((payment) => {
    if (payment.invoice_number) return payment;

    const invoiceId = resolveInvoiceIdForRetention(
      payment,
      invoiceIdByMovementId,
      meta
    );
    if (invoiceId && invoiceById[invoiceId]?.invoice_number) {
      return {
        ...payment,
        invoice_number: invoiceById[invoiceId].invoice_number,
      };
    }

    const supplierId = supplierIdByCuit[normalizeCuit(payment.supplier_cuit)];
    if (supplierId) {
      const amountKey = roundMoney(parseAmount(payment.total_amount));
      const matches = cashflowByProviderAmount[`${supplierId}:${amountKey}`];
      if (matches?.length === 1 && matches[0].reference) {
        return {
          ...payment,
          invoice_number: String(matches[0].reference).trim(),
        };
      }
    }

    return payment;
  });
}

async function resolveRetentionInvoiceNumber(payment) {
  if (payment.invoice_number) {
    return payment.invoice_number;
  }

  const controlLink = await resolveControlInvoiceLink({
    supplierInvoiceId: payment.supplier_invoice_id,
    accountMovementId: payment.account_movement_id,
    invoiceNumber: payment.invoice_number,
    supplierCuit: payment.supplier_cuit,
    totalAmount: payment.total_amount,
  });
  if (controlLink?.invoiceNumber) {
    return controlLink.invoiceNumber;
  }

  const cashflowLink = await resolveCashflowInvoiceReference(
    payment.supplier_cuit,
    payment.total_amount
  );
  if (cashflowLink?.invoiceNumber) {
    return cashflowLink.invoiceNumber;
  }

  return null;
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
  resolveCashflowInvoiceReference,
  resolveRetentionInvoiceNumber,
  batchResolveRetentionInvoiceNumbers,
  persistRetentionInvoiceLink,
  linkRetentionsToInvoices,
};
