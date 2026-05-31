import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import * as utils from "../utils/utils";

function fmtDate(value) {
  if (!value) return "—";
  const d = DateTime.fromISO(String(value).slice(0, 10));
  return d.isValid ? d.toFormat("dd/MM/yyyy") : "—";
}

function Row({ label, value, strong }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-b-0">
      <span className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <span
        className={utils.cn(
          "text-sm text-right",
          strong ? "font-bold text-slate-800" : "font-medium text-slate-700"
        )}
      >
        {value}
      </span>
    </div>
  );
}

export default function RetentionCertificateDialog({
  open,
  onOpenChange,
  certificate,
  payment,
}) {
  if (!certificate && !payment) return null;

  const c = certificate || {};
  const p = payment || {};

  const supplierName = c.supplier_name || p.supplier || "—";
  const cuit = c.supplier_cuit || p.supplier_cuit || "—";
  const invoiceNumber = c.invoice_number || p.invoice_number;
  const categoryCode = c.category_code || p.category_code || "";
  const categoryDetail = c.category_detail || p.category_detail || "";
  const netAmount = c.net_amount ?? p.net_amount;
  const retentionAmount = c.retention_amount ?? p.retention_amount;
  const profits = c.profits_condition || p.profits_condition || "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg">
        <DialogTitle className="text-lg font-bold text-slate-800 mb-1">
          Comprobante de Retención
        </DialogTitle>
        {certificate?.certificate_number ? (
          <p className="text-xs text-slate-400 mb-4">
            N° {certificate.certificate_number}
          </p>
        ) : (
          <p className="text-xs text-amber-600 mb-4">
            Sin certificado emitido para esta retención
          </p>
        )}

        <div className="flex flex-col gap-1">
          <Row label="Proveedor" value={supplierName} />
          <Row label="CUIT" value={cuit} />
          <Row
            label="N° Factura"
            value={
              invoiceNumber
                ? utils.formatInvoiceNumber(invoiceNumber)
                : "—"
            }
          />
          <Row
            label="Categoría"
            value={
              categoryCode
                ? `${categoryCode}${categoryDetail ? ` - ${categoryDetail}` : ""}`
                : "—"
            }
          />
          <Row label="Condición Ganancias" value={profits} />
          <Row label="Fecha emisión factura" value={fmtDate(c.issue_date || p.issue_date)} />
          <Row label="Fecha vencimiento" value={fmtDate(c.due_date || p.due_date)} />
          {certificate?.issued_date && (
            <Row label="Fecha del certificado" value={fmtDate(certificate.issued_date)} />
          )}
          <Row label="Neto" value={utils.formatAmount(netAmount)} />
          <Row
            label="Retención"
            value={utils.formatAmount(retentionAmount)}
            strong
          />
          {p.total_amount != null && (
            <Row label="Total factura" value={utils.formatAmount(p.total_amount)} />
          )}
          {p.total_to_pay != null && (
            <Row label="Total a pagar" value={utils.formatAmount(p.total_to_pay)} />
          )}
        </div>

        <div className="flex justify-end mt-6">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800"
          >
            Cerrar
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
