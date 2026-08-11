import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";

import Button from "./common/Button";
import Spinner from "./common/Spinner";
import ConfirmDialog from "./common/ConfirmDialog";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import * as utils from "../utils/utils";
import {
  fetchFixedExpenses,
  updateFixedExpense,
  deleteFixedExpense,
  createFixedExpenseAmount,
  deleteFixedExpenseAmount,
} from "../apis/api.fixedexpenses";
import {
  queryFixedExpensesKey,
  queryFixedExpenseNamesKey,
  queryAccountFutureBalancesKey,
} from "../apis/queryKeys";

/** "2026-07-01" -> "07/2026" */
const formatMonth = (iso) => {
  if (!iso) return "-";
  const [year, month] = String(iso).split("-");
  return `${month}/${year}`;
};

/** Valor para <input type="month">. */
const toMonthInput = (iso) => (iso ? String(iso).slice(0, 7) : "");

const currentMonthInput = () => new Date().toISOString().slice(0, 7);

/**
 * Formato de moneda mientras se tipea: miles con punto y decimales con coma,
 * como se escribe acá. Se guarda el texto formateado y se parsea al enviar.
 */
const formatMoneyInput = (raw) => {
  const cleaned = String(raw ?? "").replace(/[^\d,]/g, "");
  if (!cleaned) return "";
  const [whole, ...rest] = cleaned.split(",");
  const digits = whole.replace(/^0+(?=\d)/, "");
  const grouped = digits ? Number(digits).toLocaleString("es-AR") : "0";
  // Mientras escribe puede quedar la coma sin decimales todavía.
  if (!rest.length) return grouped;
  return `${grouped},${rest.join("").slice(0, 2)}`;
};

const parseMoneyInput = (raw) => {
  const cleaned = String(raw ?? "").replace(/\./g, "").replace(",", ".");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Mes anterior al actual, para dar de baja sin seguir proyectando. */
const previousMonthIso = () => {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}-01`;
};

export default function FixedExpensesDialog({ open, onOpenChange }) {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [confirm, setConfirm] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: queryFixedExpensesKey(),
    queryFn: fetchFixedExpenses,
    enabled: open,
  });

  const expenses = data?.data || [];

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: queryFixedExpensesKey() });
    queryClient.invalidateQueries({ queryKey: queryFixedExpenseNamesKey() });
    queryClient.invalidateQueries({ queryKey: queryAccountFutureBalancesKey() });
    queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
  };

  const runMutation = (mutationFn) => ({
    mutationFn,
    onSuccess: (result) => {
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      refresh();
    },
    onError: (e) => window.alert(e?.message || "No se pudo guardar el cambio"),
  });

  const amountMutation = useMutation(runMutation(createFixedExpenseAmount));
  const deleteAmountMutation = useMutation(runMutation(deleteFixedExpenseAmount));
  const expenseMutation = useMutation(runMutation(updateFixedExpense));
  const deleteExpenseMutation = useMutation(runMutation(deleteFixedExpense));

  const draftFor = (id) =>
    drafts[id] || { amount: "", month: currentMonthInput() };

  const setDraft = (id, patch) =>
    setDrafts((prev) => ({ ...prev, [id]: { ...draftFor(id), ...patch } }));

  const handleAddAmount = (expense) => {
    const draft = draftFor(expense.id);
    const amount = parseMoneyInput(draft.amount);
    if (amount == null || amount <= 0) {
      window.alert("El importe debe ser mayor a 0");
      return;
    }
    if (!draft.month) {
      window.alert("Indicá desde qué mes rige el importe");
      return;
    }
    amountMutation.mutate(
      { id: expense.id, amount, effective_from: draft.month },
      {
        onSuccess: (result) => {
          if (!result?.error) setDraft(expense.id, { amount: "" });
        },
      }
    );
  };

  const isBusy =
    amountMutation.isPending ||
    deleteAmountMutation.isPending ||
    expenseMutation.isPending ||
    deleteExpenseMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="w-[95vw] max-w-2xl max-h-[85vh] overflow-hidden flex flex-col p-6 gap-3">
          <div className="flex items-start justify-between gap-2">
            <DialogTitle className="text-lg font-semibold text-slate-800 pr-6">
              Gastos fijos
            </DialogTitle>
            <button
              type="button"
              className="text-slate-400 hover:text-slate-600 text-sm shrink-0"
              onClick={() => onOpenChange(false)}
            >
              Cerrar
            </button>
          </div>

          <p className="text-xs text-slate-500">
            Cada gasto fijo se proyecta en Saldos futuros todos los meses, con el
            importe vigente en cada uno. Cuando cargás el movimiento real de un
            mes en Control, ese mes deja de proyectarse.
          </p>

          <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
            {isLoading && (
              <div className="p-8 flex justify-center">
                <Spinner />
              </div>
            )}

            {!isLoading && data?.error && (
              <p className="p-4 text-sm text-red-600">{String(data.error)}</p>
            )}

            {!isLoading && !data?.error && expenses.length === 0 && (
              <p className="p-6 text-sm text-center text-slate-500">
                Todavía no hay gastos fijos. Marcá un egreso como fijo desde el
                listado de movimientos para que empiece a proyectarse.
              </p>
            )}

            {!isLoading &&
              !data?.error &&
              expenses.map((expense) => {
                const isExpanded = expandedId === expense.id;
                const draft = draftFor(expense.id);

                return (
                  <div key={expense.id} className="p-3 sm:p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button
                        type="button"
                        className="flex items-start gap-2 text-left min-w-0 flex-1"
                        onClick={() =>
                          setExpandedId(isExpanded ? null : expense.id)
                        }
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-4 h-4 mt-0.5 text-slate-400 shrink-0" />
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-slate-800 truncate">
                            {expense.description}
                          </span>
                          <span className="block text-xs text-slate-500">
                            Todos los {expense.day_of_month} · desde{" "}
                            {formatMonth(expense.start_month)}
                            {expense.end_month
                              ? ` · hasta ${formatMonth(expense.end_month)}`
                              : ""}
                          </span>
                          <span className="block text-xs text-slate-500">
                            {expense.next_occurrence
                              ? `Próxima proyección: ${utils.formatDate(
                                  expense.next_occurrence.date
                                )}`
                              : "Sin proyecciones en los próximos 3 meses"}
                          </span>
                        </span>
                      </button>

                      <div className="text-right shrink-0">
                        <span className="block text-sm font-semibold text-red-600 tabular-nums">
                          {expense.current_amount != null
                            ? utils.formatAmount(expense.current_amount)
                            : "sin importe"}
                        </span>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-400">
                          {expense.active ? "vigente" : "dado de baja"}
                        </span>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="mt-3 pl-6 flex flex-col gap-3">
                        <div>
                          <p className="text-xs font-medium text-slate-600 mb-1">
                            Importes por período
                          </p>
                          <table className="w-full text-xs border-collapse">
                            <tbody>
                              {expense.amounts.map((amountRow) => (
                                <tr
                                  key={amountRow.id}
                                  className="border-b border-slate-100 last:border-b-0"
                                >
                                  <td className="py-1.5 text-slate-600">
                                    Desde {formatMonth(amountRow.effective_from)}
                                  </td>
                                  <td className="py-1.5 text-right tabular-nums font-medium text-slate-800">
                                    {utils.formatAmount(amountRow.amount)}
                                  </td>
                                  <td className="py-1.5 text-right w-8">
                                    {expense.amounts.length > 1 && (
                                      <button
                                        type="button"
                                        className="text-slate-400 hover:text-red-600 disabled:opacity-40"
                                        disabled={isBusy}
                                        title="Eliminar este período"
                                        onClick={() =>
                                          deleteAmountMutation.mutate({
                                            id: expense.id,
                                            amountId: amountRow.id,
                                          })
                                        }
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>

                        <div className="flex flex-wrap items-end gap-2">
                          <label className="flex flex-col gap-1">
                            <span className="text-[11px] text-slate-500">
                              Nuevo importe desde
                            </span>
                            <input
                              type="month"
                              className="border border-slate-200 rounded px-2 h-9 text-sm"
                              value={draft.month}
                              onChange={(e) =>
                                setDraft(expense.id, { month: e.target.value })
                              }
                            />
                          </label>
                          <label className="flex flex-col gap-1 flex-1 min-w-[9rem]">
                            <span className="text-[11px] text-slate-500">
                              Importe
                            </span>
                            <span className="relative block">
                              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-slate-400 pointer-events-none">
                                $
                              </span>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="0,00"
                                className="border border-slate-200 rounded pl-6 pr-2 h-9 text-sm w-full text-right tabular-nums"
                                value={draft.amount}
                                onChange={(e) =>
                                  setDraft(expense.id, {
                                    amount: formatMoneyInput(e.target.value),
                                  })
                                }
                              />
                            </span>
                          </label>
                          <Button
                            type="button"
                            size="sm"
                            className="h-9"
                            disabled={isBusy}
                            onClick={() => handleAddAmount(expense)}
                          >
                            Guardar importe
                          </Button>
                        </div>

                        <div className="flex flex-wrap gap-2 pt-1">
                          {expense.active ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outlined"
                              disabled={isBusy}
                              title="Deja de proyectarse en Saldos futuros"
                              onClick={() =>
                                expenseMutation.mutate({
                                  id: expense.id,
                                  end_month: previousMonthIso(),
                                })
                              }
                            >
                              Dar de baja
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={isBusy}
                              onClick={() =>
                                expenseMutation.mutate({
                                  id: expense.id,
                                  end_month: null,
                                })
                              }
                            >
                              Reactivar
                            </Button>
                          )}
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive-outlined"
                            disabled={isBusy}
                            onClick={() => setConfirm(expense)}
                          >
                            Eliminar
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
          </div>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={Boolean(confirm)}
        onOpenChange={(value) => !value && setConfirm(null)}
        variant="destructive"
        title="Eliminar gasto fijo"
        description={
          confirm
            ? `Se deja de proyectar "${confirm.description}" y los ${confirm.movements_count} movimiento(s) ya cargados pierden la marca de fijo. Los movimientos no se borran.`
            : ""
        }
        confirmLabel="Eliminar"
        onConfirm={() => {
          const target = confirm;
          setConfirm(null);
          if (target) deleteExpenseMutation.mutate(target.id);
        }}
      />
    </>
  );
}
