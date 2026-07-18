import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import SelectComboBox from "./common/SelectComboBox";
import { Input } from "./common/Input";
import Spinner from "./common/Spinner";
import { fetchSupplierInvoices } from "../apis/api.supplierinvoices";
import { querySupplierInvoicesListKey } from "../apis/queryKeys";
import * as utils from "../utils/utils";

function invoiceNumberLabel(inv) {
  return inv.invoice_number
    ? utils.formatInvoiceNumber(inv.invoice_number)
    : `Factura #${inv.id}`;
}

function invoiceSupplierName(inv) {
  return inv.supplier?.fantasy_name || inv.supplier?.name || "";
}

function invoiceDateLabel(inv) {
  return inv.document_date
    ? DateTime.fromISO(inv.document_date).toFormat("dd/MM/yyyy")
    : "";
}

/** Texto plano para buscar y para mostrar en el input al seleccionar. */
function invoiceOptionLabel(inv) {
  return [
    invoiceNumberLabel(inv),
    invoiceSupplierName(inv),
    utils.formatAmount(inv.total ?? inv.amount),
    invoiceDateLabel(inv),
  ]
    .filter(Boolean)
    .join(" · ");
}

/** Layout de dos líneas para cada opción del listado. */
function invoiceOptionName(inv) {
  const dateStr = invoiceDateLabel(inv);
  return (
    <div className="flex flex-col gap-0.5 w-full py-0.5">
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-baseline gap-2 min-w-0">
          <span className="font-medium text-slate-800 tabular-nums whitespace-nowrap">
            {invoiceNumberLabel(inv)}
          </span>
          <span
            className={utils.cn(
              "text-[10px] font-medium px-1.5 py-px rounded-full shrink-0",
              inv.invoice_fully_paid
                ? "bg-emerald-100 text-emerald-700"
                : "bg-amber-100 text-amber-700"
            )}
          >
            {inv.invoice_fully_paid ? "Pagada" : "Pendiente"}
          </span>
        </span>
        <span className="font-semibold text-slate-900 tabular-nums shrink-0">
          {utils.formatAmount(inv.total ?? inv.amount)}
        </span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-slate-500 truncate">
          {invoiceSupplierName(inv) || "Sin proveedor"}
        </span>
        {dateStr && (
          <span className="text-[11px] text-slate-400 shrink-0">{dateStr}</span>
        )}
      </div>
    </div>
  );
}

/** Campos de un ingreso tipo Nota de crédito: N° de NC y factura asociada. */
const IngresoCreditNoteFields = forwardRef(function IngresoCreditNoteFields(
  { accountMovement = null, showErrors = false },
  ref
) {
  const [creditNoteNumber, setCreditNoteNumber] = useState("");
  const [selectedInvoice, setSelectedInvoice] = useState(null);

  const { data: invoicesRes, isLoading: invoicesLoading } = useQuery({
    queryKey: querySupplierInvoicesListKey(),
    queryFn: fetchSupplierInvoices,
  });

  const invoices = useMemo(() => {
    if (Array.isArray(invoicesRes)) return invoicesRes;
    if (Array.isArray(invoicesRes?.data)) return invoicesRes.data;
    return [];
  }, [invoicesRes]);

  const invoiceOptions = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      const da = String(a.document_date || a.created_at || "");
      const db = String(b.document_date || b.created_at || "");
      return db.localeCompare(da);
    });
    return sorted.map((inv) => ({
      id: inv.id,
      name: invoiceOptionName(inv),
      label: invoiceOptionLabel(inv),
      supplier_id: inv.supplier_id ?? inv.supplier?.id ?? null,
    }));
  }, [invoices]);

  useEffect(() => {
    if (!accountMovement) {
      setCreditNoteNumber("");
      setSelectedInvoice(null);
      return;
    }
    setCreditNoteNumber(accountMovement.credit_note_number || "");
    if (accountMovement.credit_note_invoice_id && invoiceOptions.length) {
      const opt = invoiceOptions.find(
        (o) => o.id === accountMovement.credit_note_invoice_id
      );
      setSelectedInvoice(opt || null);
    }
  }, [accountMovement, invoiceOptions]);

  useImperativeHandle(ref, () => ({
    async validate() {
      if (!creditNoteNumber.trim()) {
        return { ok: false, message: "Ingrese el número de nota de crédito" };
      }
      if (!selectedInvoice?.id) {
        return {
          ok: false,
          message: "Seleccione la factura asociada a la nota de crédito",
        };
      }
      return { ok: true };
    },
    getPayload() {
      return {
        credit_note_number: creditNoteNumber.trim(),
        credit_note_invoice_id: selectedInvoice?.id ?? null,
        supplier_id: selectedInvoice?.supplier_id ?? null,
      };
    },
    reset() {
      setCreditNoteNumber("");
      setSelectedInvoice(null);
    },
  }));

  if (invoicesLoading) {
    return (
      <div className="py-4 flex justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4 bg-teal-50 rounded-lg border border-teal-200">
      <h3 className="text-sm font-semibold text-slate-800">Nota de crédito</h3>

      <Input
        label="Número de nota de crédito"
        type="text"
        placeholder="Ej: NC-A-0001-00001234"
        value={creditNoteNumber}
        onChange={(e) => setCreditNoteNumber(e.target.value)}
        intent={showErrors && !creditNoteNumber.trim() ? "danger" : "default"}
        helperText={
          showErrors && !creditNoteNumber.trim()
            ? "Ingrese el número de nota de crédito"
            : undefined
        }
      />

      <div>
        <label className="text-xs font-sans text-gray-900 mb-2 block">
          Factura asociada <span className="text-red-500">*</span>
        </label>
        <SelectComboBox
          options={invoiceOptions}
          value={selectedInvoice}
          onChange={setSelectedInvoice}
        />
        {showErrors && !selectedInvoice?.id && (
          <p className="text-sm text-red-500 pt-1">
            Seleccione la factura asociada
          </p>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Buscá por número de factura, proveedor o importe. La nota de crédito
          impacta en la cuenta corriente del proveedor de la factura.
        </p>
      </div>
    </div>
  );
});

export default IngresoCreditNoteFields;
