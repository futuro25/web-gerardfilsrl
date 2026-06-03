import { useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "./common/Input";
import Button from "./common/Button";
import FormActions from "./common/FormActions";
import Spinner from "./common/Spinner";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import * as utils from "../utils/utils";
import { fetchAportes, createAporte, updateAporte, deleteAporte } from "../apis/api.aportes";
import { queryAportesKey } from "../apis/queryKeys";

const CONTRIBUTORS = [
  { value: "Carolina", label: "Carolina" },
  { value: "Jose Maria", label: "Jose Maria" },
  { value: "Walter", label: "Walter" },
];

function canAccessAportes() {
  return sessionStorage.username === "caro" || sessionStorage.type === "ADMIN";
}

function totalsByPerson(rows) {
  const totals = { Carolina: 0, "Jose Maria": 0, Walter: 0 };
  for (const row of rows) {
    const key = row.contributor;
    if (Object.prototype.hasOwnProperty.call(totals, key)) {
      totals[key] += parseFloat(row.amount) || 0;
    }
  }
  return totals;
}

export default function Aportes() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [editTarget, setEditTarget] = useState(null);

  const allowed = canAccessAportes();

  useEffect(() => {
    if (!allowed) navigate("/home", { replace: true });
  }, [allowed, navigate]);

  const createForm = useForm({
    defaultValues: {
      contributor: "Carolina",
      date: DateTime.now().toFormat("yyyy-MM-dd"),
      amount: "",
    },
  });

  const editForm = useForm({
    defaultValues: {
      contributor: "Carolina",
      date: "",
      amount: "",
    },
  });

  const {
    register: registerCreate,
    handleSubmit: handleSubmitCreate,
    reset: resetCreate,
    formState: { errors: errorsCreate },
  } = createForm;

  const {
    register: registerEdit,
    handleSubmit: handleSubmitEdit,
    reset: resetEdit,
    formState: { errors: errorsEdit },
  } = editForm;

  const { data: res, isLoading } = useQuery({
    queryKey: queryAportesKey(),
    queryFn: fetchAportes,
    enabled: allowed,
  });

  const list = res?.data || [];

  const contributorTotals = useMemo(() => totalsByPerson(list), [list]);

  const invalidate = () => queryClient.invalidateQueries({ queryKey: queryAportesKey() });

  const createMut = useMutation({
    mutationFn: createAporte,
    onSuccess: () => {
      invalidate();
      resetCreate({
        contributor: "Carolina",
        date: DateTime.now().toFormat("yyyy-MM-dd"),
        amount: "",
      });
    },
  });

  const updateMut = useMutation({
    mutationFn: updateAporte,
    onSuccess: () => {
      invalidate();
      setEditTarget(null);
      resetEdit({ contributor: "Carolina", date: "", amount: "" });
    },
  });

  const deleteMut = useMutation({
    mutationFn: deleteAporte,
    onSuccess: () => {
      invalidate();
    },
  });

  const onSubmitCreate = async (data) => {
    await createMut.mutateAsync({
      date: data.date,
      amount: parseFloat(data.amount),
      contributor: data.contributor,
    });
  };

  const onSubmitEdit = async (data) => {
    if (!editTarget) return;
    await updateMut.mutateAsync({
      id: editTarget.id,
      date: data.date,
      amount: parseFloat(data.amount),
      contributor: data.contributor,
    });
  };

  const openEditDialog = (row) => {
    setEditTarget(row);
    resetEdit({
      contributor: row.contributor,
      date: row.date ? DateTime.fromISO(row.date).toFormat("yyyy-MM-dd") : "",
      amount: String(row.amount),
    });
  };

  const onDelete = async (id) => {
    if (window.confirm("¿Eliminar este aporte?")) {
      await deleteMut.mutateAsync(id);
      if (editTarget?.id === id) {
        setEditTarget(null);
      }
    }
  };

  if (!allowed) return null;

  return (
    <div className="px-4 pb-28 max-w-3xl mx-auto">
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-4">
        <div
          className="flex gap-2 items-center cursor-pointer text-xl font-bold"
          onClick={() => navigate("/home")}
        >
          <ArrowLeftIcon className="h-5 w-5" />
          <span>Aportes</span>
        </div>
      </div>

      <form
        onSubmit={handleSubmitCreate(onSubmitCreate)}
        className="bg-white border rounded-lg p-4 shadow-sm mb-4 flex flex-col gap-3"
      >
        <p className="text-sm font-medium text-slate-700">Registrar aporte</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Input
            label="Fecha"
            type="date"
            {...registerCreate("date", { required: "Ingrese la fecha" })}
            intent={errorsCreate.date ? "danger" : "default"}
            helperText={errorsCreate.date?.message}
          />
          <Input
            label="Monto"
            type="number"
            step="0.01"
            placeholder="0.00"
            {...registerCreate("amount", {
              required: "Ingrese el monto",
              min: { value: 0.01, message: "El monto debe ser mayor a 0" },
            })}
            intent={errorsCreate.amount ? "danger" : "default"}
            helperText={errorsCreate.amount?.message}
          />
          <div>
            <label className="font-sans text-gray-900 mb-2 block">Quién realizó el aporte</label>
            <select
              className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
              {...registerCreate("contributor", { required: true })}
            >
              {CONTRIBUTORS.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="submit" variant="default" disabled={createMut.isPending}>
            {createMut.isPending ? "Guardando…" : "Guardar"}
          </Button>
        </div>
        {createMut.isError && (
          <p className="text-sm text-red-600">{createMut.error?.message}</p>
        )}
      </form>

      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 mb-4">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide mb-3">
          Total aportado por persona
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {CONTRIBUTORS.map((c) => (
            <div
              key={c.value}
              className="bg-white rounded-md border border-slate-100 px-3 py-2 flex flex-col"
            >
              <span className="text-xs text-slate-500">{c.label}</span>
              <span className="text-base font-semibold text-slate-800 tabular-nums">
                {utils.formatAmount(contributorTotals[c.value] || 0)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      )}

      {!isLoading && (
        <div className="not-prose bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
          <div className="pl-3 py-2 text-sm text-slate-600">Total: {list.length} aporte(s)</div>
          <div className="overflow-x-auto bg-white">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-100 text-left">
                  <th className="p-3 font-medium text-slate-600">Fecha</th>
                  <th className="p-3 font-medium text-slate-600">Contribuyente</th>
                  <th className="p-3 font-medium text-slate-600 text-right">Monto</th>
                  <th className="p-3 w-28 text-right font-medium text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {list.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500">
                      No hay aportes registrados
                    </td>
                  </tr>
                ) : (
                  list.map((row) => (
                    <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="p-3 text-slate-700">
                        {row.date ? utils.formatDate(row.date) : "-"}
                      </td>
                      <td className="p-3 text-slate-700">{row.contributor}</td>
                      <td className="p-3 text-right font-medium text-slate-800 tabular-nums">
                        {utils.formatAmount(row.amount)}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            className="p-2 rounded-md text-blue-600 hover:bg-blue-50 disabled:opacity-40"
                            title="Editar"
                            onClick={() => openEditDialog(row)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={2} />
                          </button>
                          <button
                            type="button"
                            className="p-2 rounded-md text-red-600 hover:bg-red-50 disabled:opacity-40"
                            title="Eliminar"
                            disabled={deleteMut.isPending}
                            onClick={() => onDelete(row.id)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={2} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="w-[95vw] max-w-md p-6 flex flex-col gap-4">
          <DialogTitle className="text-lg font-semibold text-slate-800">Editar aporte</DialogTitle>
          <form onSubmit={handleSubmitEdit(onSubmitEdit)} className="flex flex-col gap-3">
            <Input
              label="Fecha"
              type="date"
              {...registerEdit("date", { required: "Ingrese la fecha" })}
              intent={errorsEdit.date ? "danger" : "default"}
              helperText={errorsEdit.date?.message}
            />
            <Input
              label="Monto"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...registerEdit("amount", {
                required: "Ingrese el monto",
                min: { value: 0.01, message: "El monto debe ser mayor a 0" },
              })}
              intent={errorsEdit.amount ? "danger" : "default"}
              helperText={errorsEdit.amount?.message}
            />
            <div>
              <label className="text-xs font-sans text-gray-900 mb-2 block">Quién realizó el aporte</label>
              <select
                className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                {...registerEdit("contributor", { required: true })}
              >
                {CONTRIBUTORS.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
            <FormActions
              className="pt-2"
              equalWidth
              onCancel={() => setEditTarget(null)}
              isLoading={updateMut.isPending}
              submitLabel="Actualizar"
              loadingLabel="Guardando…"
            />
            {updateMut.isError && (
              <p className="text-sm text-red-600">{updateMut.error?.message}</p>
            )}
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
