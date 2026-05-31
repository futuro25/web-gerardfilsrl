import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { ExternalLinkIcon, UploadIcon, Receipt, FileText } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Spinner from "./common/Spinner";
import Button from "./common/Button";
import PaymentOrderDialog from "./PaymentOrderDialog";
import RetentionCertificateDialog from "./RetentionCertificateDialog";
import { fetchInvoiceImageUrl, uploadInvoiceImage } from "../apis/api.uploads";
import { setSupplierInvoiceImage } from "../apis/api.supplierinvoices";
import { fetchRetentionByInvoice } from "../apis/api.retentioncertificates";
import {
  queryInvoiceImageUrlKey,
  querySupplierInvoicesListKey,
  querySupplierAccountsListKey,
  queryPendingPaymentItemsKey,
  queryPaymentOrdersNextNumberKey,
  queryRetentionByInvoiceKey,
} from "../apis/queryKeys";
import * as utils from "../utils/utils";

const PAYMENT_METHOD_LABELS = {
  TRANSFERENCIA: "Transferencia",
  CHEQUE: "Cheque",
  EFECTIVO: "Efectivo",
  "TARJETA DE CREDITO": "Tarjeta de crédito",
  "TARJETA DE DEBITO": "Tarjeta de débito",
};

const SOURCE_LABELS = { control: "Control", cashflow: "Cashflow" };

function Row({ label, value }) {
  return (
    <div className="flex justify-between gap-4 py-1.5 border-b border-slate-100 last:border-b-0">
      <span className="text-xs text-slate-400 uppercase tracking-wide">
        {label}
      </span>
      <span className="text-sm text-slate-700 font-medium text-right">
        {value}
      </span>
    </div>
  );
}

export default function PurchaseInvoiceDetailDialog({
  open,
  onOpenChange,
  invoice,
}) {
  const queryClient = useQueryClient();
  const [imageKey, setImageKey] = useState(invoice?.image_key || null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);

  useEffect(() => {
    setImageKey(invoice?.image_key || null);
    setUploadError(null);
  }, [invoice]);

  const isControl =
    invoice?.source === "control" || !!invoice?.supplier_invoice_id;
  const existingOrder = invoice?.payment_order || null;

  const retentionSupplierId =
    invoice?.supplier_id ?? invoice?.supplier?.id ?? null;
  const retentionAmount = invoice?.total ?? invoice?.amount ?? null;
  const retentionDate = invoice?.date || null;

  const { data: retentionRes, isLoading: retentionLoading } = useQuery({
    queryKey: queryRetentionByInvoiceKey(
      `${invoice?.invoice_number || ""}|${retentionAmount || ""}`,
      retentionSupplierId
    ),
    queryFn: () =>
      fetchRetentionByInvoice({
        invoiceNumber: invoice.invoice_number,
        supplierId: retentionSupplierId,
        amount: retentionAmount,
        date: retentionDate,
      }),
    enabled: open && (!!retentionSupplierId || !!invoice?.invoice_number),
  });

  const retentionPayment = retentionRes?.data?.payment || null;
  const retentionCertificate = retentionRes?.data?.certificate || null;

  const pendingItem = useMemo(() => {
    if (!invoice) return null;
    return {
      source: invoice.source || "control",
      supplier_invoice_id: invoice.supplier_invoice_id || null,
      cashflow_id: invoice.cashflow_id || null,
      source_movement_id: invoice.source_movement_id || null,
      supplier_id: invoice.supplier_id || invoice.supplier?.id || null,
      supplier_name:
        invoice.supplier?.fantasy_name ||
        invoice.supplier?.name ||
        invoice.supplier_name ||
        null,
      invoice_number: invoice.invoice_number || null,
      amount: invoice.amount,
      total: invoice.total ?? invoice.amount,
      date: invoice.date || invoice.created_at?.slice?.(0, 10) || null,
    };
  }, [invoice]);

  const openPaymentOrder = () => {
    queryClient.invalidateQueries({
      queryKey: queryPaymentOrdersNextNumberKey(),
    });
    setPayOpen(true);
    onOpenChange(false);
  };

  const onOrderCreated = () => {
    queryClient.invalidateQueries({ queryKey: querySupplierInvoicesListKey() });
    queryClient.invalidateQueries({ queryKey: querySupplierAccountsListKey() });
    queryClient.invalidateQueries({ queryKey: queryPendingPaymentItemsKey() });
    queryClient.invalidateQueries({ queryKey: ["account-movements"] });
    queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
  };

  const {
    data: imageRes,
    isLoading: imageLoading,
    isError: imageError,
  } = useQuery({
    queryKey: queryInvoiceImageUrlKey(imageKey),
    queryFn: () => fetchInvoiceImageUrl(imageKey),
    enabled: open && !!imageKey,
  });

  const handleUpload = async (file) => {
    if (!file || !invoice?.supplier_invoice_id) return;
    setUploadError(null);
    setUploading(true);
    try {
      const uploadRes = await uploadInvoiceImage(file);
      const newKey = uploadRes?.key;
      await setSupplierInvoiceImage(invoice.supplier_invoice_id, newKey);
      setImageKey(newKey);
      queryClient.invalidateQueries({
        queryKey: querySupplierInvoicesListKey(),
      });
    } catch (e) {
      console.error(e);
      setUploadError(e.message || "No se pudo subir la imagen");
    } finally {
      setUploading(false);
    }
  };

  const imageUrl = imageRes?.url || null;
  const isPdf = imageKey && /\.pdf$/i.test(imageKey);

  if (!invoice) return null;

  const supplierName =
    invoice.supplier?.fantasy_name ||
    invoice.supplier?.name ||
    invoice.supplier_name ||
    "—";

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl">
        <DialogTitle className="text-lg font-bold text-slate-800 mb-4">
          Detalle de factura
        </DialogTitle>

        <div className="flex flex-col gap-1 mb-4">
          <Row label="Proveedor" value={supplierName} />
          <Row
            label="N° Factura"
            value={
              invoice.invoice_number
                ? utils.formatInvoiceNumber(invoice.invoice_number)
                : "Sin N°"
            }
          />
          <Row
            label="Fecha"
            value={
              invoice.date
                ? DateTime.fromISO(invoice.date).toFormat("dd/MM/yyyy")
                : "—"
            }
          />
          <Row
            label="Origen"
            value={SOURCE_LABELS[invoice.source] || invoice.source || "—"}
          />
          <Row label="Descripción" value={invoice.description || "—"} />
          <Row label="Neto" value={utils.formatAmount(invoice.amount)} />
          {(invoice.taxes || []).map((t) => (
            <Row
              key={t.id || t.name}
              label={t.name}
              value={utils.formatAmount(t.amount)}
            />
          ))}
          <Row
            label="Total"
            value={utils.formatAmount(invoice.total || invoice.amount)}
          />
        </div>

        {isControl && (
        <div className="border-t border-slate-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 uppercase tracking-wide">
              Imagen de la factura
            </span>
            <label
              className={utils.cn(
                "inline-flex items-center gap-1 text-sm font-medium cursor-pointer text-blue-600 hover:underline",
                uploading && "opacity-50 pointer-events-none"
              )}
            >
              <UploadIcon className="h-4 w-4" />
              {imageKey ? "Cambiar imagen" : "Agregar imagen"}
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                disabled={uploading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  handleUpload(f);
                }}
              />
            </label>
          </div>

          {uploadError && (
            <div className="mb-2 rounded-lg border border-red-200 bg-red-50 p-2 text-center text-sm text-red-500">
              {uploadError}
            </div>
          )}

          {uploading && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500">
              <Spinner />
              Subiendo imagen…
            </div>
          )}

          {!uploading && !imageKey && (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-400">
              No hay imagen cargada para esta factura
            </div>
          )}

          {!uploading && imageKey && imageLoading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!uploading && imageKey && imageError && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-center text-sm text-red-500">
              No se pudo cargar la imagen
            </div>
          )}

          {!uploading && imageKey && imageUrl && !imageLoading && (
            <div className="flex flex-col gap-2">
              {isPdf ? (
                <iframe
                  title="Factura"
                  src={imageUrl}
                  className="w-full h-[60vh] rounded-lg border border-slate-200"
                />
              ) : (
                <a href={imageUrl} target="_blank" rel="noreferrer">
                  <img
                    src={imageUrl}
                    alt="Factura"
                    className="w-full max-h-[60vh] object-contain rounded-lg border border-slate-200 bg-slate-50"
                  />
                </a>
              )}
              <a
                href={imageUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline self-start"
              >
                Abrir en nueva pestaña
                <ExternalLinkIcon className="h-4 w-4" />
              </a>
            </div>
          )}
        </div>
        )}

        {/* Orden de pago */}
        <div className="border-t border-slate-100 pt-4 mt-4">
          <span className="text-xs text-slate-400 uppercase tracking-wide block mb-2">
            Orden de pago
          </span>

          {existingOrder ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">N° de orden</span>
                <span className="font-semibold text-emerald-700">
                  {existingOrder.order_number}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Forma de pago</span>
                <span className="font-medium text-slate-700">
                  {PAYMENT_METHOD_LABELS[existingOrder.payment_method] ||
                    existingOrder.payment_method}
                </span>
              </div>
              {existingOrder.cheque_number && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Cheque</span>
                  <span className="font-medium text-slate-700">
                    #{existingOrder.cheque_number} - {existingOrder.cheque_bank}
                    {existingOrder.cheque_due_date
                      ? ` (vto. ${DateTime.fromISO(
                          existingOrder.cheque_due_date
                        ).toFormat("dd/MM/yyyy")})`
                      : ""}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Fecha de pago</span>
                <span className="font-medium text-slate-700">
                  {existingOrder.payment_date
                    ? DateTime.fromISO(existingOrder.payment_date).toFormat(
                        "dd/MM/yyyy"
                      )
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Monto</span>
                <span className="font-semibold text-slate-800">
                  {utils.formatAmount(existingOrder.amount)}
                </span>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3">
              <span className="text-sm text-slate-400">
                Esta factura todavía no tiene orden de pago
              </span>
              <Button
                type="button"
                variant="default"
                size="sm"
                className="shrink-0"
                onClick={openPaymentOrder}
              >
                <Receipt className="h-4 w-4 mr-1" />
                Crear orden de pago
              </Button>
            </div>
          )}
        </div>

        {/* Retención */}
        <div className="border-t border-slate-100 pt-4 mt-4">
          <span className="text-xs text-slate-400 uppercase tracking-wide block mb-2">
            Retención
          </span>

          {retentionLoading ? (
            <div className="flex justify-center py-4">
              <Spinner />
            </div>
          ) : retentionPayment ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Estado</span>
                <span className="font-semibold text-violet-700">
                  Retención realizada
                </span>
              </div>
              {(retentionPayment.category_code ||
                retentionPayment.category_detail) && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Categoría</span>
                  <span className="font-medium text-slate-700 text-right">
                    {retentionPayment.category_code}
                    {retentionPayment.category_detail
                      ? ` - ${retentionPayment.category_detail}`
                      : ""}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Monto retenido</span>
                <span className="font-semibold text-slate-800">
                  {utils.formatAmount(retentionPayment.retention_amount)}
                </span>
              </div>
              {retentionPayment.total_to_pay != null && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Total a pagar</span>
                  <span className="font-medium text-slate-700">
                    {utils.formatAmount(retentionPayment.total_to_pay)}
                  </span>
                </div>
              )}
              {retentionCertificate?.certificate_number && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Certificado</span>
                  <span className="font-medium text-slate-700">
                    {retentionCertificate.certificate_number}
                  </span>
                </div>
              )}
              <div className="pt-1">
                <Button
                  type="button"
                  variant="outlined"
                  size="sm"
                  onClick={() => setCertOpen(true)}
                >
                  <FileText className="h-4 w-4 mr-1" />
                  Ver comprobante
                </Button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3 text-sm text-amber-700">
              No hay retención registrada para esta factura. Verificá si
              corresponde practicarle retención.
            </div>
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

    <PaymentOrderDialog
      open={payOpen}
      onOpenChange={setPayOpen}
      pendingItem={pendingItem}
      onCreated={onOrderCreated}
    />

    <RetentionCertificateDialog
      open={certOpen}
      onOpenChange={setCertOpen}
      certificate={retentionCertificate}
      payment={retentionPayment}
    />
    </>
  );
}
