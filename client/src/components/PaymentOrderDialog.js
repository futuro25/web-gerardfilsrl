import { useEffect, useMemo } from "react";
import { useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { fetchSupplierInvoiceByAccountMovement } from "../apis/api.supplierinvoices";
import {
  fetchNextOrderNumber,
  createPaymentOrder,
} from "../apis/api.paymentorders";
import {
  querySupplierInvoiceByMovementKey,
  queryPaymentOrdersNextNumberKey,
  queryPaymentOrdersByMovementKey,
} from "../apis/queryKeys";

const PAYMENT_METHODS = [
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA DE CREDITO", label: "Tarjeta de crédito" },
  { value: "TARJETA DE DEBITO", label: "Tarjeta de débito" },
];

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

  // Item normalizado para crear la orden, sin importar el origen.
  const item = useMemo(() => {
    if (pendingItem) return pendingItem;
    if (!movement) return null;
    return {
      source: "control",
      supplier_invoice_id: fetchedInvoice?.id || null,
      cashflow_id: null,
      source_movement_id: movement.id || null,
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
      date: movement.date || null,
    };
  }, [pendingItem, movement, fetchedInvoice]);

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
      cheque_due_date: "",
    },
  });

  const paymentMethod = watch("payment_method");
  const isCheque = paymentMethod === "CHEQUE";

  useEffect(() => {
    if (!open) return;
    reset({
      payment_method: "TRANSFERENCIA",
      payment_date: today,
      amount: item?.total ?? item?.amount ?? "",
      description: "",
      cheque_number: "",
      cheque_bank: "",
      cheque_due_date: "",
    });
  }, [open, item, reset]);

  const mutation = useMutation({ mutationFn: createPaymentOrder });

  const onSubmit = async (data) => {
    if (!item) return;
    try {
      const chequeData =
        data.payment_method === "CHEQUE"
          ? {
              cheque_number: data.cheque_number,
              cheque_bank: data.cheque_bank,
              cheque_due_date: data.cheque_due_date,
            }
          : {};

      const result = await mutation.mutateAsync({
        supplier_invoice_id: item.supplier_invoice_id || null,
        cashflow_id: item.cashflow_id || null,
        supplier_id: item.supplier_id || null,
        payment_method: data.payment_method,
        amount: parseFloat(data.amount),
        description: data.description || null,
        payment_date: data.payment_date,
        source_movement_id: item.source_movement_id || null,
        ...chequeData,
      });

      if (result.error) {
        window.alert(result.error);
        return;
      }

      queryClient.invalidateQueries({
        queryKey: queryPaymentOrdersByMovementKey(movementId),
      });
      queryClient.invalidateQueries({
        queryKey: queryPaymentOrdersNextNumberKey(),
      });

      onCreated?.(result);
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      window.alert(e.message || "No se pudo crear la orden de pago");
    }
  };

  const loading = (needsInvoiceFetch && invoiceLoading) || numberLoading;
  const orderNumber = nextNumberData?.number ?? "—";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        <div>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Nueva Orden de Pago
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            Se generará un movimiento de conciliación en el módulo de control.
          </p>
        </div>

        {loading ? (
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

            {/* Payment method */}
            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">
                Forma de pago
              </label>
              <select
                className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                {...register("payment_method", { required: "Seleccione la forma de pago" })}
              >
                {PAYMENT_METHODS.map((m) => (
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
                <Input
                  label="Fecha de vencimiento"
                  type="date"
                  {...register("cheque_due_date", {
                    required: isCheque
                      ? "Ingrese la fecha de vencimiento"
                      : false,
                  })}
                  intent={errors.cheque_due_date ? "danger" : "default"}
                  helperText={errors.cheque_due_date?.message}
                />
              </div>
            )}

            {/* Amount */}
            <Input
              label="Monto"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", {
                required: "Ingrese el monto",
                min: { value: 0.01, message: "El monto debe ser mayor a 0" },
              })}
              intent={errors.amount ? "danger" : "default"}
              helperText={errors.amount?.message}
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

            <div className="flex gap-2 pt-1">
              <Button
                type="submit"
                variant="default"
                className="flex-1"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Guardando..." : "Crear Orden de Pago"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                className="flex-1"
                onClick={() => onOpenChange(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
