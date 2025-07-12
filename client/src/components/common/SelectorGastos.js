export default function SelectorGastos() {
  return (
    <select
      defaultValue={selectedSupplier?.service || ""}
      {...register("service", { required: true })}
      className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
    >
      <option value="">Seleccionar</option>
      {/* Agregá tus opciones acá */}
      <option value="BIENES">BIENES</option>
      <option value="SERVICIOS">SERVICIOS</option>
      <option value="MANTENIMIENTO">MANTENIMIENTO</option>
      <option value="PROFESIONALES">PROFESIONALES</option>
      <option value="LOGISTICA">LOGISTICA</option>
      <option value="OTROS">OTROS</option>
    </select>
  );
}
