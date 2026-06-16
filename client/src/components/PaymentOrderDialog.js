import { useEffect, useMemo, useRef } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import Button from "./common/Button";
import FormActions from "./common/FormActions";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { fetchSupplierInvoiceByAccountMovement } from "../apis/api.supplierinvoices";
import {
  fetchNextOrderNumber,
  createPaymentOrder,
  fetchPaymentOrdersByMovement,
  fetchPaymentOrdersByInvoice,
} from "../apis/api.paymentorders";
import { fetchRetentionByInvoice } from "../apis/api.retentioncertificates";
import {
  querySupplierInvoiceByMovementKey,
  queryPaymentOrdersNextNumberKey,
  queryPaymentOrdersByMovementKey,
  queryPaymentOrdersByInvoiceKey,
  queryPendingPaymentItemsKey,
  queryPurchaseInvoicesKey,
  querySupplierAccountsListKey,
  queryRetentionByInvoiceKey,
} from "../apis/queryKeys";
import { retentionLookupParams, invoiceSupportsRetention } from "../utils/retentionInvoice";
import { PAYMENT_METHOD_OPTIONS } from "./PaymentOrderFields";

const today = DateTime.now().toFormat("yyyy-MM-dd");

const SOURCE_LABELS = {
  control: "Control",
  cashflow: "Cashflow",
};

export default function PaymentOrderDialog({
  open,
  onOpenChange,
  pendingItem,
  movement,
  onCreated,
}) {
  const queryClient = useQueryClient();
  const movementId = movement?.id;

  // En el flujo desde Control (sin pendingItem), la factura se busca por movimiento.
  const needsInvoiceFetch = open && Boolean(movementId) && !pendingItem;

  const { data: invoiceData, isLoading: invoiceLoading } = useQuery({
    queryKey: querySupplierInvoiceByMovementKey(movementId),
    queryFn: () => fetchSupplierInvoiceByAccountMovement(movementId),
    enabled: needsInvoiceFetch,
  });

  const { data: nextNumberData, isLoading: numberLoading } = useQuery({
    queryKey: queryPaymentOrdersNextNumberKey(),
    queryFn: fetchNextOrderNumber,
    enabled: open,
    staleTime: 0,
  });

  const fetchedInvoice =
    invoiceData && !invoiceData.error ? invoiceData : null;

  // Item normalizado para crear la orden desde Control.
  const item = useMemo(() => {
    if (pendingItem) {
      if (pendingItem.source !== "control") return null;
      return pendingItem;
    }
    if (!movement) return null;
    return {
      source: "control",
      supplier_invoice_id: fetchedInvoice?.id || null,
      cashflow_id: null,
      account_movement_id: movement.id || null,
      supplier_id:
        fetchedInvoice?.supplier_id || fetchedInvoice?.supplier?.id || null,
      supplier_name:
        movement.supplier_name ||
        fetchedInvoice?.supplier?.fantasy_name ||
        fetchedInvoice?.supplier?.name ||
        null,
      invoice_number: fetchedInvoice?.invoice_number || null,
      amount: fetchedInvoice?.amount ?? movement.amount ?? "",
      total: fetchedInvoice?.total ?? fetchedInvoice?.amount ?? movement.amount ?? "",
      date:
        fetchedInvoice?.document_date ||
        movement.date ||
        null,
    };
  }, [pendingItem, movement, fetchedInvoice]);

  const ordersMovementId = item?.account_movement_id || movementId || null;
  const ordersInvoiceId = item?.supplier_invoice_id || null;

  const { data: ordersRes, isLoading: ordersLoading } = useQuery({
    queryKey: ordersMovementId
      ? queryPaymentOrdersByMovementKey(ordersMovementId)
      : queryPaymentOrdersByInvoiceKey(ordersInvoiceId),
    queryFn: () =>
      ordersMovementId
        ? fetchPaymentOrdersByMovement(ordersMovementId)
        : fetchPaymentOrdersByInvoice(ordersInvoiceId),
    enabled: open && Boolean(ordersMovementId || ordersInvoiceId),
  });

  const existingOrders = ordersRes?.data || [];
  const paidSoFar = existingOrders.reduce(
    (acc, o) => acc + (parseFloat(o.amount) || 0),
    0
  );

  const supportsRetention = invoiceSupportsRetention(item?.invoice_number);

  const retentionLookup = useMemo(
    () =>
      retentionLookupParams({
        supplier_invoice_id: item?.supplier_invoice_id,
        account_movement_id: item?.account_movement_id || movementId,
        invoice_number: item?.invoice_number,
        supplier_id: item?.supplier_id,
        total: item?.total,
        amount: item?.amount,
        date: item?.date,
      }),
    [item, movementId]
  );

  const { data: retentionRes, isLoading: retentionLoading } = useQuery({
    queryKey: queryRetentionByInvoiceKey(retentionLookup),
    queryFn: () => fetchRetentionByInvoice(retentionLookup),
    enabled:
      supportsRetention &&
      open &&
      Boolean(item?.supplier_invoice_id || item?.account_movement_id || movementId),
  });

  const retentionPayment = retentionRes?.data?.payment || null;
  const invoiceTotal =
    parseFloat(item?.total ?? item?.amount ?? "") || 0;
  const remainingAmount = Math.max(0, Math.round((invoiceTotal - paidSoFar) * 100) / 100);
  const fullyPaid = remainingAmount <= 0.009;
  const suggestedPayAmount =
    retentionPayment?.total_to_pay != null && paidSoFar <= 0.009
      ? Math.min(parseFloat(retentionPayment.total_to_pay), remainingAmount)
      : remainingAmount;

  const itemKey =
    item?.supplier_invoice_id ?? item?.account_movement_id ?? "";

  const retentionStillLoading =
    supportsRetention &&
    Boolean(item?.supplier_invoice_id || item?.account_movement_id || movementId) &&
    retentionLoading;

  const loading =
    (needsInvoiceFetch && invoiceLoading) ||
    numberLoading ||
    ordersLoading ||
    retentionStillLoading;

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    defaultValues: {
      payment_method: "TRANSFERENCIA",
      payment_date: today,
      amount: "",
      description: "",
      cheque_number: "",
      cheque_bank: "",
    },
  });

  const paymentMethod = watch("payment_method");
  const isCheque = paymentMethod === "CHEQUE";
  const formInitializedFor = useRef(null);

  useEffect(() => {
    if (!open) {
      formInitializedFor.current = null;
      return;
    }
    if (loading) return;

    const initKey = String(itemKey);
    if (formInitializedFor.current === initKey) return;
    formInitializedFor.current = initKey;

    reset({
      payment_method: "TRANSFERENCIA",
      payment_date: today,
      amount: suggestedPayAmount > 0 ? suggestedPayAmount : "",
      description: "",
      cheque_number: "",
      cheque_bank: "",
    });
  }, [open, loading, itemKey, reset, suggestedPayAmount]);

  const mutation = useMutation({ mutationFn: createPaymentOrder });

  const onSubmit = async (data) => {
    if (!item) return;
    const payAmount = parseFloat(data.amount);
    if (payAmount > remainingAmount + 0.009) {
      window.alert(
        `El monto no puede superar el saldo pendiente (${utils.formatAmount(remainingAmount)})`
      );
      return;
    }
    try {
      const chequeData =
        data.payment_method === "CHEQUE"
          ? {
              cheque_number: data.cheque_number,
              cheque_bank: data.cheque_bank,
              cheque_due_date: data.payment_date,
            }
          : {};

      const result = await mutation.mutateAsync({
        supplier_invoice_id: item.supplier_invoice_id || null,
        supplier_id: item.supplier_id || null,
        payment_method: data.payment_method,
        amount: parseFloat(data.amount),
        description: data.description || null,
        payment_date: data.payment_date,
        account_movement_id: item.account_movement_id || movementId || null,
        ...chequeData,
      });

      if (result.error) {
        window.alert(result.error);
        return;
      }

      queryClient.invalidateQueries({
        queryKey: ordersMovementId
          ? queryPaymentOrdersByMovementKey(ordersMovementId)
          : queryPaymentOrdersByInvoiceKey(ordersInvoiceId),
      });
      queryClient.invalidateQueries({
        queryKey: queryPaymentOrdersNextNumberKey(),
      });
      queryClient.invalidateQueries({ queryKey: queryPendingPaymentItemsKey() });
      queryClient.invalidateQueries({ queryKey: queryPurchaseInvoicesKey() });
      queryClient.invalidateQueries({ queryKey: querySupplierAccountsListKey() });
      queryClient.invalidateQueries({ queryKey: ["account-movements"] });
      queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });

      onCreated?.(result);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      window.alert(e.message || "No se pudo crear la orden de pago");
    }
  };

  const orderNumber = nextNumberData?.number ?? "—";
  const missingInvoice =
    movement && !pendingItem && needsInvoiceFetch && !invoiceLoading && !fetchedInvoice;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        <div>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Nueva Orden de Pago
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            Registrá cómo se pagó la factura. Se actualizará el movimiento en Control
            y se creará la orden de pago.
          </p>
        </div>

        {fullyPaid ? (
          <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg p-4">
            Esta factura ya está saldada con órdenes de pago.
          </p>
        ) : missingInvoice ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
            Primero cargá los datos de la factura en el movimiento antes de crear
            la orden de pago.
          </p>
        ) : !item ? (
          <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-4">
            Las órdenes de pago solo se crean desde Control.
          </p>
        ) : loading ? (
          <div className="py-8 flex justify-center">
            <Spinner />
          </div>
        ) : (
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
            {/* Order number */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
              <span className="text-xs text-slate-500 uppercase tracking-wide">
                N° de orden
              </span>
              <span className="text-lg font-bold text-slate-800">{orderNumber}</span>
            </div>

            {/* Invoice / Supplier summary */}
            {item && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex flex-col gap-1.5">
                {item.supplier_name && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Proveedor</span>
                    <span className="font-medium text-slate-700">
                      {item.supplier_name}
                    </span>
                  </div>
                )}
                {item.invoice_number && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Factura</span>
                    <span className="font-medium text-slate-700">
                      {item.invoice_number}
                    </span>
                  </div>
                )}
                {item.source && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Origen</span>
                    <span className="font-medium text-slate-700">
                      {SOURCE_LABELS[item.source] || item.source}
                    </span>
                  </div>
                )}
                {item.date && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Fecha factura</span>
                    <span className="font-medium text-slate-700">
                      {DateTime.fromISO(item.date).toFormat("dd/MM/yyyy")}
                    </span>
                  </div>
                )}
              </div>
            )}

            {existingOrders.length > 0 && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 flex flex-col gap-2">
                <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                  Pagos registrados
                </p>
                {existingOrders.map((o) => (
                  <div
                    key={o.id}
                    className="flex justify-between text-sm text-slate-700"
                  >
                    <span>{o.order_number || "OP"}</span>
                    <span className="font-medium">
                      {utils.formatAmount(o.amount)}
                    </span>
                  </div>
                ))}
                <div className="border-t border-slate-200 pt-2 flex flex-col gap-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Total factura</span>
                    <span>{utils.formatAmount(invoiceTotal)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Pagado</span>
                    <span className="text-emerald-700 font-medium">
                      {utils.formatAmount(paidSoFar)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 text-xs">Saldo pendiente</span>
                    <span className="text-amber-800 font-semibold">
                      {utils.formatAmount(remainingAmount)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {supportsRetention && !retentionLoading && retentionPayment && (
              <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1.5">
                <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
                  Retención registrada
                </p>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Monto retenido</span>
                  <span className="font-semibold text-slate-800">
                    {utils.formatAmount(retentionPayment.retention_amount)}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 text-xs">Neto a pagar</span>
                  <span className="font-semibold text-violet-800">
                    {utils.formatAmount(retentionPayment.total_to_pay)}
                  </span>
                </div>
                <p className="text-[11px] text-violet-700">
                  Se sugiere el neto después de retención como monto inicial. Podés
                  modificarlo para pagos parciales.
                </p>
              </div>
            )}

            {supportsRetention &&
              !retentionLoading &&
              !retentionPayment &&
              item?.supplier_invoice_id && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                No hay retención registrada para esta factura. Si corresponde,
                registrá la retención desde el detalle del movimiento antes de
                crear la orden de pago.
              </div>
            )}

            {/* Payment method */}
            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">
                Forma de pago
              </label>
              <select
                className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                {...register("payment_method", { required: "Seleccione la forma de pago" })}
              >
                {PAYMENT_METHOD_OPTIONS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
              {errors.payment_method && (
                <p className="text-sm text-red-500 pt-1">
                  {errors.payment_method.message}
                </p>
              )}
            </div>

            {/* Cheque data (solo si la forma de pago es CHEQUE) */}
            {isCheque && (
              <div className="grid grid-cols-1 gap-3 border border-blue-100 bg-blue-50/60 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">
                  Datos del cheque
                </p>
                <Input
                  label="Número de cheque"
                  type="text"
                  placeholder="Número"
                  {...register("cheque_number", {
                    required: isCheque ? "Ingrese el número de cheque" : false,
                  })}
                  intent={errors.cheque_number ? "danger" : "default"}
                  helperText={errors.cheque_number?.message}
                />
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Banco
                  </label>
                  <select
                    className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                    {...register("cheque_bank", {
                      required: isCheque ? "Seleccione el banco" : false,
                    })}
                  >
                    <option value="">Seleccionar...</option>
                    {utils.getBanks().map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                  {errors.cheque_bank && (
                    <p className="text-sm text-red-500 pt-1">
                      {errors.cheque_bank.message}
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Amount */}
            <Input
              label={
                retentionPayment && paidSoFar <= 0.009
                  ? "Monto (sugerido: neto después de retención)"
                  : "Monto (pago parcial permitido)"
              }
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", {
                required: "Ingrese el monto",
                min: { value: 0.01, message: "El monto debe ser mayor a 0" },
                max: {
                  value: remainingAmount,
                  message: `No puede superar ${utils.formatAmount(remainingAmount)}`,
                },
              })}
              intent={errors.amount ? "danger" : "default"}
              helperText={
                errors.amount?.message ||
                (remainingAmount < invoiceTotal
                  ? `Saldo pendiente: ${utils.formatAmount(remainingAmount)}. Podés pagar un monto menor.`
                  : retentionPayment && invoiceTotal > 0
                    ? `Total factura: ${utils.formatAmount(invoiceTotal)}. Neto sugerido: ${utils.formatAmount(suggestedPayAmount)}.`
                    : `Máximo: ${utils.formatAmount(remainingAmount)}`)
              }
            />

            {/* Description */}
            <Input
              label="Descripción (opcional)"
              type="text"
              placeholder="Ej: Pago factura A-0001-00000123"
              {...register("description")}
            />

            {/* Created at */}
            <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded px-3 py-2">
              <span className="text-xs text-slate-400">Fecha de creación</span>
              <span className="text-sm text-slate-600">
                {DateTime.now().toFormat("dd/MM/yyyy")}
              </span>
            </div>

            {/* Payment date */}
            <Input
              label="Fecha de pago"
              type="date"
              {...register("payment_date", { required: "Ingrese la fecha de pago" })}
              intent={errors.payment_date ? "danger" : "default"}
              helperText={errors.payment_date?.message}
            />

            <FormActions
              className="pt-1"
              equalWidth
              onCancel={() => onOpenChange(false)}
              isLoading={isSubmitting}
              disabled={!item?.supplier_invoice_id}
              submitLabel="Crear Orden de Pago"
            />
          </form>
        )}
        {(fullyPaid || missingInvoice || !item) && (
          <div className="flex justify-end pt-2">
            <Button type="button" variant="outlined" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
