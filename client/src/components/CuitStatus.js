import * as utils from "../utils/utils";

// Interpreta la respuesta de /suppliers/.../cuit-status para mostrarla.
// tone: "active" (verde), "inactive" (rojo) o "unknown" (gris: sin CUIT, error o cargando).
// text: valor corto para la columna del listado; label: detalle para el tooltip y el banner.
export function getCuitStatusInfo(status, { loading = false } = {}) {
  if (loading) return { tone: "unknown", text: "CONSULTANDO", label: "Consultando ARCA..." };
  if (!status || status.sinCuit) {
    return { tone: "unknown", text: "SIN CUIT", label: "El proveedor no tiene CUIT cargado" };
  }
  if (status.error) {
    return {
      tone: "unknown",
      text: status.error === "CUIT invalido" ? "CUIT INVÁLIDO" : "SIN DATOS",
      label: `No se pudo consultar ARCA: ${status.error}`,
    };
  }
  const stale = status.desactualizado ? " (último dato disponible, ARCA no respondió)" : "";
  if (status.activo) {
    return { tone: "active", text: "ACTIVO", label: `CUIT activo en ARCA${stale}` };
  }
  const reason =
    status.estadoClave === "INEXISTENTE"
      ? "no existe en el padrón"
      : `estado ${status.estadoClave || "desconocido"}`;
  return {
    tone: "inactive",
    text: "INACTIVO",
    label: `CUIT inactivo en ARCA: ${reason}${stale}`,
  };
}

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

// Cierre de ejercicio informado por ARCA (status.mesCierre, 1-12), como
// { month: "Diciembre", nextClose: "31/12/2026" } o null si no hay dato.
export function getFiscalYearClose(status) {
  const month = Number(status?.mesCierre);
  if (!month || month < 1 || month > 12) return null;
  const today = new Date();
  let year = today.getFullYear();
  if (month < today.getMonth() + 1) year += 1;
  const lastDay = new Date(year, month, 0).getDate();
  return {
    month: MONTHS[month - 1],
    nextClose: `${lastDay}/${String(month).padStart(2, "0")}/${year}`,
  };
}

const TEXT_COLORS = {
  active: "text-emerald-700",
  inactive: "text-red-700",
  unknown: "text-slate-400",
};

const DOT_COLORS = {
  active: "bg-emerald-500",
  inactive: "bg-red-500",
  unknown: "bg-slate-300",
};

export function CuitStatusDot({ status, loading }) {
  const { tone, text, label } = getCuitStatusInfo(status, { loading });
  return (
    <span title={label} className="inline-flex items-center gap-2 whitespace-nowrap">
      <span
        aria-hidden="true"
        className={utils.cn(
          "inline-block w-3 h-3 rounded-full shrink-0",
          DOT_COLORS[tone],
          loading && "animate-pulse"
        )}
      />
      <span className={utils.cn("font-medium", TEXT_COLORS[tone])}>{text}</span>
    </span>
  );
}
