import { DateTime } from "luxon";
import { jsPDF } from "jspdf";
import { Download } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Button from "./common/Button";
import * as utils from "../utils/utils";
import { REGIMEN_830_CATEGORIES } from "../utils/retention";

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

  const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

  const downloadPdf = () => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("CERTIFICADO DE RETENCIÓN", pageWidth / 2, y, {
        align: "center",
      });
      y += 8;

      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Régimen de Retención de Ganancias", pageWidth / 2, y, {
        align: "center",
      });
      y += 12;

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Gerardfil SRL - CUIT: 30-71878217-8", pageWidth / 2, y, {
        align: "center",
      });
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(
        "Pilar 5180, Caseros, Buenos Aires - Tel: 54 11 7856 4391",
        pageWidth / 2,
        y,
        { align: "center" }
      );
      y += 15;

      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("Número de Certificado:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(c.certificate_number || "-", margin + 50, y);

      doc.setFont("helvetica", "bold");
      doc.text("Fecha de Emisión:", pageWidth / 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(
        c.issued_date ? utils.formatDate(c.issued_date) : "-",
        pageWidth / 2 + 40,
        y
      );
      y += 10;

      doc.setFont("helvetica", "bold");
      doc.text("Razón Social:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(supplierName || "-", margin + 30, y);

      doc.setFont("helvetica", "bold");
      doc.text("CUIT:", pageWidth / 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(cuit || "-"), pageWidth / 2 + 15, y);
      y += 15;

      doc.setFont("helvetica", "bold");
      doc.text("Categoría (Régimen 830):", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const categoryDesc =
        REGIMEN_830_CATEGORIES.find((cat) => cat.code === categoryCode)
          ?.description ||
        categoryDetail ||
        "";
      const categoryText = `${categoryCode}${
        categoryDesc ? ` - ${categoryDesc}` : ""
      }`;
      const splitCategory = doc.splitTextToSize(
        categoryText,
        pageWidth - margin * 2
      );
      doc.text(splitCategory, margin, y);
      y += splitCategory.length * 5 + 5;

      doc.setFont("helvetica", "bold");
      doc.text("Condición frente a Ganancias:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(profits || "Inscripto", margin + 60, y);
      y += 15;

      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      doc.setFontSize(11);
      const totalFactura =
        p.total_amount != null ? num(p.total_amount) : num(netAmount) * 1.21;
      const totalToPay =
        p.total_to_pay != null
          ? num(p.total_to_pay)
          : totalFactura - num(retentionAmount);

      const colWidth = (pageWidth - margin * 2) / 3;
      doc.setFont("helvetica", "bold");
      doc.text("Total a Pagar", margin, y);
      doc.text("Monto Retenido", margin + colWidth, y);
      doc.text("Total Factura", margin + colWidth * 2, y);
      y += 8;

      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`$${totalToPay.toFixed(2)}`, margin, y);
      doc.text(`$${num(retentionAmount).toFixed(2)}`, margin + colWidth, y);
      doc.text(`$${totalFactura.toFixed(2)}`, margin + colWidth * 2, y);
      y += 20;

      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      const footerText =
        "Este certificado ha sido generado electrónicamente y tiene validez legal conforme a la normativa vigente.";
      const splitFooter = doc.splitTextToSize(footerText, pageWidth - margin * 2);
      doc.text(splitFooter, pageWidth / 2, y, { align: "center" });

      const fileName = `Certificado_Retencion_${
        c.certificate_number || p.id || "retencion"
      }.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error("Error generando PDF:", e);
      window.alert("Error al generar el PDF del certificado");
    }
  };

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

        <div className="flex items-center justify-end gap-2 mt-6">
          {certificate?.certificate_number && (
            <Button
              type="button"
              variant="outlined"
              size="sm"
              onClick={downloadPdf}
            >
              <Download className="h-4 w-4 mr-1" />
              Descargar PDF
            </Button>
          )}
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
