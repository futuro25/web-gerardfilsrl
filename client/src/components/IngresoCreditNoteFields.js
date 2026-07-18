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

function invoiceOptionLabel(inv) {
  const number = inv.invoice_number
    ? utils.formatInvoiceNumber(inv.invoice_number)
    : `Factura #${inv.id}`;
  const supplierName = inv.supplier?.fantasy_name || inv.supplier?.name || "";
  const dateStr = inv.document_date
    ? DateTime.fromISO(inv.document_date).toFormat("dd/MM/yyyy")
    : "";
  return [number, supplierName, utils.formatAmount(inv.total ?? inv.amount), dateStr]
    .filter(Boolean)
    .join(" · ");
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

  const invoices = useMemo(
    () => (Array.isArray(invoicesRes) ? invoicesRes : []),
    [invoicesRes]
  );

  const invoiceOptions = useMemo(() => {
    const sorted = [...invoices].sort((a, b) => {
      const da = String(a.document_date || a.created_at || "");
      const db = String(b.document_date || b.created_at || "");
      return db.localeCompare(da);
    });
    return sorted.map((inv) => {
      const label = invoiceOptionLabel(inv);
      return {
        id: inv.id,
        name: label,
        label,
        supplier_id: inv.supplier_id ?? inv.supplier?.id ?? null,
      };
    });
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
