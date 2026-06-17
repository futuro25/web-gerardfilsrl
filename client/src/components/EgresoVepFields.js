import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DateTime } from "luxon";
import Spinner from "./common/Spinner";
import { fetchVeps } from "../apis/api.veps";
import { queryVepsKey } from "../apis/queryKeys";
import * as utils from "../utils/utils";

function categoryLabel(vep) {
  if (!vep) return "—";
  return vep.display_category || vep.category || "—";
}

function formatVepOption(vep) {
  const due = vep.due_date
    ? DateTime.fromISO(vep.due_date).toFormat("dd/MM/yyyy")
    : "—";
  return `${categoryLabel(vep)} · Vence ${due} · ${utils.formatAmount(vep.amount)}`;
}

const EgresoVepFields = forwardRef(function EgresoVepFields(
  { accountMovement = null, showErrors = false, onVepChange, readOnly = false },
  ref
) {
  const [selectedVepId, setSelectedVepId] = useState("");

  const { data: res, isLoading } = useQuery({
    queryKey: queryVepsKey(),
    queryFn: fetchVeps,
  });

  const allVeps = res?.data || [];

  const pendingVeps = useMemo(
    () =>
      allVeps.filter(
        (v) => !v.paid_at && v.status !== "pagado"
      ),
    [allVeps]
  );

  const options = useMemo(() => {
    const list = [...pendingVeps];
    if (
      accountMovement?.vep_id &&
      !list.some((v) => v.id === accountMovement.vep_id)
    ) {
      const linked = allVeps.find((v) => v.id === accountMovement.vep_id);
      if (linked) list.unshift(linked);
    }
    return list;
  }, [pendingVeps, allVeps, accountMovement?.vep_id]);

  const selectedVep =
    options.find((v) => String(v.id) === String(selectedVepId)) ||
    allVeps.find((v) => v.id === accountMovement?.vep_id) ||
    null;

  useEffect(() => {
    if (accountMovement?.vep_id) {
      setSelectedVepId(String(accountMovement.vep_id));
    } else {
      setSelectedVepId("");
    }
  }, [accountMovement?.vep_id]);

  useImperativeHandle(ref, () => ({
    validate: async () => {
      if (readOnly) return { ok: true };
      if (!selectedVepId) {
        return { ok: false, message: "Seleccioná el VEP que estás pagando" };
      }
      return { ok: true };
    },
    getPayload: () => ({
      vep_id: selectedVepId ? parseInt(selectedVepId, 10) : null,
    }),
    reset: () => setSelectedVepId(""),
  }));

  const handleChange = (vepId) => {
    setSelectedVepId(vepId);
    const vep = options.find((v) => String(v.id) === String(vepId));
    if (vep && onVepChange) {
      onVepChange(vep);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 py-2">
        <Spinner />
        Cargando VEPs...
      </div>
    );
  }

  if (readOnly && selectedVep) {
    return (
      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
        <p className="font-medium">{formatVepOption(selectedVep)}</p>
        {selectedVep.paid_at && (
          <p className="text-xs text-emerald-700 mt-1 uppercase font-medium">
            Pagado
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-sans text-gray-900">VEP a pagar</label>
      <select
        className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
        value={selectedVepId}
        onChange={(e) => handleChange(e.target.value)}
        disabled={readOnly}
      >
        <option value="">Seleccionar VEP pendiente...</option>
        {options.map((vep) => (
          <option key={vep.id} value={vep.id}>
            {formatVepOption(vep)}
          </option>
        ))}
      </select>
      {!options.length && (
        <p className="text-xs text-amber-700">
          No hay VEPs pendientes. Creá uno en el módulo VEPs.
        </p>
      )}
      {showErrors && !selectedVepId && (
        <span className="text-red-500 text-sm">* Obligatorio</span>
      )}
      {selectedVep && (
        <p className="text-xs text-slate-500">
          Importe del VEP: {utils.formatAmount(selectedVep.amount)}
        </p>
      )}
    </div>
  );
});

export default EgresoVepFields;
