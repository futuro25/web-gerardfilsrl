"use strict";

const supabase = require("../controllers/db");

function normalizeInvoiceNumber(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function buildDuplicateInvoiceError(existing) {
  const num = existing?.invoice_number || "";
  return num
    ? `Ya existe la factura ${num} para este proveedor.`
    : "Ya existe una factura con ese número para este proveedor.";
}

async function findDuplicateSupplierInvoice({
  supplierId,
  invoiceNumber,
  excludeInvoiceId = null,
  excludeMovementId = null,
}) {
  const supplier = parseInt(supplierId, 10);
  const norm = normalizeInvoiceNumber(invoiceNumber);
  if (!Number.isFinite(supplier) || supplier <= 0 || !norm) {
    return null;
  }

  const excludeInvId =
    excludeInvoiceId != null ? parseInt(excludeInvoiceId, 10) : null;
  const excludeMovId =
    excludeMovementId != null ? parseInt(excludeMovementId, 10) : null;

  const { data: invoices, error: invErr } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number, account_movement_id")
    .eq("supplier_id", supplier)
    .is("deleted_at", null);

  if (invErr) throw invErr;

  for (const inv of invoices || []) {
    if (excludeInvId && inv.id === excludeInvId) continue;
    if (excludeMovId && inv.account_movement_id === excludeMovId) continue;
    if (normalizeInvoiceNumber(inv.invoice_number) === norm) {
      return {
        source: "supplier_invoice",
        id: inv.id,
        invoice_number: inv.invoice_number,
      };
    }
  }

  const { data: movements, error: movErr } = await supabase
    .from("account_movements")
    .select("id, invoice_number")
    .eq("supplier_id", supplier)
    .is("deleted_at", null)
    .not("invoice_number", "is", null);

  if (movErr) throw movErr;

  for (const mov of movements || []) {
    if (excludeMovId && mov.id === excludeMovId) continue;
    if (normalizeInvoiceNumber(mov.invoice_number) === norm) {
      return {
        source: "account_movement",
        id: mov.id,
        invoice_number: mov.invoice_number,
      };
    }
  }

  return null;
}

async function assertNoDuplicateSupplierInvoice(options) {
  const existing = await findDuplicateSupplierInvoice(options);
  if (existing) {
    const err = new Error(buildDuplicateInvoiceError(existing));
    err.code = "DUPLICATE_INVOICE";
    err.existing = existing;
    throw err;
  }
}

module.exports = {
  normalizeInvoiceNumber,
  buildDuplicateInvoiceError,
  findDuplicateSupplierInvoice,
  assertNoDuplicateSupplierInvoice,
};
