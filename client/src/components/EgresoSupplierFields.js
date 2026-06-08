import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ExternalLinkIcon } from "lucide-react";
import SelectComboBox from "./common/SelectComboBox";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import SupplierQuickCreateDialog from "./SupplierQuickCreateDialog";
import { splitInvoiceNumber } from "./SupplierInvoiceForm";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { querySuppliersKey } from "../apis/queryKeys";

function concatenateInvoiceNumber(letter, first4, last8) {
  if (!letter || !first4 || !last8) return "";
  return `${letter}${first4}${last8}`;
}

const EgresoSupplierFields = forwardRef(function EgresoSupplierFields(
  {
    accountMovement = null,
    requireSupplier = true,
    requireInvoiceNumber = false,
    showErrors = false,
  },
  ref
) {
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);

  const {
    control,
    reset,
    setValue,
    getValues,
    trigger,
    formState: { errors },
  } = useForm({
    defaultValues: { supplier: null },
  });

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  useEffect(() => {
    if (!accountMovement) {
      setInvoiceLetter("A");
      setInvoiceFirst4("");
      setInvoiceLast8("");
      reset({ supplier: null });
      return;
    }

    const parts = splitInvoiceNumber(accountMovement.invoice_number || "");
    setInvoiceLetter(parts.letter || "A");
    setInvoiceFirst4(parts.first4 || "");
    setInvoiceLast8(parts.last8 || "");

    if (accountMovement.supplier_id && suppliers?.length) {
      const s = suppliers.find((x) => x.id === accountMovement.supplier_id);
      if (s) {
        setValue("supplier", {
          id: s.id,
          name: s.fantasy_name,
          label: s.fantasy_name || s.name,
        });
      }
    }
  }, [accountMovement, suppliers, reset, setValue]);

  const supplierOptions = sortBy(suppliers || [], "fantasy_name").map((p) => ({
    id: p.id,
    name: p.fantasy_name,
    label: p.fantasy_name || p.name,
  }));

  useImperativeHandle(ref, () => ({
    async validate() {
      if (requireSupplier) {
        await trigger("supplier");
      }
      const data = getValues();
      if (requireSupplier && !data.supplier?.id) {
        return { ok: false, message: "Seleccione un proveedor" };
      }
      if (requireInvoiceNumber) {
        if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
          return { ok: false, message: "Complete el número de factura" };
        }
      }
      return { ok: true };
    },
    getPayload() {
      const data = getValues();
      return {
        supplier_id: data.supplier?.id ?? null,
        invoice_number: requireInvoiceNumber
          ? concatenateInvoiceNumber(invoiceLetter, invoiceFirst4, invoiceLast8)
          : null,
      };
    },
    reset() {
      setInvoiceLetter("A");
      setInvoiceFirst4("");
      setInvoiceLast8("");
      reset({ supplier: null });
    },
  }));

  if (suppliersLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 p-4 bg-slate-50 rounded-lg border border-slate-200">
        <h3 className="text-sm font-semibold text-slate-800">Proveedor</h3>
        <div>
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Proveedor{" "}
            {requireSupplier ? (
              <span className="text-red-500">*</span>
            ) : (
              <span className="text-slate-400 font-normal">(opcional)</span>
            )}
          </label>
          <div className="flex flex-col sm:flex-row gap-2 items-start">
            <Controller
              name="supplier"
              control={control}
              rules={{ required: requireSupplier }}
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
          {requireSupplier && showErrors && !getValues("supplier")?.id && (
            <p className="text-sm text-red-500 pt-1">Seleccione un proveedor</p>
          )}
        </div>

        {requireInvoiceNumber && (
          <div>
            <label className="text-xs font-sans text-gray-900 mb-2 block">
              Número de factura <span className="text-red-500">*</span>
            </label>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={invoiceLetter}
                onChange={(e) => setInvoiceLetter(e.target.value)}
                className="rounded border border-slate-300 p-3 text-slate-500 w-16 text-center"
              >
                <option value="A">A</option>
                <option value="B">B</option>
                <option value="C">C</option>
              </select>
              <span className="text-slate-400">-</span>
              <input
                type="text"
                value={invoiceFirst4}
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
                onChange={(e) =>
                  setInvoiceLast8(
                    e.target.value.replace(/\D/g, "").slice(0, 8)
                  )
                }
                placeholder="00000001"
                maxLength={8}
                className="rounded border border-slate-200 p-3 text-slate-500 w-28 text-center h-[52px]"
              />
            </div>
            {showErrors &&
              (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) && (
                <p className="text-sm text-red-500 pt-1">
                  Complete el número de factura
                </p>
              )}
          </div>
        )}
      </div>

      <SupplierQuickCreateDialog
        open={supplierQuickOpen}
        onOpenChange={setSupplierQuickOpen}
        onCreated={(created) => {
          setValue("supplier", {
            id: created.id,
            name: created.fantasy_name,
            label: created.fantasy_name || created.name,
          });
        }}
      />
    </>
  );
});

export default EgresoSupplierFields;
