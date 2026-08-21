import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { ArrowRightIcon } from "lucide-react";
import * as utils from "../utils/utils";

/**
 * Origen y destino de una transferencia entre cuentas propias.
 *
 * No pide forma de pago: entre cuentas nuestras siempre es transferencia, y el
 * back la fija sin mirar lo que mande el formulario.
 */
const EgresoTransferFields = forwardRef(function EgresoTransferFields(
  { accountMovement = null, showErrors = false },
  ref
) {
  const ownBanks = utils.getOwnBanks();
  const [bankFrom, setBankFrom] = useState("");
  const [bankTo, setBankTo] = useState("");

  useEffect(() => {
    setBankFrom(accountMovement?.bank || "");
    setBankTo(accountMovement?.bank_to || "");
  }, [accountMovement]);

  const sameBank = Boolean(bankFrom) && bankFrom === bankTo;

  const errorMessage = () => {
    if (!bankFrom) return "Indicá de qué banco sale la transferencia";
    if (!bankTo) return "Indicá a qué banco entra la transferencia";
    if (sameBank) {
      return "El banco de origen y el de destino tienen que ser distintos";
    }
    return null;
  };

  useImperativeHandle(ref, () => ({
    async validate() {
      const message = errorMessage();
      return message ? { ok: false, message } : { ok: true };
    },
    getPayload() {
      return {
        bank: bankFrom || null,
        bank_to: bankTo || null,
        payment_method: "TRANSFERENCIA",
      };
    },
    /** Sugerencia de detalle cuando el usuario no escribió ninguno. */
    getDescription() {
      if (!bankFrom || !bankTo) return "";
      return `Transferencia ${bankFrom} → ${bankTo}`;
    },
    reset() {
      setBankFrom("");
      setBankTo("");
    },
  }));

  const error = showErrors ? errorMessage() : null;

  return (
    <div className="flex flex-col gap-4 p-4 bg-indigo-50/60 rounded-lg border border-indigo-100">
      <div>
        <h3 className="text-sm font-semibold text-indigo-900">
          Transferencia entre cuentas propias
        </h3>
        <p className="text-xs text-indigo-700/80 mt-1">
          La plata no sale de la empresa: el saldo total no cambia, solo se mueve
          de una cuenta a la otra.
        </p>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-end gap-3">
        <div className="flex-1">
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Desde <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border border-gray-100 rounded px-2 h-12 text-sm bg-white focus:outline-none focus:border-slate-400"
            value={bankFrom}
            onChange={(e) => {
              const next = e.target.value;
              setBankFrom(next);
              // El destino sale de la lista al elegirlo como origen: si quedaba
              // seleccionado, el select mostraría un valor que ya no existe.
              if (next && next === bankTo) setBankTo("");
            }}
          >
            <option value="">Seleccionar...</option>
            {ownBanks.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </div>

        <ArrowRightIcon className="hidden sm:block h-4 w-4 text-indigo-400 shrink-0 mb-4" />

        <div className="flex-1">
          <label className="text-xs font-sans text-gray-900 mb-2 block">
            Hacia <span className="text-red-500">*</span>
          </label>
          <select
            className="w-full border border-gray-100 rounded px-2 h-12 text-sm bg-white focus:outline-none focus:border-slate-400"
            value={bankTo}
            onChange={(e) => setBankTo(e.target.value)}
          >
            <option value="">Seleccionar...</option>
            {ownBanks
              .filter((b) => b !== bankFrom)
              .map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
});

export default EgresoTransferFields;
