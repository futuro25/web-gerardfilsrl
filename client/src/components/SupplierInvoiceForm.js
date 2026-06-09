import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ExternalLinkIcon, UploadIcon } from "lucide-react";
import { DateTime } from "luxon";
import { Input } from "./common/Input";
import Button from "./common/Button";
import SelectComboBox from "./common/SelectComboBox";
import Spinner from "./common/Spinner";
import SupplierQuickCreateDialog from "./SupplierQuickCreateDialog";
import * as utils from "../utils/utils";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { fetchSupplierInvoiceByAccountMovement, checkDuplicateSupplierInvoice } from "../apis/api.supplierinvoices";
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

const today = DateTime.now().toFormat("yyyy-MM-dd");

const SupplierInvoiceForm = forwardRef(function SupplierInvoiceForm(
  {
    accountMovement = null,
    movementDate = null,
    movementDescription = null,
    enabled = true,
    showErrors = false,
    showImageUpload = true,
    embedded = false,
    onTotalChange = null,
  },
  ref
) {
  const movementId = accountMovement?.id;

  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [withoutInvoice, setWithoutInvoice] = useState(false);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);

  const {
    register,
    reset,
    control,
    setValue,
    watch,
    getValues,
    formState: { errors },
  } = useForm({
    defaultValues: { amount: "", description: "", document_date: today },
  });

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
  const amountWithTaxes = useMemo(
    () => getInvoiceTotalAmount(taxes, watchedAmount),
    [taxes, watchedAmount]
  );

  useEffect(() => {
    onTotalChange?.(amountWithTaxes);
  }, [amountWithTaxes, onTotalChange]);

  const applyDefaults = (inv) => {
    const defaultAmount = inv?.amount ?? "";
    const defaultDesc =
      inv?.description ?? movementDescription ?? accountMovement?.description ?? "";
    const defaultDocument = inv?.document_date
      ? DateTime.fromISO(inv.document_date).toFormat("yyyy-MM-dd")
      : movementDate || accountMovement?.date
        ? DateTime.fromISO(movementDate || accountMovement.date).toFormat(
            "yyyy-MM-dd"
          )
        : today;

    reset({
      amount: defaultAmount,
      description: defaultDesc,
      document_date: defaultDocument,
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

    setImageFile(null);
  };

  useEffect(() => {
    if (!enabled) return;
    const inv =
      linkedInvoice && !linkedInvoice.error ? linkedInvoice : null;
    applyDefaults(inv);
  }, [enabled, linkedInvoice, movementId, suppliers]);

  const hasSavedInvoice =
    linkedInvoice && !linkedInvoice.error && linkedInvoice.id;

  const concatenateInvoiceNumber = () =>
    `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;

  const validate = async () => {
    const data = getValues();
    if (!data.supplier?.id) {
      return { ok: false, message: "Seleccione un proveedor" };
    }
    if (!data.amount || parseFloat(data.amount) <= 0) {
      return { ok: false, message: "Ingrese el monto neto de la factura" };
    }
    if (!data.document_date) {
      return { ok: false, message: "Ingrese la fecha del comprobante" };
    }
    if (!String(data.description || "").trim()) {
      return { ok: false, message: "Ingrese la descripción de la factura" };
    }
    if (!withoutInvoice) {
      if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
        return { ok: false, message: "Complete el número de factura" };
      }
      const invoiceNumber = concatenateInvoiceNumber();
      const existingId =
        linkedInvoice && !linkedInvoice.error ? linkedInvoice.id : null;
      try {
        const dup = await checkDuplicateSupplierInvoice({
          supplierId: data.supplier.id,
          invoiceNumber,
          excludeInvoiceId: existingId,
          excludeMovementId: movementId,
        });
        if (dup?.duplicate) {
          return {
            ok: false,
            message: `Ya existe la factura ${utils.formatInvoiceNumber(invoiceNumber)} para este proveedor.`,
          };
        }
      } catch (e) {
        console.error(e);
        return {
          ok: false,
          message: "No se pudo verificar si la factura ya existe",
        };
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
      description: data.description || null,
      invoice_number: invoiceNumber,
      document_date: data.document_date,
      total: getInvoiceTotalAmount(taxes, data.amount),
      taxes: taxes.filter((t) => t.value !== ""),
      account_movement_id: accountMovementId ?? null,
      image_key: null,
    };
  };

  const resetFields = () => {
    setTaxes([{ type: "IVA", value: "" }]);
    setInvoiceLetter("A");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    setWithoutInvoice(false);
    setImageFile(null);
    reset({ amount: "", description: "", document_date: today });
    setValue("supplier", null);
  };

  useImperativeHandle(ref, () => ({
    validate,
    buildPayload,
    reset: resetFields,
    getExistingInvoiceId: () => {
      const inv =
        linkedInvoice && !linkedInvoice.error ? linkedInvoice : null;
      return inv?.id ?? null;
    },
    getTotalAmount: () => amountWithTaxes,
    getNetAmount: () => parseFloat(getValues("amount")) || 0,
    getImageFile: () => imageFile,
    getValues,
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

  const wrapperClass = embedded
    ? "flex flex-col gap-4"
    : "flex flex-col gap-4 p-4 bg-amber-50/60 rounded-lg border border-amber-200";

  return (
    <>
      <div className={wrapperClass}>
        <div>
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Proveedor
          </label>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <Controller
              name="supplier"
              control={control}
              rules={{ required: true }}
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
                  setInvoiceLetter(e.target.checked ? "" : "A");
                  setInvoiceFirst4("");
                  setInvoiceLast8("");
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

        <Input
          label="Monto neto"
          type="number"
          step="0.01"
          placeholder="0.00"
          {...register("amount", {
            required: "Ingrese el monto",
            min: { value: 0.01, message: "Debe ser mayor a 0" },
          })}
          intent={errors.amount ? "danger" : "default"}
          helperText={errors.amount?.message}
        />

        <Input
          label="Descripción"
          type="text"
          placeholder="Detalle de la factura"
          {...register("description", {
            required: "Ingrese la descripción",
            validate: (value) =>
              String(value || "").trim().length > 0 ||
              "Ingrese la descripción",
          })}
          intent={errors.description ? "danger" : "default"}
          helperText={errors.description?.message}
        />

        <Input
          label="Fecha comprobante"
          type="date"
          {...register("document_date", { required: "Ingrese la fecha del comprobante" })}
          intent={errors.document_date ? "danger" : "default"}
          helperText={errors.document_date?.message}
        />

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
                className="rounded border border-slate-200 p-2 text-slate-500 w-40 text-sm"
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
                onClick={() => setTaxes(taxes.filter((_, i) => i !== index))}
                className="text-red-500 font-bold px-1"
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
          <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Total con impuestos
            </span>
            <span className="text-base font-bold text-slate-800">
              {utils.formatAmount(amountWithTaxes)}
            </span>
          </div>
        </div>

        {showImageUpload && (
          <div>
            <label className="text-xs font-sans text-gray-900 mb-2 block">
              Imagen de la factura (opcional)
            </label>
            <label
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragEnter={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                setIsDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setIsDragging(false);
                const f = e.dataTransfer?.files?.[0];
                if (f) setImageFile(f);
              }}
              className={utils.cn(
                "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors",
                isDragging
                  ? "border-blue-400 bg-blue-50 text-blue-600"
                  : "border-slate-300 bg-slate-50 text-slate-400 hover:border-blue-300 hover:bg-blue-50/40"
              )}
            >
              <UploadIcon className="h-7 w-7" />
              <span className="text-sm font-medium">
                Arrastrá la factura acá o hacé click para subir
              </span>
              <span className="text-xs">Imagen o PDF</span>
              <input
                type="file"
                accept="image/*,application/pdf"
                className="hidden"
                onChange={(e) => setImageFile(e.target.files?.[0] || null)}
              />
            </label>
            {imageFile && (
              <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                <span className="truncate">{imageFile.name}</span>
                <button
                  type="button"
                  onClick={() => setImageFile(null)}
                  className="text-red-500 font-bold px-1"
                >
                  ×
                </button>
              </div>
            )}
            {hasSavedInvoice && linkedInvoice?.image_key && !imageFile && (
              <p className="text-xs text-slate-500 mt-2">
                Ya hay una imagen cargada para esta factura.
              </p>
            )}
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

export default SupplierInvoiceForm;
