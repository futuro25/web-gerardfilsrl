import { forwardRef, useEffect, useImperativeHandle } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { Input } from "./common/Input";
import * as utils from "../utils/utils";

export const PAYMENT_METHOD_OPTIONS = [
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "CHEQUE", label: "Cheque" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TARJETA DE CREDITO", label: "Tarjeta de crédito" },
  { value: "DEBITO AUTOMATICO", label: "Débito automático" },
  { value: "NOTA DE CREDITO", label: "Nota de crédito" },
];

export const PAYMENT_METHOD_LABELS = {
  ...Object.fromEntries(PAYMENT_METHOD_OPTIONS.map((m) => [m.value, m.label])),
  "TARJETA DE DEBITO": "Débito automático",
};

const today = DateTime.now().toFormat("yyyy-MM-dd");

const PaymentOrderFields = forwardRef(function PaymentOrderFields(
  {
    variant = "payment_order",
    defaultAmount = "",
    defaultDescription = "",
    defaultPaymentMethod = "TRANSFERENCIA",
    defaultChequeNumber = "",
    defaultChequeBank = "",
    defaultChequeDueDate = "",
    defaultPaymentDate = "",
    defaultCreditNoteNumber = "",
    showErrors = false,
  },
  ref
) {
  const isEgresoVariant = variant === "egreso";
  const {
    register,
    watch,
    reset,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: {
      payment_method: "TRANSFERENCIA",
      payment_date: today,
      amount: defaultAmount ? String(defaultAmount) : "",
      description: defaultDescription || "",
      cheque_number: "",
      cheque_bank: "",
      credit_note_number: "",
    },
  });

  const paymentMethod = watch("payment_method");
  const isCheque = paymentMethod === "CHEQUE";
  const isCreditNote = paymentMethod === "NOTA DE CREDITO";

  useEffect(() => {
    const resolvedPaymentDate =
      defaultPaymentDate ||
      defaultChequeDueDate ||
      today;
    reset({
      payment_method: defaultPaymentMethod || "TRANSFERENCIA",
      payment_date: resolvedPaymentDate,
      amount: defaultAmount ? String(defaultAmount) : "",
      description: defaultDescription || "",
      cheque_number: defaultChequeNumber || "",
      cheque_bank: defaultChequeBank || "",
      credit_note_number: defaultCreditNoteNumber || "",
    });
  }, [
    defaultAmount,
    defaultDescription,
    defaultPaymentMethod,
    defaultChequeNumber,
    defaultChequeBank,
    defaultChequeDueDate,
    defaultPaymentDate,
    defaultCreditNoteNumber,
    reset,
  ]);

  useImperativeHandle(ref, () => ({
    async validate() {
      const ok = await trigger();
      if (!ok) {
        return {
          ok: false,
          message: isEgresoVariant
            ? "Revise la forma de pago"
            : "Revise los datos de la orden de pago",
        };
      }
      const data = getValues();
      if (!data.payment_method) {
        return { ok: false, message: "Seleccione la forma de pago" };
      }
      if (!isEgresoVariant) {
        if (!data.amount || parseFloat(data.amount) <= 0) {
          return { ok: false, message: "Ingrese el monto de pago" };
        }
        if (!data.payment_date) {
          return { ok: false, message: "Ingrese la fecha de pago" };
        }
      }
      if (data.payment_method === "CHEQUE") {
        if (!data.cheque_number || !data.cheque_bank) {
          return {
            ok: false,
            message: "Complete los datos del cheque",
          };
        }
        if (isEgresoVariant && !data.payment_date) {
          return { ok: false, message: "Ingrese la fecha de pago" };
        }
      }
      return { ok: true };
    },
    getPayload() {
      const data = getValues();
      const chequeData =
        data.payment_method === "CHEQUE"
          ? {
              cheque_number: data.cheque_number,
              cheque_bank: data.cheque_bank,
              cheque_due_date: data.payment_date,
            }
          : {};
      const creditNoteData =
        data.payment_method === "NOTA DE CREDITO"
          ? {
              credit_note_number: data.credit_note_number?.trim() || null,
            }
          : {};
      if (isEgresoVariant) {
        return {
          payment_method: data.payment_method,
          is_cheque: data.payment_method === "CHEQUE",
          payment_date: data.payment_date || null,
          ...chequeData,
          ...creditNoteData,
        };
      }
      return {
        payment_method: data.payment_method,
        amount: parseFloat(data.amount),
        description: data.description || null,
        payment_date: data.payment_date,
        ...chequeData,
        ...creditNoteData,
      };
    },
    reset,
  }));

  return (
    <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
      <h3 className="text-sm font-semibold text-slate-800">
        {isEgresoVariant ? "Forma de pago" : "Orden de pago"}
      </h3>
      <p className="text-xs text-slate-500 -mt-2">
        {isEgresoVariant
          ? "Indicá cómo se realizó este egreso."
          : "Indicá cómo se pagó la factura. Se registrará el egreso de caja al confirmar."}
      </p>

      <div>
        <label className="text-xs font-sans text-gray-900 mb-2 block">
          Forma de pago <span className="text-red-500">*</span>
        </label>
        <select
          className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
          {...register("payment_method", { required: true })}
        >
          {PAYMENT_METHOD_OPTIONS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
        {showErrors && errors.payment_method && (
          <p className="text-sm text-red-500 pt-1">Seleccione la forma de pago</p>
        )}
      </div>

      {isCreditNote && (
        <div className="grid grid-cols-1 gap-3 border border-violet-100 bg-violet-50/60 rounded-lg p-3">
          <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">
            Nota de crédito
          </p>
          <Input
            label="Número de nota de crédito (opcional)"
            type="text"
            placeholder="Ej: A-0001-00000123"
            {...register("credit_note_number")}
          />
        </div>
      )}

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
            {showErrors && errors.cheque_bank && (
              <p className="text-sm text-red-500 pt-1">{errors.cheque_bank.message}</p>
            )}
          </div>
          {isEgresoVariant && (
            <Input
              label="Fecha de pago"
              type="date"
              {...register("payment_date", {
                required: isCheque ? "Ingrese la fecha de pago" : false,
              })}
              intent={errors.payment_date ? "danger" : "default"}
              helperText={errors.payment_date?.message}
            />
          )}
        </div>
      )}

      {!isEgresoVariant && (
        <>
          <Input
            label="Monto de pago"
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

          <Input
            label="Descripción (opcional)"
            type="text"
            placeholder="Ej: Pago factura A-0001-00000123"
            {...register("description")}
          />

          <Input
            label="Fecha de pago"
            type="date"
            {...register("payment_date", { required: "Ingrese la fecha de pago" })}
            intent={errors.payment_date ? "danger" : "default"}
            helperText={errors.payment_date?.message}
          />
        </>
      )}
    </div>
  );
});

export default PaymentOrderFields;
