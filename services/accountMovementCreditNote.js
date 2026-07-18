"use strict";

const supabase = require("../controllers/db");

const CREDIT_NOTE_CATEGORY = "NOTA_CREDITO";

/** Ingresos de Control cargados como nota de crédito de proveedor. */
function isCreditNoteIncome(body) {
  return (
    body.type === "INGRESO" && body.income_category === CREDIT_NOTE_CATEGORY
  );
}

function parseCreditNoteInvoiceId(value) {
  const id = parseInt(value, 10);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function validateIngresoCreditNoteFields(body) {
  if (body.type !== "INGRESO") return null;
  const category = body.income_category || null;
  if (category == null) return null;
  if (category !== CREDIT_NOTE_CATEGORY) {
    return "Tipo de ingreso inválido";
  }
  if (!String(body.credit_note_number || "").trim()) {
    return "Número de nota de crédito requerido";
  }
  if (!parseCreditNoteInvoiceId(body.credit_note_invoice_id)) {
    return "Seleccione la factura asociada a la nota de crédito";
  }
  return null;
}

function applyIngresoCreditNoteFields(movement, body) {
  if (isCreditNoteIncome(body)) {
    movement.income_category = CREDIT_NOTE_CATEGORY;
    movement.credit_note_number =
      String(body.credit_note_number || "").trim() || null;
    movement.credit_note_invoice_id = parseCreditNoteInvoiceId(
      body.credit_note_invoice_id
    );
  } else {
    movement.income_category = null;
    movement.credit_note_number = null;
    movement.credit_note_invoice_id = null;
  }
  return movement;
}

/** Factura asociada a la NC; valida existencia y devuelve datos para derivar el proveedor. */
async function resolveCreditNoteInvoice(invoiceId) {
  const id = parseCreditNoteInvoiceId(invoiceId);
  if (!id) {
    const err = new Error("Factura asociada inválida");
    err.code = "CREDIT_NOTE_INVOICE";
    throw err;
  }

  const { data, error } = await supabase
    .from("supplier_invoices")
    .select("id, supplier_id, invoice_number, total, amount")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    const err = new Error("La factura asociada a la nota de crédito no existe");
    err.code = "CREDIT_NOTE_INVOICE";
    throw err;
  }
  return data;
}

/** Agrega el N° de la factura asociada a los movimientos NC del listado. */
async function attachCreditNoteInfo(movements) {
  if (!movements?.length) return movements || [];

  const invoiceIds = [
    ...new Set(
      movements
        .map((m) => m.credit_note_invoice_id)
        .filter((id) => id != null)
    ),
  ];
  if (!invoiceIds.length) return movements;

  const { data: invoices, error } = await supabase
    .from("supplier_invoices")
    .select("id, invoice_number")
    .in("id", invoiceIds);
  if (error) throw error;

  const numberById = {};
  (invoices || []).forEach((inv) => {
    numberById[inv.id] = inv.invoice_number || null;
  });

  return movements.map((m) =>
    m.credit_note_invoice_id != null
      ? {
          ...m,
          credit_note_invoice_number:
            numberById[m.credit_note_invoice_id] || null,
        }
      : m
  );
}

module.exports = {
  CREDIT_NOTE_CATEGORY,
  isCreditNoteIncome,
  parseCreditNoteInvoiceId,
  validateIngresoCreditNoteFields,
  applyIngresoCreditNoteFields,
  resolveCreditNoteInvoice,
  attachCreditNoteInfo,
};
