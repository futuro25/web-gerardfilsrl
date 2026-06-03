/** Normaliza distintas formas de factura al shape usado por retenciones. */
export function buildRetentionInvoiceInput(source, movement = null) {
  if (!source) return null;

  const supplierInvoiceId =
    source.supplier_invoice_id ?? source.id ?? null;
  const accountMovementId =
    source.account_movement_id ?? movement?.id ?? null;

  return {
    source: source.source || (supplierInvoiceId ? "control" : "cashflow"),
    supplier_invoice_id: supplierInvoiceId,
    account_movement_id: accountMovementId,
    supplier_id: source.supplier_id ?? source.supplier?.id ?? null,
    supplier_name:
      source.supplier_name ||
      source.supplier?.fantasy_name ||
      source.supplier?.name ||
      movement?.supplier_name ||
      null,
    supplier: source.supplier || null,
    invoice_number: source.invoice_number || null,
    amount: source.amount,
    total: source.total ?? source.amount,
    date:
      source.document_date ||
      source.date ||
      source.due_date ||
      source.created_at?.slice?.(0, 10) ||
      null,
  };
}

export function retentionLookupParams(invoice) {
  if (!invoice) return {};
  return {
    supplierInvoiceId: invoice.supplier_invoice_id ?? invoice.id ?? null,
    accountMovementId: invoice.account_movement_id ?? null,
    invoiceNumber: invoice.invoice_number || "",
    supplierId: invoice.supplier_id ?? invoice.supplier?.id ?? null,
    amount: invoice.total ?? invoice.amount ?? null,
    date: invoice.date || null,
  };
}
