import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { fetchSupplierInvoiceByAccountMovement } from "../apis/api.supplierinvoices";
import { fetchPaymentOrdersByMovement } from "../apis/api.paymentorders";
import {
  querySupplierInvoiceByMovementKey,
  queryPaymentOrdersByMovementKey,
} from "../apis/queryKeys";

const PAYMENT_METHOD_LABELS = {
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  EFECTIVO: "Efectivo",
  "TARJETA DE CREDITO": "Tarjeta de crédito",
  "TARJETA DE DEBITO": "Tarjeta de débito",
};

function DetailRow({ label, children }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-1">
      <span className="text-xs text-slate-400 uppercase tracking-wide shrink-0 sm:w-36">
        {label}
      </span>
      <span className="text-sm text-slate-700">{children}</span>
    </div>
  );
}

export default function MovementDetailDialog({
  open,
  onOpenChange,
  movement,
}) {
  const movementId = movement?.id;
  const hasInvoice = movement?.type === "EGRESO" && movement?.supplier_name;

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: querySupplierInvoiceByMovementKey(movementId),
    queryFn: () => fetchSupplierInvoiceByAccountMovement(movementId),
    enabled: open && Boolean(movementId) && Boolean(hasInvoice),
  });

  const { data: paymentOrdersData, isLoading: paymentOrdersLoading } = useQuery({
    queryKey: queryPaymentOrdersByMovementKey(movementId),
    queryFn: () => fetchPaymentOrdersByMovement(movementId),
    enabled: open && Boolean(movementId),
  });

  const invoice = invoiceData && !invoiceData.error ? invoiceData : null;
  const paymentOrders = paymentOrdersData?.data || [];
  const loading = invoiceLoading || paymentOrdersLoading;

  if (!movement) return null;

  const effectiveDate =
    movement.is_cheque && movement.cheque_due_date
      ? movement.cheque_due_date
      : movement.date;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        <div className="flex items-start justify-between gap-2">
          <div>
            <DialogTitle className="text-lg font-semibold text-slate-800">
              Movimiento #{movement.id}
            </DialogTitle>
            <p className="text-xs text-slate-400 mt-0.5">Detalle del movimiento</p>
          </div>
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 text-sm shrink-0 mt-1"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </button>
        </div>

        {/* Movement info */}
        <section className="flex flex-col gap-2.5 bg-slate-50 rounded-lg p-4 border border-slate-100">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Datos del movimiento
          </h3>
          <DetailRow label="Fecha">
            {DateTime.fromISO(effectiveDate).toFormat("dd/MM/yyyy")}
            {movement.is_cheque && (
              <span className="ml-2 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">
                CHEQUE
              </span>
            )}
          </DetailRow>
          <DetailRow label="Tipo">
            <span
              className={utils.cn(
                "px-2 py-0.5 rounded text-xs font-medium text-white",
                movement.type === "INGRESO" ? "bg-green-500" : "bg-red-500"
              )}
            >
              {movement.type === "INGRESO" ? "Ingreso" : "Egreso"}
            </span>
          </DetailRow>
          <DetailRow label="Clasificación">
            {movement.movement_kind === "FIJO"
              ? "Fijo"
              : movement.movement_kind === "PENDIENTE"
              ? "Pendiente"
              : "Única vez"}
          </DetailRow>
          <DetailRow label="Monto">
            <span
              className={utils.cn(
                "font-semibold",
                movement.type === "INGRESO" ? "text-green-600" : "text-red-600"
              )}
            >
              {movement.type === "INGRESO" ? "+" : "-"}
              {utils.formatAmount(movement.amount)}
            </span>
          </DetailRow>
          {movement.description && (
            <DetailRow label="Detalle">{movement.description}</DetailRow>
          )}
          {movement.is_cheque && (
            <>
              <DetailRow label="N° cheque">{movement.cheque_number}</DetailRow>
              <DetailRow label="Banco">{movement.cheque_bank}</DetailRow>
              <DetailRow label="Vencimiento">
                {movement.cheque_due_date
                  ? DateTime.fromISO(movement.cheque_due_date).toFormat("dd/MM/yyyy")
                  : "-"}
              </DetailRow>
            </>
          )}
        </section>

        {/* Invoice section */}
        {hasInvoice && (
          <section className="flex flex-col gap-2.5 bg-amber-50 rounded-lg p-4 border border-amber-100">
            <h3 className="text-xs font-semibold text-amber-600 uppercase tracking-wide">
              Factura de proveedor
            </h3>
            {invoiceLoading ? (
              <div className="py-2 flex justify-center">
                <Spinner />
              </div>
            ) : invoice ? (
              <>
                <DetailRow label="Proveedor">{movement.supplier_name}</DetailRow>
                {invoice.invoice_number && (
                  <DetailRow label="N° factura">{invoice.invoice_number}</DetailRow>
                )}
                <DetailRow label="Monto neto">
                  {utils.formatAmount(invoice.amount)}
                </DetailRow>
                {invoice.total && invoice.total !== invoice.amount && (
                  <DetailRow label="Total c/ imp.">
                    {utils.formatAmount(invoice.total)}
                  </DetailRow>
                )}
                {invoice.due_date && (
                  <DetailRow label="Vencimiento">
                    {DateTime.fromISO(invoice.due_date).toFormat("dd/MM/yyyy")}
                  </DetailRow>
                )}
                {invoice.taxes?.length > 0 && (
                  <DetailRow label="Impuestos">
                    {invoice.taxes
                      .map((t) => `${t.name || t.type}: ${utils.formatAmount(t.amount)}`)
                      .join(" · ")}
                  </DetailRow>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Sin datos de factura cargados.</p>
            )}
          </section>
        )}

        {/* Payment orders section */}
        <section className="flex flex-col gap-2.5">
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Órdenes de pago
          </h3>
          {paymentOrdersLoading ? (
            <div className="py-2 flex justify-center">
              <Spinner />
            </div>
          ) : paymentOrders.length === 0 ? (
            <p className="text-xs text-slate-400 italic">Sin órdenes de pago registradas.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {paymentOrders.map((po) => (
                <div
                  key={po.id}
                  className="flex items-center justify-between bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="font-semibold text-slate-700 text-xs">
                      {po.order_number}
                    </span>
                    <span className="text-slate-400 text-[11px]">
                      {PAYMENT_METHOD_LABELS[po.payment_method] || po.payment_method} ·{" "}
                      {po.payment_date
                        ? DateTime.fromISO(po.payment_date).toFormat("dd/MM/yyyy")
                        : "-"}
                    </span>
                  </div>
                  <span className="font-semibold text-slate-700 text-sm">
                    {utils.formatAmount(po.amount)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="outlined"
            size="sm"
            className="flex-1"
            onClick={() => onOpenChange(false)}
          >
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
