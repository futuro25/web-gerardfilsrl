import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Receipt } from "lucide-react";
import Spinner from "./common/Spinner";
import PaymentOrderDialog from "./PaymentOrderDialog";
import * as utils from "../utils/utils";
import { fetchPendingPaymentItems } from "../apis/api.paymentorders";
import {
  queryPendingPaymentItemsKey,
  queryPaymentOrdersNextNumberKey,
} from "../apis/queryKeys";

const SOURCE_BADGE = {
  control: { label: "Control", className: "bg-indigo-100 text-indigo-700" },
  cashflow: { label: "Cashflow", className: "bg-teal-100 text-teal-700" },
};

// Normaliza un número de factura para comparar (sin espacios/guiones, mayúsculas)
function normalizeInvoiceNumber(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

// Facturas a resaltar en rojo (por número de factura)
const HIGHLIGHTED_INVOICES = new Set(
  [
    "A000200002448",
    "A000200002461",
    "A000200007831",
    "A000300007067",
    "A000600000083",
    "A000200000095",
    "A000200002472",
    "A000100000384",
    "A000100000385",
    "A000300071091",
  ].map(normalizeInvoiceNumber)
);

function isHighlighted(it) {
  const num = normalizeInvoiceNumber(it.invoice_number);
  if (!num) return false;
  return HIGHLIGHTED_INVOICES.has(num);
}

export default function PendingInvoicesList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [payOrderOpen, setPayOrderOpen] = useState(false);
  const [payOrderItem, setPayOrderItem] = useState(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: queryPendingPaymentItemsKey(),
    queryFn: fetchPendingPaymentItems,
  });

  const items = data?.data || [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((it) => {
      if (sourceFilter && it.source !== sourceFilter) return false;
      if (!q) return true;
      const supplier = (it.supplier_name || "").toLowerCase();
      const invoiceNum = (it.invoice_number || "").toLowerCase();
      const desc = (it.description || "").toLowerCase();
      return (
        supplier.includes(q) || invoiceNum.includes(q) || desc.includes(q)
      );
    });
  }, [items, search, sourceFilter]);

  const totalPending = filtered.reduce(
    (acc, it) => acc + parseFloat(it.total || it.amount || 0),
    0
  );

  const controlCount = items.filter((it) => it.source === "control").length;

  const openPaymentOrder = (it) => {
    queryClient.invalidateQueries({ queryKey: queryPaymentOrdersNextNumberKey() });
    setPayOrderItem(it);
    setPayOrderOpen(true);
  };

  return (
    <>
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Facturas Pendientes</div>
          </div>
        </div>
      </div>

      <div className="px-4 pb-28 overflow-auto h-full">
        <p className="text-xs text-slate-500 my-3">
          Facturas de <strong>Control</strong> y <strong>Cashflow</strong> que todavía
          no tienen una orden de pago. Ordenadas por fecha (de la más antigua a la más
          reciente).
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Pendientes</p>
            <p className="text-2xl font-bold mt-1 text-slate-800">
              {isLoading ? "—" : filtered.length}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Total pendiente</p>
            <p className="text-xl font-bold mt-1 text-red-600">
              {isLoading ? "—" : utils.formatAmount(totalPending)}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">De Control</p>
            <p className="text-2xl font-bold mt-1 text-indigo-600">
              {isLoading ? "—" : controlCount}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            className="border rounded px-2 py-2 text-sm bg-white"
            value={sourceFilter}
            onChange={(e) => setSourceFilter(e.target.value)}
          >
            <option value="">Todos los orígenes</option>
            <option value="control">Control</option>
            <option value="cashflow">Cashflow</option>
          </select>
          <input
            type="search"
            placeholder="Buscar por proveedor, N° factura o descripción…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-3 py-2 text-sm bg-white flex-1 min-w-[12rem] max-w-md"
          />
        </div>

        {isLoading && (
          <div className="flex justify-center py-12">
            <Spinner />
          </div>
        )}

        {!isLoading && (
          <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
            <div className="relative rounded-xl overflow-auto">
              <div className="shadow-sm overflow-auto">
                <table className="border-collapse table-auto w-full text-sm">
                  <thead>
                    <tr>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">
                        Fecha
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">
                        Origen
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">
                        Proveedor
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">
                        N° Factura
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left hidden sm:table-cell">
                        Descripción
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-right">
                        Monto neto
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-right">
                        Total
                      </th>
                      <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-center w-10" />
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {filtered.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="p-6 text-center text-slate-400">
                          {items.length > 0
                            ? "Ninguna factura coincide con el filtro"
                            : "No hay facturas pendientes de pago"}
                        </td>
                      </tr>
                    ) : (
                      filtered.map((it, index) => {
                        const badge = SOURCE_BADGE[it.source] || {
                          label: it.source,
                          className: "bg-slate-100 text-slate-600",
                        };
                        const highlighted = isHighlighted(it);
                        return (
                          <tr
                            key={it.key}
                            className={utils.cn(
                              "border-b last:border-b-0",
                              highlighted
                                ? "bg-red-100 hover:bg-red-200/70"
                                : index % 2 === 0
                                ? "bg-gray-50 hover:bg-gray-100"
                                : "bg-white hover:bg-gray-100"
                            )}
                          >
                            <td className="!text-xs p-3 text-slate-600 whitespace-nowrap">
                              {it.date
                                ? DateTime.fromISO(it.date).toFormat("dd/MM/yyyy")
                                : "-"}
                            </td>
                            <td className="!text-xs p-3">
                              <span
                                className={utils.cn(
                                  "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold",
                                  badge.className
                                )}
                              >
                                {badge.label}
                              </span>
                            </td>
                            <td className="!text-xs p-3 text-slate-700 font-medium max-w-[140px] truncate">
                              {it.supplier_name || (
                                <span className="text-slate-300 italic">Sin proveedor</span>
                              )}
                            </td>
                            <td className="!text-xs p-3 text-slate-600 font-mono">
                              {it.invoice_number || (
                                <span className="text-slate-300 italic">Sin N°</span>
                              )}
                            </td>
                            <td className="!text-xs p-3 text-slate-500 max-w-[180px] truncate hidden sm:table-cell">
                              {it.description || "-"}
                            </td>
                            <td className="!text-xs p-3 text-right text-slate-600 tabular-nums">
                              {utils.formatAmount(it.amount)}
                            </td>
                            <td className="!text-xs p-3 text-right font-semibold text-slate-700 tabular-nums">
                              {utils.formatAmount(it.total || it.amount)}
                            </td>
                            <td className="!text-xs p-3 text-center">
                              {/* <button
                                type="button"
                                className="text-emerald-500 hover:text-emerald-700"
                                title="Crear orden de pago"
                                onClick={() => openPaymentOrder(it)}
                              >
                                <Receipt className="w-4 h-4" />
                              </button> */}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>

      <PaymentOrderDialog
        open={payOrderOpen}
        onOpenChange={setPayOrderOpen}
        pendingItem={payOrderItem}
        onCreated={() => {
          refetch();
          queryClient.invalidateQueries({ queryKey: ["account-movements"] });
          queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
        }}
      />
    </>
  );
}
