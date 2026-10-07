import * as utils from "../utils/utils";

// Interpreta la respuesta de /suppliers/.../cuit-status para mostrarla.
// tone: "active" (verde), "inactive" (rojo) o "unknown" (gris: sin CUIT, error o cargando).
export function getCuitStatusInfo(status, { loading = false } = {}) {
  if (loading) return { tone: "unknown", label: "Consultando ARCA..." };
  if (!status || status.sinCuit) {
    return { tone: "unknown", label: "El proveedor no tiene CUIT cargado" };
  }
  if (status.error) {
    return { tone: "unknown", label: `No se pudo consultar ARCA: ${status.error}` };
  }
  const stale = status.desactualizado ? " (último dato disponible, ARCA no respondió)" : "";
  if (status.activo) return { tone: "active", label: `CUIT activo en ARCA${stale}` };
  const reason =
    status.estadoClave === "INEXISTENTE"
      ? "no existe en el padrón"
      : `estado ${status.estadoClave || "desconocido"}`;
  return { tone: "inactive", label: `CUIT inactivo en ARCA: ${reason}${stale}` };
}

const DOT_COLORS = {
  active: "bg-emerald-500",
  inactive: "bg-red-500",
  unknown: "bg-slate-300",
};

export function CuitStatusDot({ status, loading }) {
  const { tone, label } = getCuitStatusInfo(status, { loading });
  return (
    <span
      title={label}
      aria-label={label}
      className={utils.cn(
        "inline-block w-3 h-3 rounded-full",
        DOT_COLORS[tone],
        loading && "animate-pulse"
      )}
    />
  );
}
