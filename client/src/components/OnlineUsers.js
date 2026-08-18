import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { useQuery } from "@tanstack/react-query";
import { CloseIcon } from "./icons";
import { Input } from "./common/Input";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import { fetchPresence } from "../apis/api.presence";
import { queryPresenceKey } from "../apis/queryKeys";

const REFRESH_MS = 20000;

const STATUS_META = {
  activo: {
    label: "Activo",
    dot: "bg-emerald-500",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-200",
    help: "Trabajando ahora",
  },
  inactivo: {
    label: "Inactivo",
    dot: "bg-amber-400",
    pill: "bg-amber-50 text-amber-700 border-amber-200",
    help: "Sesión abierta sin actividad",
  },
  offline: {
    label: "Offline",
    dot: "bg-gray-300",
    pill: "bg-gray-50 text-gray-500 border-gray-200",
    help: "Sesión cerrada",
  },
};

const PATH_LABELS = {
  "/": "Inicio",
  "/home": "Inicio",
  "/usuarios": "Usuarios",
  "/en-linea": "Usuarios en línea",
  "/pagos": "Pagos",
  "/facturas": "Facturas",
  "/proveedores": "Proveedores",
  "/clientes": "Clientes",
  "/productos": "Productos",
  "/pedidos": "Pedidos",
  "/stock": "Stock",
  "/remitos": "Egreso de mercadería",
  "/entregas": "Facturas ventas",
  "/cheques": "Cheques",
  "/control": "Control",
  "/cuentas-corrientes": "Cuentas corrientes",
  "/facturas-pendientes": "Facturas pendientes",
  "/facturas-compras": "Facturas compras",
  "/aportes": "Aportes",
  "/veps": "VEPs",
  "/certificados-retencion": "Retenciones",
  "/exportacion-fiscal": "Export fiscal",
  "/cashflow": "Cashflow",
  "/libros-selector": "Libros",
};

function pathLabel(path) {
  if (!path) return "—";
  if (PATH_LABELS[path]) return PATH_LABELS[path];
  if (path.startsWith("/remito/")) return "Remito";
  return path;
}

function relativeTime(seconds) {
  if (seconds == null) return "—";
  if (seconds < 60) return "hace instantes";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return `hace ${Math.floor(hours / 24)} d`;
}

function secondsSince(value) {
  if (!value) return null;
  const ts = new Date(value).getTime();
  if (Number.isNaN(ts)) return null;
  return Math.max(0, Math.round((Date.now() - ts) / 1000));
}

function formatDateTime(value) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fullName(user) {
  return [user.name, user.last_name].filter(Boolean).join(" ") || user.username;
}

function deviceLabel(userAgent) {
  if (!userAgent) return null;
  return /mobile|android|iphone|ipad/i.test(userAgent) ? "Mobile" : "Desktop";
}

export default function OnlineUsers() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const navigate = useNavigate();

  const { data, isLoading, error, dataUpdatedAt } = useQuery({
    queryKey: queryPresenceKey(),
    queryFn: fetchPresence,
    refetchInterval: REFRESH_MS,
    refetchOnWindowFocus: true,
  });

  const users = data?.users || [];
  const summary = data?.summary || {
    activos: 0,
    inactivos: 0,
    offline: 0,
    total: 0,
  };

  const usersFiltered = users.filter((user) => {
    if (statusFilter !== "TODOS" && user.status !== statusFilter) return false;
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      fullName(user).toLowerCase().includes(term) ||
      String(user.username || "").toLowerCase().includes(term) ||
      String(user.email || "").toLowerCase().includes(term)
    );
  });

  if (error) console.log(error);

  const cards = [
    { key: "activo", label: "Activos", value: summary.activos },
    { key: "inactivo", label: "Inactivos", value: summary.inactivos },
    { key: "offline", label: "Offline", value: summary.offline },
  ];

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Usuarios en línea</div>
          </div>
          <span className="text-xs font-normal text-slate-400">
            Actualizado {dataUpdatedAt ? relativeTime(secondsSince(dataUpdatedAt)) : "—"}
          </span>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        <div className="grid grid-cols-3 gap-3 mb-4">
          {cards.map((card) => {
            const meta = STATUS_META[card.key];
            const selected = statusFilter === card.key;
            return (
              <div
                key={card.key}
                onClick={() =>
                  setStatusFilter(selected ? "TODOS" : card.key)
                }
                className={utils.cn(
                  "flex flex-col gap-1 border rounded-lg p-3 bg-white shadow-sm cursor-pointer transition-colors",
                  selected ? "border-slate-400 bg-slate-50" : "hover:bg-gray-50"
                )}
              >
                <div className="flex items-center gap-2">
                  <span className={utils.cn("w-2.5 h-2.5 rounded-full", meta.dot)} />
                  <span className="text-xs text-slate-500">{card.label}</span>
                </div>
                <span className="text-2xl font-bold text-slate-700">
                  {card.value}
                </span>
                <span className="text-[10px] text-slate-400">{meta.help}</span>
              </div>
            );
          })}
        </div>

        <div className="w-full flex shadow rounded mb-4">
          <Input
            rightElement={
              <div className="cursor-pointer" onClick={() => setSearch("")}>
                {search && <CloseIcon />}
              </div>
            }
            type="text"
            value={search}
            name="search"
            id="search"
            placeholder="Buscador..."
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {isLoading && (
          <div>
            <Spinner />
          </div>
        )}

        {!isLoading && (
          <div className="my-4 mb-28">
            <div className="flex items-center justify-between pl-1 pb-1">
              <p className="text-slate-500">
                Mostrando {usersFiltered.length} de {summary.total} usuarios
              </p>
              {statusFilter !== "TODOS" && (
                <button
                  className="text-xs text-slate-500 underline"
                  onClick={() => setStatusFilter("TODOS")}
                >
                  Ver todos
                </button>
              )}
            </div>

            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-auto my-8">
                  <table className="border-collapse table-auto w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Usuario
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Estado
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Última actividad
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Pantalla
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Sesión
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Último login
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {usersFiltered.length ? (
                        usersFiltered.map((user, index) => {
                          const meta = STATUS_META[user.status] || STATUS_META.offline;
                          const device = deviceLabel(user.user_agent);
                          return (
                            <tr
                              key={user.id}
                              className={utils.cn(
                                "border-b last:border-b-0 hover:bg-gray-100",
                                index % 2 === 0 && "bg-gray-50",
                                user.status === "offline" && "opacity-70"
                              )}
                            >
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                <div className="flex items-center gap-2">
                                  <span
                                    className={utils.cn(
                                      "w-2.5 h-2.5 rounded-full shrink-0",
                                      meta.dot
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="font-medium text-slate-700">
                                      {fullName(user)}
                                    </span>
                                    <span className="text-[10px] text-slate-400">
                                      {user.username} · {user.type}
                                    </span>
                                  </div>
                                </div>
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
                                {user.sessions_count > 1 && (
                                  <span className="ml-2 text-[10px] text-slate-400">
                                    {user.sessions_count} sesiones
                                  </span>
                                )}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                {user.status === "offline"
                                  ? "—"
                                  : relativeTime(user.seconds_since_activity)}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                {user.status === "offline"
                                  ? "—"
                                  : pathLabel(user.current_path)}
                                {device && user.status !== "offline" && (
                                  <span className="ml-2 text-[10px] text-slate-400">
                                    {device}
                                  </span>
                                )}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                {user.session_started_at
                                  ? `desde ${formatDateTime(user.session_started_at)}`
                                  : "—"}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                {formatDateTime(user.last_login)}
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            className="!text-xs text-center p-6 text-slate-400"
                            colSpan={6}
                          >
                            No hay usuarios para mostrar
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
