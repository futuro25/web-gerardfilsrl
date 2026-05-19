import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { DateTime } from "luxon";
import SelectComboBox from "./common/SelectComboBox";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { fetchSupplierAccount } from "../apis/api.supplieraccounts";
import { querySupplierAccountKey, querySuppliersKey } from "../apis/queryKeys";

function categoryLabel(m) {
  if (m.category === "FACTURA") return "Factura";
  if (m.category === "PAGO") return "Pago";
  return m.movement_type === "INGRESO" ? "Ingreso" : "Egreso";
}

export default function SupplierCurrentAccounts() {
  const navigate = useNavigate();
  const [selectedSupplier, setSelectedSupplier] = useState(null);

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const {
    data: accountData,
    isLoading: accountLoading,
    error: accountError,
  } = useQuery({
    queryKey: querySupplierAccountKey(selectedSupplier?.id),
    queryFn: () => fetchSupplierAccount(selectedSupplier.id),
    enabled: Boolean(selectedSupplier?.id),
  });

  const supplierOptions = sortBy(suppliers || [], "fantasy_name").map((p) => ({
    id: p.id,
    name: p.fantasy_name,
    label: p.fantasy_name || p.name,
  }));

  const movements = accountData?.movements || [];
  const summary = accountData?.summary;

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div
          className="flex gap-2 items-center cursor-pointer text-xl font-bold pl-2"
          onClick={() => navigate("/home")}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span>Cuentas Corrientes</span>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto pb-28">
        <div className="my-4 max-w-md">
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Seleccionar proveedor
          </label>
          {suppliersLoading ? (
            <Spinner />
          ) : (
            <SelectComboBox
              options={supplierOptions}
              value={selectedSupplier}
              onChange={setSelectedSupplier}
            />
          )}
        </div>

        {selectedSupplier && (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <SummaryCard
                label="Total facturas"
                value={summary?.totalInvoices ?? 0}
                positive
              />
              <SummaryCard
                label="Total pagos"
                value={summary?.totalPayments ?? 0}
                negative
              />
              <SummaryCard
                label="Créditos / ingresos"
                value={summary?.totalCredits ?? 0}
                positive
              />
              <SummaryCard
                label="Saldo"
                value={summary?.balance ?? 0}
                highlight
              />
            </div>

            {accountLoading && <Spinner />}

            {accountError && (
              <p className="text-red-500 text-sm">
                {accountError.message || "Error al cargar la cuenta"}
              </p>
            )}

            {!accountLoading && !accountError && (
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
                                ? DateTime.fromISO(m.date).toFormat("dd/MM/yyyy")
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
                              <div className="truncate">{m.description}</div>
                              {m.invoice_number && (
                                <span className="block text-[10px] text-slate-400">
                                  {utils.formatInvoiceNumber(m.invoice_number)}
                                </span>
                              )}
                              {m.taxes?.length > 0 && (
                                <span className="block text-[10px] text-slate-400">
                                  {m.taxes
                                    .map((t) => `${t.name}: ${utils.formatAmount(t.amount)}`)
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
                                m.balance >= 0 ? "text-gray-800" : "text-red-600"
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
            )}
          </>
        )}

        {!selectedSupplier && !suppliersLoading && (
          <p className="text-sm text-slate-500 mt-6">
            Elegí un proveedor para ver su cuenta corriente con facturas y pagos.
          </p>
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
