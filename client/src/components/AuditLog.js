import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { CloseIcon } from "./icons";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { fetchAuditLog, fetchAuditLogFilters } from "../apis/api.auditlog";
import { queryAuditLogKey, queryAuditLogFiltersKey } from "../apis/queryKeys";

const PAGE_SIZE = 50;

const ACTION_META = {
  create: { label: "Creó", pill: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  update: { label: "Editó", pill: "bg-blue-50 text-blue-700 border-blue-200" },
  delete: { label: "Eliminó", pill: "bg-red-50 text-red-700 border-red-200" },
};

const ENTITY_LABELS = {
  "account-movements": "Movimientos de cuenta",
  aportes: "Aportes",
  cashflow: "Cashflow",
  clients: "Clientes",
  deliveries: "Facturas ventas",
  deliverynotes: "Remitos",
  "fixed-expenses": "Gastos fijos",
  invoices: "Facturas",
  orders: "Pedidos",
  paychecks: "Cheques",
  "payment-orders": "Órdenes de pago",
  payments: "Pagos",
  products: "Productos",
  "retention-certificates": "Retenciones",
  "stock-entries": "Stock",
  "supplier-invoices": "Facturas de compra",
  suppliers: "Proveedores",
  uploads: "Archivos",
  users: "Usuarios",
  utils: "Envíos",
  veps: "VEPs",
};

function entityLabel(entity) {
  return ENTITY_LABELS[entity] || entity;
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const EMPTY_FILTERS = {
  user_id: "",
  entity: "",
  action: "",
  from: "",
  to: "",
  search: "",
};

export default function AuditLog() {
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);
  const navigate = useNavigate();

  const params = { ...filters, page, limit: PAGE_SIZE };

  const { data, isLoading, isFetching, error } = useQuery({
    queryKey: queryAuditLogKey(params),
    queryFn: () => fetchAuditLog(params),
    placeholderData: keepPreviousData,
  });

  const { data: filterOptions } = useQuery({
    queryKey: queryAuditLogFiltersKey(),
    queryFn: fetchAuditLogFilters,
  });

  const rows = data?.data || [];
  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  if (error) console.log(error);

  const updateFilter = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Auditoría</div>
          </div>
          {isFetching && <span className="text-xs font-normal text-slate-400">Actualizando…</span>}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
          <select
            className="border border-slate-200 rounded p-2 text-sm text-slate-600 bg-white"
            value={filters.user_id}
            onChange={(e) => updateFilter("user_id", e.target.value)}
          >
            <option value="">Todos los usuarios</option>
            {(filterOptions?.users || []).map((user) => (
              <option key={user.id} value={user.id}>
                {user.username}
              </option>
            ))}
          </select>

          <select
            className="border border-slate-200 rounded p-2 text-sm text-slate-600 bg-white"
            value={filters.entity}
            onChange={(e) => updateFilter("entity", e.target.value)}
          >
            <option value="">Todos los módulos</option>
            {(filterOptions?.entities || []).map((entity) => (
              <option key={entity} value={entity}>
                {entityLabel(entity)}
              </option>
            ))}
          </select>

          <select
            className="border border-slate-200 rounded p-2 text-sm text-slate-600 bg-white"
            value={filters.action}
            onChange={(e) => updateFilter("action", e.target.value)}
          >
            <option value="">Todas las acciones</option>
            <option value="create">Creó</option>
            <option value="update">Editó</option>
            <option value="delete">Eliminó</option>
          </select>

          <div className="flex gap-2">
            <input
              type="date"
              className="border border-slate-200 rounded p-2 text-sm text-slate-600 bg-white w-full"
              value={filters.from}
              onChange={(e) => updateFilter("from", e.target.value)}
            />
            <input
              type="date"
              className="border border-slate-200 rounded p-2 text-sm text-slate-600 bg-white w-full"
              value={filters.to}
              onChange={(e) => updateFilter("to", e.target.value)}
            />
          </div>
        </div>

        <div className="w-full flex shadow rounded mb-2">
          <Input
            rightElement={
              <div className="cursor-pointer" onClick={() => updateFilter("search", "")}>
                {filters.search && <CloseIcon />}
              </div>
            }
            type="text"
            value={filters.search}
            name="search"
            id="search"
            placeholder="Buscar por usuario, módulo o número de registro..."
            onChange={(e) => updateFilter("search", e.target.value)}
          />
        </div>

        {hasFilters && (
          <div className="flex justify-end mb-2">
            <button className="text-xs text-slate-500 underline" onClick={clearFilters}>
              Limpiar filtros
            </button>
          </div>
        )}

        {isLoading && (
          <div>
            <Spinner />
          </div>
        )}

        {!isLoading && (
          <div className="my-2 mb-28">
            <p className="pl-1 pb-1 text-slate-500">
              {total} registro{total === 1 ? "" : "s"} de auditoría
            </p>

            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-auto my-8">
                  <table className="border-collapse table-auto w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Usuario
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Acción
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Módulo
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Registro
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Detalle
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {rows.length ? (
                        rows.map((row, index) => {
                          const meta = ACTION_META[row.action] || {
                            label: row.action,
                            pill: "bg-gray-50 text-gray-600 border-gray-200",
                          };
                          const expanded = expandedId === row.id;
                          return (
                            <React.Fragment key={row.id}>
                              <tr
                                className={utils.cn(
                                  "border-b last:border-b-0 hover:bg-gray-100",
                                  index % 2 === 0 && "bg-gray-50",
                                  !row.ok && "bg-red-50"
                                )}
                              >
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {formatDateTime(row.created_at)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {row.username || (
                                    <span className="text-slate-400 italic">sin identificar</span>
                                  )}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  <span
                                    className={utils.cn(
                                      "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] uppercase font-medium",
                                      meta.pill
                                    )}
                                  >
                                    {meta.label}
                                  </span>
                                  {!row.ok && (
                                    <span className="ml-2 text-[10px] uppercase font-medium text-red-600">
                                      falló
                                    </span>
                                  )}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {entityLabel(row.entity)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {row.entity_id ? `#${row.entity_id}` : "—"}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                  <button
                                    className="text-slate-500 underline"
                                    onClick={() => setExpandedId(expanded ? null : row.id)}
                                  >
                                    {expanded ? "Ocultar" : "Ver"}
                                  </button>
                                </td>
                              </tr>
                              {expanded && (
                                <tr className="bg-slate-50">
                                  <td colSpan={6} className="border-b border-slate-100 p-4">
                                    <div className="flex flex-col gap-2 text-xs text-slate-500">
                                      <div>
                                        <span className="font-medium text-slate-600">Endpoint: </span>
                                        {row.method} {row.path}
                                      </div>
                                      {row.error && (
                                        <div className="text-red-600">
                                          <span className="font-medium">Error: </span>
                                          {row.error}
                                        </div>
                                      )}
                                      <div>
                                        <span className="font-medium text-slate-600">IP: </span>
                                        {row.ip || "—"}
                                      </div>
                                      <div>
                                        <span className="font-medium text-slate-600">Datos enviados:</span>
                                        <pre className="mt-1 bg-white border border-slate-200 rounded p-2 overflow-auto max-h-64 text-[11px]">
{JSON.stringify(row.payload, null, 2)}
                                        </pre>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td className="!text-xs text-center p-6 text-slate-400" colSpan={6}>
                            No hay movimientos registrados con esos filtros
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {total > PAGE_SIZE && (
              <div className="flex items-center justify-between gap-2">
                <Button
                  variant="alternative"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(p - 1, 1))}
                >
                  Anterior
                </Button>
                <span className="text-xs text-slate-500">
                  Página {page} de {totalPages}
                </span>
                <Button
                  variant="alternative"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                >
                  Siguiente
                </Button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
