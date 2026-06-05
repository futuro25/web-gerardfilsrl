import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Eye, Receipt } from "lucide-react";
import { DateTime } from "luxon";
import { EyeIcon } from "./icons";
import { Input } from "./common/Input";
import Spinner from "./common/Spinner";
import PurchaseInvoiceDetailDialog from "./PurchaseInvoiceDetailDialog";
import PaymentOrderViewDialog from "./PaymentOrderViewDialog";
import * as utils from "../utils/utils";
import {
  fetchAllSupplierAccounts,
  fetchSupplierAccount,
} from "../apis/api.supplieraccounts";
import { fetchPurchaseInvoices } from "../apis/api.supplierinvoices";
import {
  querySupplierAccountsListKey,
  querySupplierAccountKey,
  queryPurchaseInvoicesKey,
} from "../apis/queryKeys";

function categoryLabel(m) {
  if (m.category === "FACTURA_CONTROL") return "Factura";
  if (m.category === "FACTURA") return "Factura (Cashflow)";
  if (m.category === "ORDEN_PAGO") return "Orden de Pago";
  if (m.category === "INGRESO") return "Ingreso";
  if (m.category === "EGRESO") return "Egreso";
  return m.movement_type === "INGRESO" ? "Ingreso" : "Egreso";
}

/** Monto a mostrar: las OP usan display_amount (crédito), el resto signed_amount. */
function shownAmount(m) {
  return m.display_amount != null ? m.display_amount : m.signed_amount;
}

function movementInvoiceKey(m) {
  if (m.category === "FACTURA_CONTROL") return `control-${m.source_id}`;
  if (m.category === "FACTURA") return `cashflow-${m.source_id}`;
  return null;
}

function canViewInvoice(m) {
  return m.category === "FACTURA_CONTROL" || m.category === "FACTURA";
}

function canViewPaymentOrder(m) {
  return m.category === "ORDEN_PAGO" && Boolean(m.payment_order);
}

function supplierDisplayName(supplier) {
  return supplier?.fantasy_name || supplier?.name || "—";
}

function isZeroBalance(balance) {
  return Math.abs(parseFloat(balance) || 0) < 0.01;
}

export default function SupplierCurrentAccounts() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("LIST");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [search, setSearch] = useState("");
  const [hideZeroBalance, setHideZeroBalance] = useState(true);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [poDialogOpen, setPoDialogOpen] = useState(false);
  const [poView, setPoView] = useState(null);

  const {
    data: accountsList,
    isLoading: listLoading,
    error: listError,
  } = useQuery({
    queryKey: querySupplierAccountsListKey(),
    queryFn: fetchAllSupplierAccounts,
    enabled: stage === "LIST",
  });

  const {
    data: accountData,
    isLoading: detailLoading,
    error: detailError,
  } = useQuery({
    queryKey: querySupplierAccountKey(selectedSupplierId),
    queryFn: () => fetchSupplierAccount(selectedSupplierId),
    enabled: stage === "DETAIL" && Boolean(selectedSupplierId),
  });

  const { data: purchaseInvoicesRes } = useQuery({
    queryKey: queryPurchaseInvoicesKey({
      supplier_id: selectedSupplierId,
      limit: 500,
    }),
    queryFn: () =>
      fetchPurchaseInvoices({ supplier_id: selectedSupplierId, limit: 500 }),
    enabled: stage === "DETAIL" && Boolean(selectedSupplierId),
  });

  const invoiceByKey = useMemo(() => {
    const map = {};
    for (const inv of purchaseInvoicesRes?.data || []) {
      map[inv.key] = inv;
    }
    return map;
  }, [purchaseInvoicesRes]);

  const openInvoiceView = (m) => {
    const key = movementInvoiceKey(m);
    const inv = key ? invoiceByKey[key] : null;
    if (!inv) return;
    setSelectedInvoice(inv);
    setInvoiceDialogOpen(true);
  };

  const openPaymentOrderView = (m) => {
    if (!canViewPaymentOrder(m)) return;
    let invoiceNumber = null;
    if (m.supplier_invoice_id != null) {
      invoiceNumber =
        invoiceByKey[`control-${m.supplier_invoice_id}`]?.invoice_number || null;
    } else if (m.cashflow_id != null) {
      invoiceNumber =
        invoiceByKey[`cashflow-${m.cashflow_id}`]?.invoice_number || null;
    }
    setPoView({ order: m.payment_order, invoiceNumber });
    setPoDialogOpen(true);
  };

  const openDetail = (supplierId) => {
    setSelectedSupplierId(supplierId);
    setStage("DETAIL");
  };

  const backToList = () => {
    setStage("LIST");
    setSelectedSupplierId(null);
    setInvoiceDialogOpen(false);
    setSelectedInvoice(null);
    setPoDialogOpen(false);
    setPoView(null);
  };

  const headerBack = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      backToList();
    }
  };

  const searchLower = search.trim().toLowerCase();
  const filteredList =
    accountsList?.filter((row) => {
      if (hideZeroBalance && isZeroBalance(row.summary?.balance)) {
        return false;
      }
      if (!searchLower) return true;
      const s = row.supplier;
      const haystack = [
        s.fantasy_name,
        s.name,
        s.last_name,
        s.cuit,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(searchLower);
    }) ?? [];

  const totalSuppliers = accountsList?.length ?? 0;
  const hiddenZeroCount =
    hideZeroBalance && accountsList
      ? accountsList.filter((row) => isZeroBalance(row.summary?.balance)).length
      : 0;

  const movements = accountData?.movements || [];
  const summary = accountData?.summary;
  const detailSupplier = accountData?.supplier;

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div
          className="flex gap-2 items-center cursor-pointer text-xl font-bold pl-2"
          onClick={headerBack}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span>
            {stage === "LIST"
              ? "Cuentas Corrientes"
              : supplierDisplayName(detailSupplier)}
          </span>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto pb-28">
        {stage === "LIST" && (
          <>
            <div className="flex flex-col sm:flex-row gap-3 mb-4 mt-4">
              <div className="w-full flex shadow rounded flex-1">
                <Input
                  type="text"
                  value={search}
                  name="search"
                  id="search"
                  placeholder="Buscar proveedor..."
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 shrink-0 cursor-pointer select-none px-1">
                <input
                  type="checkbox"
                  className="rounded border-slate-300"
                  checked={hideZeroBalance}
                  onChange={(e) => setHideZeroBalance(e.target.checked)}
                />
                Ocultar saldo en cero
              </label>
            </div>

            {listLoading && <Spinner />}

            {listError && (
              <p className="text-red-500 text-sm">
                {listError.message || "Error al cargar el listado"}
              </p>
            )}

            {!listLoading && !listError && (
              <div className="my-4 mb-28">
                <p className="pl-1 pb-2 text-slate-500 text-sm">
                  {filteredList.length} proveedor
                  {filteredList.length !== 1 ? "es" : ""}
                  {hideZeroBalance && hiddenZeroCount > 0 && totalSuppliers > 0 && (
                    <span className="text-slate-400">
                      {" "}
                      · {hiddenZeroCount} con saldo $0 oculto
                      {hiddenZeroCount !== 1 ? "s" : ""}
                    </span>
                  )}
                </p>
                <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
                  <div className="shadow-sm overflow-auto my-2">
                    <table className="border-collapse table-auto w-full text-sm">
                      <thead>
                        <tr>
                          <th className="border-b font-medium p-3 text-slate-400 text-left">
                            Proveedor
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-left hidden sm:table-cell">
                            CUIT
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-right">
                            Saldo
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-center w-14">
                            Ver
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {filteredList.length === 0 ? (
                          <tr>
                            <td
                              colSpan={4}
                              className="p-4 text-center text-slate-500"
                            >
                              No hay proveedores para mostrar
                            </td>
                          </tr>
                        ) : (
                          filteredList.map((row, index) => {
                            const balance = row.summary?.balance ?? 0;
                            return (
                              <tr
                                key={row.supplier.id}
                                className={utils.cn(
                                  "border-b last:border-b-0 hover:bg-gray-100",
                                  index % 2 === 0 ? "bg-gray-50" : "bg-white"
                                )}
                              >
                                <td className="p-3 text-slate-700 text-xs font-medium">
                                  {supplierDisplayName(row.supplier)}
                                  {row.movement_count > 0 && (
                                    <span className="block text-[10px] text-slate-400 font-normal mt-0.5">
                                      {row.movement_count} movimiento
                                      {row.movement_count !== 1 ? "s" : ""}
                                    </span>
                                  )}
                                </td>
                                <td className="p-3 text-slate-500 text-xs hidden sm:table-cell">
                                  {row.supplier.cuit || "—"}
                                </td>
                                <td
                                  className={utils.cn(
                                    "p-3 text-right text-sm font-bold tabular-nums",
                                    balance >= 0
                                      ? "text-amber-700"
                                      : "text-emerald-700"
                                  )}
                                >
                                  {utils.formatAmount(balance)}
                                </td>
                                <td className="p-3 text-center">
                                  <button
                                    type="button"
                                    className="inline-flex items-center justify-center w-8 h-8 text-blue-500 hover:text-blue-700"
                                    title="Ver cuenta corriente"
                                    onClick={() => openDetail(row.supplier.id)}
                                  >
                                    <EyeIcon />
                                  </button>
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
          </>
        )}

        {stage === "DETAIL" && (
          <>
            {detailLoading && <Spinner />}

            {detailError && (
              <p className="text-red-500 text-sm mt-4">
                {detailError.message || "Error al cargar la cuenta"}
              </p>
            )}

            {!detailLoading && !detailError && accountData && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 my-4">
                  <SummaryCard
                    label="Egresos (Cashflow)"
                    value={summary?.totalCashflowEgresos ?? 0}
                    negative
                  />
                  <SummaryCard
                    label="Ingresos (Cashflow)"
                    value={summary?.totalCashflowIngresos ?? 0}
                    positive
                  />
                  <SummaryCard
                    label="Facturas (Control)"
                    value={summary?.totalControlInvoices ?? 0}
                    positive
                  />
                  <SummaryCard
                    label="Órdenes de pago"
                    value={summary?.totalPaymentOrders ?? 0}
                    negative
                  />
                  <SummaryCard
                    label="Saldo"
                    value={summary?.balance ?? 0}
                    highlight
                  />
                </div>

                <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden mb-8">
                  <div className="shadow-sm overflow-auto my-2">
                    <table className="border-collapse table-auto w-full text-sm">
                      <thead>
                        <tr>
                          <th className="border-b font-medium p-3 text-slate-400 text-left">
                            Fecha
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-left">
                            Tipo
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-left">
                            Detalle
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-right">
                            Monto
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-right">
                            Saldo
                          </th>
                          <th className="border-b font-medium p-3 text-slate-400 text-center w-12">
                            Doc
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {movements.length === 0 ? (
                          <tr>
                            <td
                              colSpan={6}
                              className="p-4 text-center text-slate-500"
                            >
                              No hay movimientos para este proveedor
                            </td>
                          </tr>
                        ) : (
                          movements.map((m, index) => (
                            <tr
                              key={m.id}
                              className={utils.cn(
                                "border-b last:border-b-0",
                                index % 2 === 0 ? "bg-gray-50" : "bg-white"
                              )}
                            >
                              <td className="p-3 text-slate-500 text-xs">
                                {m.date
                                  ? DateTime.fromISO(m.date).toFormat(
                                      "dd/MM/yyyy"
                                    )
                                  : "-"}
                              </td>
                              <td className="p-3 text-xs">
                                <span
                                  className={utils.cn(
                                    "px-2 py-0.5 rounded text-xs font-medium text-white",
                                    m.category === "ORDEN_PAGO"
                                      ? "bg-blue-500"
                                      : shownAmount(m) >= 0
                                      ? "bg-amber-500"
                                      : "bg-emerald-600"
                                  )}
                                >
                                  {categoryLabel(m)}
                                </span>
                              </td>
                              <td className="p-3 text-slate-600 text-xs max-w-[220px]">
                                <div className="truncate">
                                  {m.description}
                                </div>
                                {m.invoice_number && (
                                  <span className="block text-[10px] text-slate-400">
                                    {utils.formatInvoiceNumber(
                                      m.invoice_number
                                    )}
                                  </span>
                                )}
                                {m.taxes?.length > 0 && (
                                  <span className="block text-[10px] text-slate-400">
                                    {m.taxes
                                      .map(
                                        (t) =>
                                          `${t.name}: ${utils.formatAmount(t.amount)}`
                                      )
                                      .join(" · ")}
                                  </span>
                                )}
                              </td>
                              <td
                                className={utils.cn(
                                  "p-3 text-right text-xs font-medium tabular-nums",
                                  shownAmount(m) >= 0
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                )}
                              >
                                {shownAmount(m) >= 0 ? "+" : ""}
                                {utils.formatAmount(shownAmount(m))}
                              </td>
                              <td
                                className={utils.cn(
                                  "p-3 text-right text-xs font-bold tabular-nums",
                                  m.balance >= 0
                                    ? "text-gray-800"
                                    : "text-red-600"
                                )}
                              >
                                {utils.formatAmount(m.balance)}
                              </td>
                              <td className="p-3 text-center">
                                {canViewInvoice(m) && (
                                  <button
                                    type="button"
                                    onClick={() => openInvoiceView(m)}
                                    disabled={!movementInvoiceKey(m) || !invoiceByKey[movementInvoiceKey(m)]}
                                    title={
                                      invoiceByKey[movementInvoiceKey(m)]?.image_key
                                        ? "Ver factura"
                                        : "Ver factura (sin imagen)"
                                    }
                                    className="inline-flex items-center justify-center disabled:opacity-30"
                                  >
                                    <Eye
                                      className={utils.cn(
                                        "h-5 w-5",
                                        invoiceByKey[movementInvoiceKey(m)]?.image_key
                                          ? "text-green-600 hover:text-green-700"
                                          : "text-red-500 hover:text-red-600"
                                      )}
                                    />
                                  </button>
                                )}
                                {canViewPaymentOrder(m) && (
                                  <button
                                    type="button"
                                    onClick={() => openPaymentOrderView(m)}
                                    title={`Ver orden de pago ${
                                      m.payment_order?.order_number || ""
                                    }`}
                                    className="inline-flex items-center justify-center"
                                  >
                                    <Receipt className="h-5 w-5 text-emerald-600 hover:text-emerald-700" />
                                  </button>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </div>

      <PurchaseInvoiceDetailDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        invoice={selectedInvoice}
      />

      <PaymentOrderViewDialog
        open={poDialogOpen}
        onOpenChange={setPoDialogOpen}
        order={poView?.order}
        supplierName={supplierDisplayName(detailSupplier)}
        invoiceNumber={poView?.invoiceNumber || null}
      />
    </>
  );
}

function SummaryCard({ label, value, positive, negative, highlight }) {
  return (
    <div className="bg-white border rounded-lg p-4 shadow-sm">
      <p className="text-xs text-gray-500 uppercase tracking-wide">{label}</p>
      <p
        className={utils.cn(
          "text-lg font-bold mt-1",
          highlight && (value >= 0 ? "text-amber-700" : "text-emerald-700"),
          positive && !highlight && "text-amber-600",
          negative && !highlight && "text-emerald-600"
        )}
      >
        {utils.formatAmount(value)}
      </p>
    </div>
  );
}
