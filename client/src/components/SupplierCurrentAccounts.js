import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { DateTime } from "luxon";
import { EyeIcon } from "./icons";
import { Input } from "./common/Input";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import {
  fetchAllSupplierAccounts,
  fetchSupplierAccount,
} from "../apis/api.supplieraccounts";
import {
  querySupplierAccountsListKey,
  querySupplierAccountKey,
} from "../apis/queryKeys";

function categoryLabel(m) {
  if (m.category === "FACTURA_CONTROL") return "Factura (Control)";
  if (m.category === "FACTURA") return "Factura (Cashflow)";
  if (m.category === "INGRESO") return "Ingreso";
  if (m.category === "EGRESO") return "Egreso";
  return m.movement_type === "INGRESO" ? "Ingreso" : "Egreso";
}

function supplierDisplayName(supplier) {
  return supplier?.fantasy_name || supplier?.name || "—";
}

export default function SupplierCurrentAccounts() {
  const navigate = useNavigate();
  const [stage, setStage] = useState("LIST");
  const [selectedSupplierId, setSelectedSupplierId] = useState(null);
  const [search, setSearch] = useState("");

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

  const openDetail = (supplierId) => {
    setSelectedSupplierId(supplierId);
    setStage("DETAIL");
  };

  const backToList = () => {
    setStage("LIST");
    setSelectedSupplierId(null);
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
            <div className="w-full flex shadow rounded mb-4 mt-4">
              <Input
                type="text"
                value={search}
                name="search"
                id="search"
                placeholder="Buscar proveedor..."
                onChange={(e) => setSearch(e.target.value)}
              />
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
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
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
                        </tr>
                      </thead>
                      <tbody className="bg-white">
                        {movements.length === 0 ? (
                          <tr>
                            <td
                              colSpan={5}
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
                                    m.signed_amount >= 0
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
                                  m.signed_amount >= 0
                                    ? "text-amber-700"
                                    : "text-emerald-700"
                                )}
                              >
                                {m.signed_amount >= 0 ? "+" : ""}
                                {utils.formatAmount(m.signed_amount)}
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
