import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { ExternalLinkIcon, Eye, Maximize2, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import PaymentOrderViewDialog from "./PaymentOrderViewDialog";
import InvoiceRetentionSection from "./InvoiceRetentionSection";
import * as utils from "../utils/utils";
import { buildRetentionInvoiceInput } from "../utils/retentionInvoice";
import { fetchSupplierInvoiceByAccountMovement } from "../apis/api.supplierinvoices";
import { fetchPaymentOrdersByMovement } from "../apis/api.paymentorders";
import { fetchInvoiceImageUrl } from "../apis/api.uploads";
import {
  querySupplierInvoiceByMovementKey,
  queryPaymentOrdersByMovementKey,
  queryInvoiceImageUrlKey,
} from "../apis/queryKeys";

import { PAYMENT_METHOD_LABELS } from "./PaymentOrderFields";

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
  onRequestCancelPaymentOrder,
  isCancellingPaymentOrder = false,
}) {
  const movementId = movement?.id;
  const hasFullInvoice =
    movement?.type === "EGRESO" &&
    (movement?.expense_category === "FACTURA" ||
      Boolean(movement?.supplier_invoice_id));
  const hasEgresoSupplier =
    movement?.type === "EGRESO" &&
    (movement?.supplier_name ||
      (movement?.expense_category === "SERVICIOS" &&
        movement?.invoice_number));

  const [imagePreviewOpen, setImagePreviewOpen] = useState(false);
  const [poViewOpen, setPoViewOpen] = useState(false);
  const [selectedPaymentOrder, setSelectedPaymentOrder] = useState(null);

  useEffect(() => {
    if (!open) {
      setImagePreviewOpen(false);
      setPoViewOpen(false);
      setSelectedPaymentOrder(null);
    }
  }, [open]);

  const openPaymentOrderView = (po) => {
    setSelectedPaymentOrder(po);
    setPoViewOpen(true);
  };

  const canCancelPaymentOrders = Boolean(onRequestCancelPaymentOrder);

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: querySupplierInvoiceByMovementKey(movementId),
    queryFn: () => fetchSupplierInvoiceByAccountMovement(movementId),
    enabled: open && Boolean(movementId) && Boolean(hasFullInvoice),
  });

  const { data: paymentOrdersData, isLoading: paymentOrdersLoading } = useQuery({
    queryKey: queryPaymentOrdersByMovementKey(movementId),
    queryFn: () => fetchPaymentOrdersByMovement(movementId),
    enabled: open && Boolean(movementId),
  });

  const invoice = invoiceData && !invoiceData.error ? invoiceData : null;
  const retentionInvoice = buildRetentionInvoiceInput(invoice, movement);
  const paymentOrders = paymentOrdersData?.data || [];
  const imageKey = invoice?.image_key || movement?.image_key || null;

  const {
    data: imageRes,
    isLoading: imageLoading,
    isError: imageError,
  } = useQuery({
    queryKey: queryInvoiceImageUrlKey(imageKey),
    queryFn: () => fetchInvoiceImageUrl(imageKey),
    enabled: open && Boolean(imageKey),
  });

  const imageUrl = imageRes?.url || null;
  const isPdf = imageKey && /\.pdf$/i.test(imageKey);

  if (!movement) return null;

  const effectiveDate =
    movement.expense_category === "FACTURA" &&
    (movement.invoice_document_date || invoice?.document_date)
      ? movement.invoice_document_date || invoice?.document_date
      : movement.is_cheque && movement.cheque_due_date
        ? movement.cheque_due_date
        : movement.date;

  return (
    <>
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
          <DetailRow
            label={
              movement.expense_category === "FACTURA"
                ? "Fecha comprobante"
                : "Fecha"
            }
          >
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
            {movement.income_category === "NOTA_CREDITO" && (
              <span className="ml-2 px-2 py-0.5 rounded text-xs font-medium text-white bg-teal-600">
                Nota de crédito
              </span>
            )}
          </DetailRow>
          <DetailRow label="Clasificación">
            {movement.movement_kind === "FIJO" ? "Fijo" : "Única vez"}
            {movement.invoice_payment_pending && (
              <span className="ml-2 text-xs text-amber-700">· Pendiente de pago</span>
            )}
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
          {movement.income_category === "NOTA_CREDITO" && (
            <>
              <DetailRow label="N° nota de crédito">
                {movement.credit_note_number || "-"}
              </DetailRow>
              <DetailRow label="Factura asociada">
                {movement.credit_note_invoice_number
                  ? utils.formatInvoiceNumber(movement.credit_note_invoice_number)
                  : "-"}
              </DetailRow>
              {movement.supplier_name && (
                <DetailRow label="Proveedor">{movement.supplier_name}</DetailRow>
              )}
            </>
          )}
          {movement.payment_method && (
            <DetailRow label="Forma de pago">
              {PAYMENT_METHOD_LABELS[movement.payment_method] ||
                movement.payment_method}
            </DetailRow>
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

        {hasEgresoSupplier && (
          <section className="flex flex-col gap-2.5 bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Proveedor
            </h3>
            {movement.supplier_name && (
              <DetailRow label="Proveedor">{movement.supplier_name}</DetailRow>
            )}
            {movement.expense_category === "SERVICIOS" && movement.invoice_number && (
              <DetailRow label="N° factura">{movement.invoice_number}</DetailRow>
            )}
          </section>
        )}

        {(movement.expense_category === "VEP" || movement.vep_id) && (
          <section className="flex flex-col gap-2.5 bg-violet-50 rounded-lg p-4 border border-violet-100">
            <h3 className="text-xs font-semibold text-violet-600 uppercase tracking-wide">
              VEP
            </h3>
            <DetailRow label="Clasificación">
              {movement.vep?.display_category ||
                movement.vep?.category ||
                movement.vep_label ||
                "—"}
            </DetailRow>
            {movement.vep?.due_date && (
              <DetailRow label="Vencimiento">
                {DateTime.fromISO(movement.vep.due_date).toFormat("dd/MM/yyyy")}
              </DetailRow>
            )}
            {movement.vep?.amount != null && (
              <DetailRow label="Importe VEP">
                {utils.formatAmount(movement.vep.amount)}
              </DetailRow>
            )}
            {movement.vep?.paid_at && (
              <DetailRow label="Estado">
                <span className="text-emerald-700 font-medium">Pagado</span>
              </DetailRow>
            )}
          </section>
        )}

        {/* Invoice section */}
        {hasFullInvoice && (
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
                {invoice.document_date && (
                  <DetailRow label="Fecha comprobante">
                    {DateTime.fromISO(invoice.document_date).toFormat("dd/MM/yyyy")}
                  </DetailRow>
                )}
                {invoice.taxes?.length > 0 && (
                  <DetailRow label="Impuestos">
                    {invoice.taxes
                      .map((t) => `${t.name || t.type}: ${utils.formatAmount(t.amount)}`)
                      .join(" · ")}
                  </DetailRow>
                )}
                {invoice.image_key && (
                  <DetailRow label="Comprobante">
                    {imageLoading ? (
                      <span className="text-xs text-slate-400">Cargando enlace...</span>
                    ) : imageError ? (
                      <span className="text-xs text-red-500">
                        No se pudo cargar la factura
                      </span>
                    ) : imageUrl ? (
                      <span className="inline-flex flex-wrap items-center gap-3">
                        <a
                          href={imageUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline"
                        >
                          Abrir factura
                          <ExternalLinkIcon className="h-3.5 w-3.5" />
                        </a>
                        <button
                          type="button"
                          onClick={() => setImagePreviewOpen(true)}
                          className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 hover:text-amber-950"
                        >
                          <Maximize2 className="h-3.5 w-3.5" />
                          Ver en grande
                        </button>
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Sin enlace disponible</span>
                    )}
                  </DetailRow>
                )}
              </>
            ) : (
              <p className="text-xs text-slate-500">Sin datos de factura cargados.</p>
            )}
          </section>
        )}

        {!hasFullInvoice && movement.image_key && (
          <section className="flex flex-col gap-2.5 bg-slate-50 rounded-lg p-4 border border-slate-100">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Comprobante adjunto
            </h3>
            {imageLoading && (
              <div className="py-3 flex justify-center">
                <Spinner />
              </div>
            )}
            {imageError && (
              <p className="text-xs text-red-500">No se pudo cargar el comprobante</p>
            )}
            {!imageLoading && !imageError && imageUrl && (
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => setImagePreviewOpen(true)}
                  className="group relative block w-fit max-w-full rounded-lg border border-slate-200 bg-white overflow-hidden hover:border-slate-300 transition-colors"
                  title="Ver en grande"
                >
                  {isPdf ? (
                    <div className="flex h-28 w-40 flex-col items-center justify-center gap-1 bg-slate-50 text-slate-500">
                      <span className="text-2xl font-bold text-red-600">PDF</span>
                      <span className="text-[10px] uppercase tracking-wide">
                        Comprobante
                      </span>
                    </div>
                  ) : (
                    <img
                      src={imageUrl}
                      alt="Miniatura del comprobante"
                      className="h-28 w-auto max-w-[11rem] object-cover object-top"
                    />
                  )}
                  <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/25 transition-colors">
                    <Maximize2 className="h-6 w-6 text-white opacity-0 group-hover:opacity-100 drop-shadow" />
                  </span>
                </button>
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => setImagePreviewOpen(true)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-slate-700 hover:text-slate-900"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                    Ver en grande
                  </button>
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                  >
                    Abrir en nueva pestaña
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            )}
          </section>
        )}

        {hasFullInvoice && retentionInvoice && (
          <InvoiceRetentionSection
            invoice={retentionInvoice}
            enabled={open}
            className="mt-0 border-t-0 pt-0"
          />
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
                  className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2.5 text-sm"
                >
                  <div className="flex flex-col gap-0.5 min-w-0">
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
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-semibold text-slate-700 text-sm tabular-nums">
                      {utils.formatAmount(po.amount)}
                    </span>
                    <button
                      type="button"
                      onClick={() => openPaymentOrderView(po)}
                      className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-800 hover:bg-emerald-100 transition-colors"
                      title="Ver orden de pago"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      Ver
                    </button>
                    {canCancelPaymentOrders && (
                      <button
                        type="button"
                        onClick={() => onRequestCancelPaymentOrder(po)}
                        disabled={isCancellingPaymentOrder}
                        className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-[11px] font-medium text-red-700 hover:bg-red-100 transition-colors disabled:opacity-50"
                        title="Eliminar orden de pago"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Eliminar
                      </button>
                    )}
                  </div>
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

      <PaymentOrderViewDialog
        open={poViewOpen}
        onOpenChange={setPoViewOpen}
        order={selectedPaymentOrder}
        supplierName={movement.supplier_name || null}
        invoiceNumber={invoice?.invoice_number || null}
      />

      <Dialog open={imagePreviewOpen} onOpenChange={setImagePreviewOpen}>
        <DialogContent className="w-[98vw] max-w-6xl max-h-[96vh] overflow-hidden p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-2 shrink-0">
            <DialogTitle className="text-base font-semibold text-slate-800">
              Comprobante de factura
              {invoice?.invoice_number
                ? ` · ${utils.formatInvoiceNumber(invoice.invoice_number)}`
                : ""}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {imageUrl && (
                <a
                  href={imageUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
                >
                  Nueva pestaña
                  <ExternalLinkIcon className="h-4 w-4" />
                </a>
              )}
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-sm"
                onClick={() => setImagePreviewOpen(false)}
              >
                Cerrar
              </button>
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-auto rounded-lg border border-slate-200 bg-slate-50">
            {isPdf ? (
              <iframe
                title="Factura PDF"
                src={imageUrl}
                className="w-full h-[min(80vh,900px)] bg-white"
              />
            ) : (
              <img
                src={imageUrl}
                alt="Factura ampliada"
                className="w-full h-auto max-h-[min(80vh,900px)] object-contain mx-auto"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
