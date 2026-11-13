import { useNavigate } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Eye, ExternalLinkIcon, Paperclip, Pencil, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "./common/Input";
import Button from "./common/Button";
import FormActions from "./common/FormActions";
import Spinner from "./common/Spinner";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import ConfirmDialog from "./common/ConfirmDialog";
import MovementDocumentUpload from "./MovementDocumentUpload";
import * as utils from "../utils/utils";
import {
  fetchCreditCardExpenses,
  createCreditCardExpense,
  updateCreditCardExpense,
  setCreditCardExpenseImage,
  deleteCreditCardExpense,
} from "../apis/api.creditcardexpenses";
import { uploadCreditCardDocument, fetchInvoiceImageUrl } from "../apis/api.uploads";
import { queryCreditCardExpensesKey, queryInvoiceImageUrlKey } from "../apis/queryKeys";

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

const ROW_ACTION_BTN =
  "inline-flex items-center justify-center min-h-10 min-w-10 p-2 rounded-md shrink-0 touch-manipulation transition-colors disabled:opacity-30 disabled:pointer-events-none";

const emptyForm = () => ({
  date: DateTime.now().toFormat("yyyy-MM-dd"),
  description: "",
  amount: "",
});

function isPdfKey(key) {
  return Boolean(key) && /\.pdf$/i.test(key);
}

function ExpenseDetailDialog({ expense, onOpenChange, onAttach }) {
  const imageKey = expense?.image_key || null;
  const {
    data: imageRes,
    isLoading: imageLoading,
    isError: imageError,
  } = useQuery({
    queryKey: queryInvoiceImageUrlKey(imageKey),
    queryFn: () => fetchInvoiceImageUrl(imageKey),
    enabled: Boolean(imageKey),
  });
  const imageUrl = imageRes?.url || null;

  return (
    <Dialog open={Boolean(expense)} onOpenChange={onOpenChange}>
      <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] overflow-y-auto p-6 flex flex-col gap-5">
        {expense && (
          <>
            <div className="flex items-start justify-between gap-2">
              <div>
                <DialogTitle className="text-lg font-semibold text-slate-800">
                  Gasto con tarjeta #{expense.id}
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">Detalle del gasto</p>
              </div>
              <button
                type="button"
                className="text-slate-400 hover:text-slate-600 text-sm shrink-0 mt-1"
                onClick={() => onOpenChange(false)}
              >
                Cerrar
              </button>
            </div>

            <section className="flex flex-col gap-2.5 bg-slate-50 rounded-lg p-4 border border-slate-100">
              <div className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-500">Fecha</span>
                <span className="text-slate-800">{utils.formatDate(expense.date)}</span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-500">Descripción</span>
                <span className="text-slate-800 break-words min-w-0">{expense.description}</span>
              </div>
              <div className="flex gap-3 text-sm">
                <span className="w-28 shrink-0 text-slate-500">Importe</span>
                <span className="text-slate-800 font-medium tabular-nums">
                  {expense.amount != null ? utils.formatAmount(expense.amount) : "-"}
                </span>
              </div>
            </section>

            <section className="flex flex-col gap-2.5 bg-slate-50 rounded-lg p-4 border border-slate-100">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Comprobante adjunto
              </h3>
              {!imageKey && (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs text-slate-500">Todavía no se adjuntó la factura.</p>
                  <Button type="button" variant="outlined" size="sm" onClick={() => onAttach(expense)}>
                    Adjuntar
                  </Button>
                </div>
              )}
              {imageKey && imageLoading && (
                <div className="py-3 flex justify-center">
                  <Spinner />
                </div>
              )}
              {imageKey && imageError && (
                <p className="text-xs text-red-500">No se pudo cargar el comprobante</p>
              )}
              {imageKey && !imageLoading && !imageError && imageUrl && (
                <div className="flex flex-col gap-2">
                  {isPdfKey(imageKey) ? (
                    <iframe
                      title="Comprobante"
                      src={imageUrl}
                      className="w-full h-[60vh] rounded-lg border border-slate-200 bg-white"
                    />
                  ) : (
                    <img
                      src={imageUrl}
                      alt="Comprobante"
                      className="max-h-[60vh] w-auto max-w-full rounded-lg border border-slate-200 bg-white object-contain"
                    />
                  )}
                  <a
                    href={imageUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline w-fit"
                  >
                    Abrir en nueva pestaña
                    <ExternalLinkIcon className="h-3.5 w-3.5" />
                  </a>
                </div>
              )}
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function CreditCardExpenses() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState(DateTime.now().month);
  const [selectedYear, setSelectedYear] = useState(DateTime.now().year);
  const [viewAll, setViewAll] = useState(false);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [attachTarget, setAttachTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [saveError, setSaveError] = useState(null);
  const [isSaving, setIsSaving] = useState(false);

  const formUploadRef = useRef(null);
  const attachUploadRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({ defaultValues: emptyForm() });

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(t);
  }, [search]);

  const filters = viewAll
    ? { search: debouncedSearch }
    : { month: selectedMonth, year: selectedYear, search: debouncedSearch };

  const { data: res, isLoading } = useQuery({
    queryKey: queryCreditCardExpensesKey(filters),
    queryFn: () => fetchCreditCardExpenses(filters),
  });

  const list = res?.data || [];
  const withoutFile = list.filter((r) => !r.image_key).length;
  const totalAmount = list.reduce((acc, r) => acc + (parseFloat(r.amount) || 0), 0);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["credit-card-expenses"] });

  const deleteMut = useMutation({
    mutationFn: deleteCreditCardExpense,
    onSuccess: () => {
      invalidate();
      setDeleteTarget(null);
    },
  });

  const yearOptions = [];
  const currentYear = DateTime.now().year;
  for (let y = currentYear - 3; y <= currentYear + 1; y++) yearOptions.push(y);

  const openCreate = () => {
    setEditTarget(null);
    setSaveError(null);
    reset(emptyForm());
    formUploadRef.current?.reset();
    setFormOpen(true);
  };

  const openEdit = (row) => {
    setEditTarget(row);
    setSaveError(null);
    reset({
      date: row.date ? DateTime.fromISO(row.date).toFormat("yyyy-MM-dd") : "",
      description: row.description || "",
      amount: row.amount != null ? String(row.amount) : "",
    });
    formUploadRef.current?.reset();
    setFormOpen(true);
  };

  const openAttach = (row) => {
    setDetailTarget(null);
    setSaveError(null);
    attachUploadRef.current?.reset();
    setAttachTarget(row);
  };

  const closeForm = () => {
    if (isSaving) return;
    setFormOpen(false);
    setEditTarget(null);
  };

  const onSubmitForm = async (data) => {
    setIsSaving(true);
    setSaveError(null);
    try {
      const file = formUploadRef.current?.getImageFile();
      let imageKey;
      if (file) {
        const uploaded = await uploadCreditCardDocument(file);
        imageKey = uploaded.key;
      }
      const body = {
        date: data.date,
        description: data.description.trim(),
        amount: parseFloat(data.amount),
        ...(imageKey ? { image_key: imageKey } : {}),
      };
      if (editTarget) {
        await updateCreditCardExpense({ id: editTarget.id, ...body });
      } else {
        await createCreditCardExpense(body);
      }
      invalidate();
      setFormOpen(false);
      setEditTarget(null);
    } catch (e) {
      setSaveError(e.message || "Error al guardar");
    } finally {
      setIsSaving(false);
    }
  };

  const onSubmitAttach = async (e) => {
    e.preventDefault();
    const file = attachUploadRef.current?.getImageFile();
    if (!file) {
      setSaveError("Seleccioná un archivo");
      return;
    }
    setIsSaving(true);
    setSaveError(null);
    try {
      const uploaded = await uploadCreditCardDocument(file);
      await setCreditCardExpenseImage({ id: attachTarget.id, image_key: uploaded.key });
      invalidate();
      setAttachTarget(null);
    } catch (err) {
      setSaveError(err.message || "Error al adjuntar");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/control")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Tarjeta de Crédito</div>
          </div>
          <Button variant="alternative" className="ml-auto" size="sm" onClick={openCreate}>
            Nuevo Gasto
          </Button>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto pb-28">
        {/* Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Total{viewAll ? "" : " del mes"}
            </p>
            <p className="text-xl font-bold mt-1 text-red-600 tabular-nums">
              {utils.formatAmount(totalAmount)}
            </p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">
              Gastos{viewAll ? "" : " del mes"}
            </p>
            <p className="text-xl font-bold mt-1 text-slate-800">{list.length}</p>
          </div>
          <div className="bg-white border rounded-lg p-4 shadow-sm">
            <p className="text-xs text-gray-500 uppercase tracking-wide">Sin factura adjunta</p>
            <p
              className={utils.cn(
                "text-xl font-bold mt-1",
                withoutFile > 0 ? "text-amber-600" : "text-green-600"
              )}
            >
              {withoutFile}
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <select
            className="border rounded px-2 py-1.5 text-sm bg-white"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
            disabled={viewAll}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            className="border rounded px-2 py-1.5 text-sm bg-white"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
            disabled={viewAll}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <input
            type="search"
            placeholder={viewAll ? "Buscar por descripción en todos los meses…" : "Buscar por descripción…"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border rounded px-2 py-1.5 text-sm bg-white flex-1 min-w-[10rem] max-w-md"
          />
          <Button
            variant={viewAll ? "alternative" : "outlined"}
            size="sm"
            onClick={() => setViewAll((v) => !v)}
            className="shrink-0"
          >
            {viewAll ? "Filtrar por mes" : "Ver todo"}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Spinner />
          </div>
        ) : (
          <div className="not-prose bg-slate-50 rounded-xl overflow-hidden border border-slate-200">
            <div className="pl-3 py-2 text-sm text-slate-600">Total: {list.length} gasto(s)</div>
            <div className="overflow-x-auto bg-white">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-slate-100 text-left">
                    <th className="p-3 font-medium text-slate-600 w-32">Fecha</th>
                    <th className="p-3 font-medium text-slate-600">Descripción</th>
                    <th className="p-3 font-medium text-slate-600 text-right w-36">Importe</th>
                    <th className="p-3 font-medium text-slate-600 w-36">Factura</th>
                    <th className="p-3 font-medium text-slate-600 text-right w-48">Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {list.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-500">
                        {debouncedSearch
                          ? "No hay gastos que coincidan con la búsqueda"
                          : "No hay gastos con tarjeta registrados"}
                      </td>
                    </tr>
                  ) : (
                    list.map((row) => (
                      <tr key={row.id} className="border-t border-slate-100 hover:bg-slate-50">
                        <td className="p-3 text-slate-700 whitespace-nowrap">
                          {row.date ? utils.formatDate(row.date) : "-"}
                        </td>
                        <td className="p-3 text-slate-800">{row.description}</td>
                        <td className="p-3 text-right font-medium text-red-600 tabular-nums whitespace-nowrap">
                          {row.amount != null ? utils.formatAmount(row.amount) : "-"}
                        </td>
                        <td className="p-3">
                          {row.image_key ? (
                            <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                              Adjunta
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Pendiente
                            </span>
                          )}
                        </td>
                        <td className="p-1">
                          <div className="flex items-center justify-end gap-0.5">
                            <button
                              type="button"
                              className={utils.cn(ROW_ACTION_BTN, "text-slate-500 hover:bg-slate-100 hover:text-slate-700")}
                              onClick={() => setDetailTarget(row)}
                              title="Ver detalle"
                              aria-label="Ver detalle"
                            >
                              <Eye className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              className={utils.cn(ROW_ACTION_BTN, "text-blue-600 hover:bg-blue-50 hover:text-blue-700")}
                              onClick={() => openEdit(row)}
                              title="Editar"
                              aria-label="Editar"
                            >
                              <Pencil className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              className={utils.cn(
                                ROW_ACTION_BTN,
                                row.image_key
                                  ? "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
                                  : "text-amber-600 hover:bg-amber-50 hover:text-amber-700"
                              )}
                              onClick={() => openAttach(row)}
                              title={row.image_key ? "Reemplazar factura" : "Adjuntar factura"}
                              aria-label={row.image_key ? "Reemplazar factura" : "Adjuntar factura"}
                            >
                              <Paperclip className="w-5 h-5" />
                            </button>
                            <button
                              type="button"
                              className={utils.cn(ROW_ACTION_BTN, "text-red-500 hover:bg-red-50 hover:text-red-700")}
                              onClick={() => setDeleteTarget(row)}
                              title="Eliminar"
                              aria-label="Eliminar"
                            >
                              <Trash2 className="w-5 h-5" />
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
      </div>

      {/* Alta / edición */}
      <Dialog open={formOpen} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="w-[95vw] max-w-md p-6 flex flex-col gap-4">
          <DialogTitle className="text-lg font-semibold text-slate-800">
            {editTarget ? "Editar gasto con tarjeta" : "Nuevo gasto con tarjeta"}
          </DialogTitle>
          <form onSubmit={handleSubmit(onSubmitForm)} className="flex flex-col gap-3">
            <Input
              label="Fecha"
              type="date"
              {...register("date", { required: "Ingrese la fecha" })}
              intent={errors.date ? "danger" : "default"}
              helperText={errors.date?.message}
            />
            <Input
              label="Descripción"
              type="text"
              placeholder="Ej: Combustible, insumos…"
              {...register("description", {
                required: "Ingrese la descripción",
                validate: (v) => v.trim().length > 0 || "Ingrese la descripción",
              })}
              intent={errors.description ? "danger" : "default"}
              helperText={errors.description?.message}
            />
            <Input
              label="Importe"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register("amount", {
                required: "Ingrese el importe",
                min: { value: 0.01, message: "El importe debe ser mayor a 0" },
              })}
              intent={errors.amount ? "danger" : "default"}
              helperText={errors.amount?.message}
            />
            <MovementDocumentUpload
              ref={formUploadRef}
              label="Factura (opcional)"
              hint="Arrastrá la factura acá o hacé click para subir"
              savedImageKey={editTarget?.image_key || null}
            />
            <FormActions
              className="pt-2"
              equalWidth
              onCancel={closeForm}
              isLoading={isSaving}
              submitLabel={editTarget ? "Actualizar" : "Guardar"}
              loadingLabel="Guardando…"
            />
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </form>
        </DialogContent>
      </Dialog>

      {/* Adjuntar factura */}
      <Dialog
        open={Boolean(attachTarget)}
        onOpenChange={(open) => !open && !isSaving && setAttachTarget(null)}
      >
        <DialogContent className="w-[95vw] max-w-md p-6 flex flex-col gap-4">
          <div>
            <DialogTitle className="text-lg font-semibold text-slate-800">
              {attachTarget?.image_key ? "Reemplazar factura" : "Adjuntar factura"}
            </DialogTitle>
            {attachTarget && (
              <p className="text-xs text-slate-400 mt-0.5">
                {utils.formatDate(attachTarget.date)} · {attachTarget.description}
              </p>
            )}
          </div>
          <form onSubmit={onSubmitAttach} className="flex flex-col gap-3">
            <MovementDocumentUpload
              ref={attachUploadRef}
              label="Factura"
              hint="Arrastrá la factura acá o hacé click para subir"
              savedImageKey={attachTarget?.image_key || null}
            />
            <FormActions
              className="pt-2"
              equalWidth
              onCancel={() => setAttachTarget(null)}
              isLoading={isSaving}
              submitLabel="Adjuntar"
              loadingLabel="Subiendo…"
            />
            {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          </form>
        </DialogContent>
      </Dialog>

      <ExpenseDetailDialog
        expense={detailTarget}
        onOpenChange={(open) => !open && setDetailTarget(null)}
        onAttach={openAttach}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open && !deleteMut.isPending) setDeleteTarget(null);
        }}
        title="¿Eliminar gasto con tarjeta?"
        description={
          deleteTarget?.image_key
            ? "También se elimina la factura adjunta. Esta acción no se puede deshacer."
            : "Esta acción no se puede deshacer."
        }
        confirmLabel="Eliminar"
        variant="destructive"
        isLoading={deleteMut.isPending}
        onConfirm={() => deleteMut.mutateAsync(deleteTarget.id)}
      >
        {deleteTarget && (
          <div className="flex flex-col gap-0.5">
            <span className="text-slate-800 font-medium">{deleteTarget.description}</span>
            <span className="text-xs text-slate-500">{utils.formatDate(deleteTarget.date)}</span>
          </div>
        )}
        {deleteMut.isError && (
          <p className="text-sm text-red-600 mt-2">{deleteMut.error?.message}</p>
        )}
      </ConfirmDialog>
    </>
  );
}
