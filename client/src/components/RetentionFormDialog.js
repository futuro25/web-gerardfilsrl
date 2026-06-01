import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import {
  REGIMEN_830_CATEGORIES,
  calculateRetention,
  profitsConditionFromTaxRegime,
} from "../utils/retention";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { useCreateRetentionPaymentMutation } from "../apis/api.retentioncertificates";
import { querySuppliersKey } from "../apis/queryKeys";

function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

export default function RetentionFormDialog({
  open,
  onOpenChange,
  invoice,
  onCreated,
}) {
  const { data: suppliers } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled: open,
  });

  const supplier = useMemo(() => {
    if (!invoice) return null;
    const id = invoice.supplier_id ?? invoice.supplier?.id ?? null;
    return (suppliers || []).find((s) => String(s.id) === String(id)) || null;
  }, [suppliers, invoice]);

  const supplierName =
    supplier?.fantasy_name ||
    supplier?.name ||
    invoice?.supplier_name ||
    invoice?.supplier?.fantasy_name ||
    invoice?.supplier?.name ||
    "";

  const [categoryCode, setCategoryCode] = useState("78");
  const [profitsCondition, setProfitsCondition] = useState("Inscripto");
  const [supplierCuit, setSupplierCuit] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!open) return;
    setCategoryCode("78");
    setProfitsCondition(
      supplier ? profitsConditionFromTaxRegime(supplier.tax_regime) : "Inscripto"
    );
    setSupplierCuit(supplier?.cuit || "");
    setTotalAmount(String(invoice?.total ?? invoice?.amount ?? ""));
    setIssueDate(toDateInput(invoice?.date));
    setDueDate("");
    setErrorMsg("");
  }, [open, supplier, invoice]);

  const isInscripto =
    profitsCondition === "Inscripto" || profitsCondition === "inscripto";

  const preview = useMemo(
    () => calculateRetention(categoryCode, isInscripto, totalAmount),
    [categoryCode, isInscripto, totalAmount]
  );

  const total = parseFloat(totalAmount) || 0;
  const totalToPay = Math.round((total - preview.retention) * 100) / 100;

  const mutation = useMutation({ mutationFn: useCreateRetentionPaymentMutation });

  const onSave = async () => {
    setErrorMsg("");
    if (!supplierCuit) {
      setErrorMsg("El proveedor no tiene CUIT cargado.");
      return;
    }
    if (!categoryCode) {
      setErrorMsg("Seleccioná una categoría de retención.");
      return;
    }
    if (!issueDate) {
      setErrorMsg("Ingresá la fecha de emisión.");
      return;
    }
    if (!total || total <= 0) {
      setErrorMsg("Ingresá un importe total válido.");
      return;
    }

    const category = REGIMEN_830_CATEGORIES.find((c) => c.code === categoryCode);

    try {
      const result = await mutation.mutateAsync({
        invoiceNumber: invoice?.invoice_number || "",
        categoryCode,
        categoryDetail: category?.description || "",
        supplier: supplierName,
        supplierCuit,
        issueDate,
        dueDate: dueDate || null,
        totalAmount: total,
        netAmount: preview.netAmount,
        iva: preview.iva,
        profitsCondition,
        cashflowCategory: "",
        cashflowService: "",
        paymentMethod: "",
      });

      if (result?.error) {
        setErrorMsg(result.error);
        return;
      }

      onCreated?.(result);
      onOpenChange(false);
    } catch (e) {
      setErrorMsg(e.message || "No se pudo registrar la retención.");
    }
  };

  if (!invoice) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        <div>
          <DialogTitle className="text-lg font-semibold text-slate-800">
            Calcular y registrar retención
          </DialogTitle>
          <p className="text-xs text-slate-400 mt-0.5">
            Se calcula según RG 4525 y se genera el certificado, igual que en el
            módulo de Retenciones.
          </p>
        </div>

        {/* Proveedor / factura */}
        <div className="bg-amber-50 border border-amber-100 rounded-lg px-4 py-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 text-xs">Proveedor</span>
            <span className="font-medium text-slate-700 text-right">
              {supplierName || "—"}
            </span>
          </div>
          {invoice.invoice_number && (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 text-xs">Factura</span>
              <span className="font-medium text-slate-700">
                {utils.formatInvoiceNumber(invoice.invoice_number)}
              </span>
            </div>
          )}
        </div>

        <Input
          label="CUIT del proveedor"
          type="text"
          value={supplierCuit}
          onChange={(e) => setSupplierCuit(e.target.value)}
          placeholder="Sin CUIT cargado"
        />

        {/* Categoría */}
        <div>
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Categoría de retención (Régimen 830)
          </label>
          <select
            className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
            value={categoryCode}
            onChange={(e) => setCategoryCode(e.target.value)}
          >
            {REGIMEN_830_CATEGORIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.code} - {c.description}
              </option>
            ))}
          </select>
        </div>

        {/* Condición Ganancias */}
        <div>
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Condición frente a Ganancias
          </label>
          <select
            className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
            value={profitsCondition}
            onChange={(e) => setProfitsCondition(e.target.value)}
          >
            <option value="Inscripto">Inscripto</option>
            <option value="No inscripto">No inscripto</option>
          </select>
        </div>

        <Input
          label="Importe total de la factura"
          type="number"
          step="0.01"
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
          placeholder="0.00"
        />

        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Fecha de emisión"
            type="date"
            value={issueDate}
            onChange={(e) => setIssueDate(e.target.value)}
          />
          <Input
            label="Vencimiento (opcional)"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        {/* Preview */}
        <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 text-xs">Neto</span>
            <span className="font-medium text-slate-700">
              {utils.formatAmount(preview.netAmount)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 text-xs">IVA (21%)</span>
            <span className="font-medium text-slate-700">
              {utils.formatAmount(preview.iva)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500 text-xs">Retención estimada</span>
            <span className="font-bold text-violet-700">
              {utils.formatAmount(preview.retention)}
            </span>
          </div>
          <div className="flex justify-between text-sm border-t border-violet-100 pt-1.5">
            <span className="text-slate-500 text-xs">Total a pagar</span>
            <span className="font-semibold text-slate-800">
              {utils.formatAmount(totalToPay)}
            </span>
          </div>
          <p className="text-[10px] text-slate-400 pt-1">
            El monto definitivo lo calcula el sistema al guardar, considerando el
            acumulado mensual del proveedor.
          </p>
        </div>

        {errorMsg && (
          <p className="text-sm text-red-500 -mt-1">{errorMsg}</p>
        )}

        <div className="flex gap-2 pt-1">
          <Button
            type="button"
            variant="default"
            className="flex-1"
            onClick={onSave}
            disabled={mutation.isPending}
          >
            {mutation.isPending ? (
              <span className="flex items-center gap-2">
                <Spinner /> Guardando...
              </span>
            ) : (
              "Registrar retención"
            )}
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
      </DialogContent>
    </Dialog>
  );
}
