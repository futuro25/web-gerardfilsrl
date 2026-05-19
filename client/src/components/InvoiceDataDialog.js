import { useEffect, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ExternalLinkIcon } from "lucide-react";
import { DateTime } from "luxon";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import Button from "./common/Button";
import SelectComboBox from "./common/SelectComboBox";
import Spinner from "./common/Spinner";
import SupplierQuickCreateDialog from "./SupplierQuickCreateDialog";
import * as utils from "../utils/utils";
import { useSuppliersQuery } from "../apis/api.suppliers";
import {
  fetchInvoiceByAccountMovement,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
} from "../apis/api.invoices";
import {
  queryInvoicesKey,
  queryInvoiceByMovementKey,
  querySuppliersKey,
  querySupplierAccountKey,
} from "../apis/queryKeys";

function getTotalAmount(taxes, amount) {
  const totalTaxes = taxes?.reduce((acc, tax) => {
    const taxValue = parseFloat(tax.value) || 0;
    return acc + taxValue;
  }, 0);
  return (parseFloat(amount) || 0) + (totalTaxes || 0);
}

function splitInvoiceNumber(invoiceNumber) {
  if (!invoiceNumber) return { letter: "A", first4: "", last8: "" };
  const letter = invoiceNumber.charAt(0);
  const numbers = invoiceNumber.slice(1);
  return {
    letter: letter || "A",
    first4: numbers.slice(0, 4),
    last8: numbers.slice(4),
  };
}

export default function InvoiceDataDialog({
  open,
  onOpenChange,
  accountMovement,
  onSaved,
}) {
  const queryClient = useQueryClient();
  const movementId = accountMovement?.id;

  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const [amountWithTaxes, setAmountWithTaxes] = useState(0);
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [withoutInvoice, setWithoutInvoice] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [existingInvoice, setExistingInvoice] = useState(null);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm();

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled: open,
  });

  const { data: linkedInvoice, isLoading: invoiceLoading } = useQuery({
    queryKey: queryInvoiceByMovementKey(movementId),
    queryFn: () => fetchInvoiceByAccountMovement(movementId),
    enabled: open && Boolean(movementId),
  });

  const createMutation = useMutation({ mutationFn: useCreateInvoiceMutation });
  const updateMutation = useMutation({ mutationFn: useUpdateInvoiceMutation });

  const watchedAmount = watch("amount");

  useEffect(() => {
    setAmountWithTaxes(getTotalAmount(taxes, watchedAmount));
  }, [watchedAmount, taxes]);

  useEffect(() => {
    if (!open) return;

    const inv = linkedInvoice && !linkedInvoice.error ? linkedInvoice : null;
    setExistingInvoice(inv);

    const defaultAmount = inv?.amount ?? accountMovement?.amount ?? "";
    const defaultDesc = inv?.description ?? accountMovement?.description ?? "";
    const defaultDue = inv?.due_date
      ? DateTime.fromISO(inv.due_date).toFormat("yyyy-MM-dd")
      : accountMovement?.date
        ? DateTime.fromISO(accountMovement.date).toFormat("yyyy-MM-dd")
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
    } else {
      setInvoiceLetter("A");
      setInvoiceFirst4("");
      setInvoiceLast8("");
      setWithoutInvoice(true);
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
    } else {
      setValue("supplier", null);
    }

    setFormSubmitted(false);
  }, [open, linkedInvoice, accountMovement, suppliers, reset, setValue]);

  const concatenateInvoiceNumber = () =>
    `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;

  const onSubmit = async (data) => {
    try {
      setFormSubmitted(true);

      if (!data.supplier?.id) return;

      let invoiceNumber = "";
      if (!withoutInvoice) {
        if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) return;
        invoiceNumber = concatenateInvoiceNumber();
      }

      setIsLoadingSubmit(true);

      const body = {
        supplier_id: data.supplier.id,
        amount: parseFloat(data.amount),
        description: data.description,
        invoice_number: invoiceNumber,
        due_date: data.due_date,
        total: getTotalAmount(taxes, data.amount),
        taxes: taxes.filter((t) => t.value !== ""),
        account_movement_id: movementId,
      };

      if (existingInvoice?.id) {
        await updateMutation.mutateAsync({ ...body, id: existingInvoice.id });
      } else {
        await createMutation.mutateAsync(body);
      }

      queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
      queryClient.invalidateQueries({
        queryKey: queryInvoiceByMovementKey(movementId),
      });
      if (data.supplier?.id) {
        queryClient.invalidateQueries({
          queryKey: querySupplierAccountKey(data.supplier.id),
        });
      }

      setIsLoadingSubmit(false);
      onSaved?.();
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      setIsLoadingSubmit(false);
      window.alert("No se pudo guardar la factura");
    }
  };

  const supplierOptions = sortBy(suppliers || [], "fantasy_name").map((p) => ({
    id: p.id,
    name: p.fantasy_name,
    label: p.fantasy_name || p.name,
  }));

  const loading = suppliersLoading || invoiceLoading;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 gap-4">
          <DialogTitle className="text-lg font-semibold text-slate-800 pr-8">
            Ingresar datos de factura
          </DialogTitle>
          {accountMovement && (
            <p className="text-xs text-slate-500 -mt-2">
              Movimiento egreso #{accountMovement.id} ·{" "}
              {utils.formatAmount(accountMovement.amount)} ·{" "}
              {accountMovement.description || "Sin detalle"}
            </p>
          )}

          {loading ? (
            <div className="py-8 flex justify-center">
              <Spinner />
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
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
                {errors.supplier && (
                  <p className="text-sm text-red-500 pt-1">* Obligatorio</p>
                )}
              </div>

              <Input
                label="Monto neto"
                type="number"
                step="0.01"
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
                {...register("description")}
              />

              <Input
                label="Fecha vencimiento"
                type="date"
                {...register("due_date", { required: "Ingrese la fecha" })}
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
                      setInvoiceFirst4(e.target.value.replace(/\D/g, "").slice(0, 4))
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
                      setInvoiceLast8(e.target.value.replace(/\D/g, "").slice(0, 8))
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
                {formSubmitted &&
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

              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={isLoadingSubmit}>
                  {isLoadingSubmit ? "Guardando..." : existingInvoice ? "Actualizar" : "Guardar"}
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

      <SupplierQuickCreateDialog
        open={supplierQuickOpen}
        onOpenChange={setSupplierQuickOpen}
        onCreated={(option) => setValue("supplier", option)}
      />
    </>
  );
}
