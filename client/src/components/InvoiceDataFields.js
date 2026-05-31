import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ExternalLinkIcon } from "lucide-react";
import { DateTime } from "luxon";
import { Input } from "./common/Input";
import Button from "./common/Button";
import SelectComboBox from "./common/SelectComboBox";
import Spinner from "./common/Spinner";
import SupplierQuickCreateDialog from "./SupplierQuickCreateDialog";
import * as utils from "../utils/utils";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { fetchSupplierInvoiceByAccountMovement } from "../apis/api.supplierinvoices";
import {
  querySupplierInvoiceByMovementKey,
  querySuppliersKey,
} from "../apis/queryKeys";

export function getInvoiceTotalAmount(taxes, amount) {
  const totalTaxes = taxes?.reduce((acc, tax) => {
    const taxValue = parseFloat(tax.value) || 0;
    return acc + taxValue;
  }, 0);
  return (parseFloat(amount) || 0) + (totalTaxes || 0);
}

export function splitInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return { letter: "A", first4: "", last8: "" };
  const letter = invoiceNumber.charAt(0);
  const numbers = invoiceNumber.slice(1);
  return {
    letter: letter || "A",
    first4: numbers.slice(0, 4),
    last8: numbers.slice(4),
  };
}

const InvoiceDataFields = forwardRef(function InvoiceDataFields(
  {
    accountMovement,
    movementDate,
    movementAmount,
    movementDescription,
    enabled = true,
    showErrors = false,
    required = false,
  },
  ref
) {
  const movementId = accountMovement?.id;

  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const [amountWithTaxes, setAmountWithTaxes] = useState(0);
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [withoutInvoice, setWithoutInvoice] = useState(false);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [active, setActive] = useState(required);

  const {
    register,
    reset,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm();

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled,
  });

  const { data: linkedInvoice, isLoading: invoiceLoading } = useQuery({
    queryKey: querySupplierInvoiceByMovementKey(movementId),
    queryFn: () => fetchSupplierInvoiceByAccountMovement(movementId),
    enabled: enabled && Boolean(movementId),
  });

  const watchedAmount = watch("amount");

  useEffect(() => {
    setAmountWithTaxes(getInvoiceTotalAmount(taxes, watchedAmount));
  }, [watchedAmount, taxes]);

  const applyDefaults = (inv) => {
    const defaultAmount =
      inv?.amount ?? movementAmount ?? accountMovement?.amount ?? "";
    const defaultDesc =
      inv?.description ?? movementDescription ?? accountMovement?.description ?? "";
    const defaultDue = inv?.due_date
      ? DateTime.fromISO(inv.due_date).toFormat("yyyy-MM-dd")
      : movementDate || accountMovement?.date
        ? DateTime.fromISO(movementDate || accountMovement.date).toFormat(
            "yyyy-MM-dd"
          )
        : DateTime.now().toFormat("yyyy-MM-dd");

    reset({
      amount: defaultAmount,
      description: defaultDesc,
      due_date: defaultDue,
    });

    if (inv?.taxes?.length) {
      setTaxes(
        inv.taxes.map((t) => ({
          type: t.name || t.type,
          value: String(t.amount ?? ""),
        }))
      );
    } else {
      setTaxes([{ type: "IVA", value: "" }]);
    }

    if (inv?.invoice_number) {
      const { letter, first4, last8 } = splitInvoiceNumber(inv.invoice_number);
      setInvoiceLetter(letter);
      setInvoiceFirst4(first4);
      setInvoiceLast8(last8);
      setWithoutInvoice(false);
    } else if (!inv) {
      setInvoiceLetter("A");
      setInvoiceFirst4("");
      setInvoiceLast8("");
      setWithoutInvoice(false);
    }

    if (inv?.supplier_id && suppliers?.length) {
      const s = suppliers.find((x) => x.id === inv.supplier_id);
      if (s) {
        setValue("supplier", {
          id: s.id,
          name: s.fantasy_name,
          label: s.fantasy_name || s.name,
        });
      }
    } else if (!inv) {
      setValue("supplier", null);
    }
  };

  useEffect(() => {
    if (!enabled) return;
    const inv =
      linkedInvoice && !linkedInvoice.error ? linkedInvoice : null;
    applyDefaults(inv);
    if (inv) setActive(true);
  }, [enabled, linkedInvoice, movementId, suppliers]);

  // Para egresos la factura es obligatoria: siempre activa.
  useEffect(() => {
    if (required && !active) setActive(true);
  }, [required, active]);

  const hasSavedInvoice =
    linkedInvoice && !linkedInvoice.error && linkedInvoice.id;

  useEffect(() => {
    if (!enabled || !active || hasSavedInvoice) return;
    if (movementAmount === "" || movementAmount == null) return;
    setValue("amount", movementAmount);
  }, [enabled, active, movementAmount, hasSavedInvoice, setValue]);

  const handleActiveChange = (checked) => {
    if (required) return; // obligatorio: no se puede desactivar
    setActive(checked);
    if (checked && movementAmount !== "" && movementAmount != null) {
      setValue("amount", movementAmount);
    }
  };

  useEffect(() => {
    if (!enabled || movementId) return;
    const currentDesc = getValues("description");
    if (!currentDesc && movementDescription) {
      setValue("description", movementDescription);
    }
  }, [movementDescription, movementId, enabled, getValues, setValue]);

  useEffect(() => {
    if (!enabled || movementId) return;
    const currentDue = getValues("due_date");
    if (!currentDue && movementDate) {
      setValue(
        "due_date",
        DateTime.fromISO(movementDate).toFormat("yyyy-MM-dd")
      );
    }
  }, [movementDate, movementId, enabled, getValues, setValue]);

  const concatenateInvoiceNumber = () =>
    `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;

  const validate = () => {
    if (!active) return { ok: true, skipped: true };

    const data = getValues();
    if (!data.supplier?.id) {
      return { ok: false, message: "Seleccione un proveedor" };
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      return { ok: false, message: "Ingrese el monto neto de la factura" };
    }
    if (!withoutInvoice) {
      if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
        return { ok: false, message: "Complete el número de factura" };
      }
    }
    return { ok: true };
  };

  const buildPayload = (accountMovementId) => {
    const data = getValues();
    let invoiceNumber = "";
    if (!withoutInvoice) {
      invoiceNumber = concatenateInvoiceNumber();
    }
    return {
      supplier_id: data.supplier?.id,
      amount: parseFloat(data.amount),
      description: data.description,
      invoice_number: invoiceNumber,
      due_date: data.due_date,
      total: getInvoiceTotalAmount(taxes, data.amount),
      taxes: taxes.filter((t) => t.value !== ""),
      account_movement_id: accountMovementId,
    };
  };

  const resetFields = () => {
    setTaxes([{ type: "IVA", value: "" }]);
    setInvoiceLetter("A");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    setWithoutInvoice(false);
    setActive(true);
    reset({
      amount: "",
      description: "",
      due_date: DateTime.now().toFormat("yyyy-MM-dd"),
    });
    setValue("supplier", null);
  };

  useImperativeHandle(ref, () => ({
    validate,
    buildPayload,
    reset: resetFields,
    isActive: () => active,
    getExistingInvoiceId: () => {
      const inv =
        linkedInvoice && !linkedInvoice.error ? linkedInvoice : null;
      return inv?.id ?? null;
    },
  }));

  const supplierOptions = sortBy(suppliers || [], "fantasy_name").map((p) => ({
    id: p.id,
    name: p.fantasy_name,
    label: p.fantasy_name || p.name,
  }));

  if (!enabled) return null;

  if (suppliersLoading || (movementId && invoiceLoading)) {
    return (
      <div className="py-4 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="border-t border-slate-200 pt-4 mt-2">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Datos de factura
          </h3>
          {required ? (
            <span className="text-xs font-medium text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
              Obligatorio para egresos
            </span>
          ) : (
            <label className="flex items-center gap-2 text-xs text-slate-600">
              <input
                type="checkbox"
                checked={active}
                onChange={(e) => handleActiveChange(e.target.checked)}
                className="rounded border-slate-300"
              />
              Registrar factura
            </label>
          )}
        </div>

        {active && (
          <div className="flex flex-col gap-4 p-4 bg-amber-50/60 rounded-lg border border-amber-200">
            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">
                Proveedor
              </label>
              <div className="flex flex-col sm:flex-row gap-2 items-start">
                <Controller
                  name="supplier"
                  control={control}
                  rules={{ required: active }}
                  render={({ field }) => (
                    <SelectComboBox
                      options={supplierOptions}
                      value={field.value}
                      onChange={field.onChange}
                    />
                  )}
                />
                <Button
                  type="button"
                  variant="alternative"
                  size="sm"
                  className="h-[52px] shrink-0"
                  onClick={() => setSupplierQuickOpen(true)}
                >
                  Nuevo
                  <ExternalLinkIcon className="ml-1 h-4 w-4" />
                </Button>
              </div>
              {(showErrors || errors.supplier) && errors.supplier && (
                <p className="text-sm text-red-500 pt-1">* Obligatorio</p>
              )}
            </div>

            <Input
              label="Monto neto (factura)"
              type="number"
              step="0.01"
              readOnly={!hasSavedInvoice}
              {...register("amount", {
                required: active ? "Ingrese el monto" : false,
                min: { value: 0.01, message: "Debe ser mayor a 0" },
              })}
              intent={errors.amount ? "danger" : "default"}
              helperText={
                errors.amount?.message ||
                (!hasSavedInvoice
                  ? "Se iguala al monto del movimiento"
                  : undefined)
              }
            />

            <Input
              label="Descripción factura"
              type="text"
              {...register("description")}
            />

            <Input
              label="Fecha vencimiento"
              type="date"
              {...register("due_date", {
                required: active ? "Ingrese la fecha" : false,
              })}
              intent={errors.due_date ? "danger" : "default"}
              helperText={errors.due_date?.message}
            />

            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">
                Número de factura
              </label>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  disabled={withoutInvoice}
                  value={invoiceLetter}
                  onChange={(e) => setInvoiceLetter(e.target.value)}
                  className="rounded border border-slate-300 p-3 text-slate-500 w-16 text-center disabled:opacity-50"
                >
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                </select>
                <span className="text-slate-400">-</span>
                <input
                  type="text"
                  value={invoiceFirst4}
                  disabled={withoutInvoice}
                  onChange={(e) =>
                    setInvoiceFirst4(
                      e.target.value.replace(/\D/g, "").slice(0, 4)
                    )
                  }
                  placeholder="0001"
                  maxLength={4}
                  className="rounded border border-slate-200 p-3 text-slate-500 w-20 text-center h-[52px]"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="text"
                  value={invoiceLast8}
                  disabled={withoutInvoice}
                  onChange={(e) =>
                    setInvoiceLast8(
                      e.target.value.replace(/\D/g, "").slice(0, 8)
                    )
                  }
                  placeholder="00000001"
                  maxLength={8}
                  className="rounded border border-slate-200 p-3 text-slate-500 w-28 text-center h-[52px]"
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={withoutInvoice}
                    onChange={(e) => {
                      setWithoutInvoice(e.target.checked);
                      if (e.target.checked) {
                        setInvoiceLetter("");
                        setInvoiceFirst4("");
                        setInvoiceLast8("");
                      } else {
                        setInvoiceLetter("A");
                        setInvoiceFirst4("");
                        setInvoiceLast8("");
                      }
                    }}
                  />
                  Sin factura
                </label>
              </div>
              {showErrors &&
                !withoutInvoice &&
                (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) && (
                  <p className="text-sm text-red-500 pt-1">
                    Complete el número de factura
                  </p>
                )}
            </div>

            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">
                Impuestos
              </label>
              {taxes.map((tax, index) => (
                <div key={index} className="flex items-center gap-2 mb-2">
                  <select
                    value={tax.type}
                    onChange={(e) => {
                      const updated = [...taxes];
                      updated[index].type = e.target.value;
                      setTaxes(updated);
                    }}
                    className="rounded border border-slate-200 p-2 text-slate-500 w-32 text-sm"
                  >
                    {utils.getTaxes().map((t) => (
                      <option key={t.type} value={t.type}>
                        {t.type}
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    placeholder="Valor"
                    value={tax.value}
                    onChange={(e) => {
                      const updated = [...taxes];
                      updated[index].value = e.target.value;
                      setTaxes(updated);
                    }}
                    className="rounded border border-slate-200 p-2 text-slate-500 w-32 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setTaxes(taxes.filter((_, i) => i !== index))
                    }
                    className="text-red-500 font-bold"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setTaxes([...taxes, { type: "IVA", value: "" }])}
                className="text-blue-500 text-sm font-medium"
              >
                + Agregar impuesto
              </button>
              {amountWithTaxes > 0 && (
                <p className="text-sm text-gray-600 mt-2">
                  Total con impuestos: {utils.formatAmount(amountWithTaxes)}
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <SupplierQuickCreateDialog
        open={supplierQuickOpen}
        onOpenChange={setSupplierQuickOpen}
        onCreated={(option) => setValue("supplier", option)}
      />
    </>
  );
});

export default InvoiceDataFields;
