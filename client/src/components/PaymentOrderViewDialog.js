import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import * as utils from "../utils/utils";

const PAYMENT_METHOD_LABELS = {
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  EFECTIVO: "Efectivo",
  "TARJETA DE CREDITO": "Tarjeta de crédito",
  "TARJETA DE DEBITO": "Tarjeta de débito",
};

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

export default function PaymentOrderViewDialog({
  open,
  onOpenChange,
  order,
  supplierName,
  invoiceNumber,
}) {
  if (!order) return null;

  const isCheque = order.payment_method === "CHEQUE";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-md">
        <DialogTitle className="text-lg font-bold text-slate-800 mb-1">
          Orden de Pago
        </DialogTitle>
        {order.order_number && (
          <p className="text-xs text-emerald-600 font-semibold mb-4">
            {order.order_number}
          </p>
        )}

        <div className="flex flex-col gap-1">
          {supplierName && <Row label="Proveedor" value={supplierName} />}
          {invoiceNumber && (
            <Row
              label="N° Factura"
              value={utils.formatInvoiceNumber(invoiceNumber)}
            />
          )}
          <Row
            label="Forma de pago"
            value={
              PAYMENT_METHOD_LABELS[order.payment_method] ||
              order.payment_method ||
              "—"
            }
          />
          <Row label="Fecha de pago" value={fmtDate(order.payment_date)} />
          <Row label="Monto" value={utils.formatAmount(order.amount)} strong />

          {isCheque && (
            <>
              <Row label="N° de cheque" value={order.cheque_number || "—"} />
              <Row label="Banco" value={order.cheque_bank || "—"} />
              <Row
                label="Vencimiento cheque"
                value={fmtDate(order.cheque_due_date)}
              />
            </>
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
