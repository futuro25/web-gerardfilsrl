import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Button from "./common/Button";
import * as utils from "../utils/utils";

/**
 * Avisa que el detalle cargado parece corresponder a un gasto fijo ya
 * registrado, y ofrece reemplazarlo por el nombre de la plantilla. Que los
 * textos coincidan es lo que hace que el mes deje de proyectarse.
 */
export default function FixedExpenseSuggestionDialog({
  open,
  suggestion,
  onUse,
  onKeep,
}) {
  const matches = suggestion?.matches || [];
  const isAmbiguous = matches.length > 1;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onKeep?.()}>
      <DialogContent className="w-[95vw] max-w-lg p-6 gap-4 flex flex-col">
        <DialogTitle className="text-base font-semibold text-slate-900">
          ¿Es un gasto fijo ya registrado?
        </DialogTitle>

        <p className="text-sm text-slate-600">
          Cargaste el detalle{" "}
          <span className="font-medium text-slate-900">
            «{suggestion?.input}»
          </span>
          {isAmbiguous
            ? ", y coincide con más de un gasto fijo. Elegí cuál es:"
            : ", que parece ser este gasto fijo escrito de otra forma:"}
        </p>

        <div className="flex flex-col gap-2">
          {matches.map((match) => (
            <button
              key={match.expense.id}
              type="button"
              className="w-full text-left border border-slate-200 rounded-lg px-4 py-3 hover:border-sky-400 hover:bg-sky-50 transition-colors"
              onClick={() => onUse?.(match.expense.description)}
            >
              <span className="block text-sm font-medium text-slate-900">
                {match.expense.description}
              </span>
              <span className="block text-xs text-slate-500 mt-0.5">
                Todos los {match.expense.day_of_month}
                {match.expense.current_amount != null
                  ? ` · ${utils.formatAmount(match.expense.current_amount)}`
                  : ""}
                {match.via ? ` · ya se cargó como «${match.via}»` : ""}
              </span>
            </button>
          ))}
        </div>

        <p className="text-xs text-slate-500 border-t border-slate-100 pt-3">
          Si usás el mismo detalle que el gasto fijo, el movimiento se asocia
          solo y ese mes deja de proyectarse en Saldos futuros. Si lo dejás como
          está, el gasto se va a proyectar igual además de este movimiento.
        </p>

        <div className="flex flex-wrap gap-2 justify-end">
          <Button type="button" variant="outlined" size="sm" onClick={onKeep}>
            Dejar «{suggestion?.input}»
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
