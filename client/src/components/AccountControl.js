import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import * as utils from "../utils/utils";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  fetchAccountMovements,
  fetchAccountMovementsSummary,
  fetchUpcomingCheques,
  fetchFutureBalances,
  createAccountMovement,
  updateAccountMovement,
  deleteAccountMovement,
} from "../apis/api.accountmovements";
import {
  queryAccountMovementsKey,
  queryAccountMovementsSummaryKey,
  queryUpcomingChequesKey,
  queryAccountFutureBalancesKey,
  queryPaychecksKey,
  queryInvoicesKey,
  queryInvoiceByMovementKey,
  querySupplierAccountKey,
} from "../apis/queryKeys";
import InvoiceDataDialog from "./InvoiceDataDialog";
import InvoiceDataFields from "./InvoiceDataFields";
import {
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
} from "../apis/api.invoices";

const MOVEMENT_KIND_OPTIONS = [
  { value: "UNICA VEZ", label: "Única vez" },
  { value: "FIJO", label: "Fijo" },
  { value: "PENDIENTE", label: "Pendiente" },
];

function movementKindLabel(kind) {
  const k = kind || "UNICA VEZ";
  return MOVEMENT_KIND_OPTIONS.find((o) => o.value === k)?.label ?? "Única vez";
}

function effectiveMovementDate(m) {
  return m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;
}

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

export default function AccountControl() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState("LIST");
  const [page, setPage] = useState(1);
  const [allData, setAllData] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(DateTime.now().month);
  const [selectedYear, setSelectedYear] = useState(DateTime.now().year);
  const [viewAll, setViewAll] = useState(false);
  const [isCheque, setIsCheque] = useState(false);
  const [movementType, setMovementType] = useState("INGRESO");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [kindListFilter, setKindListFilter] = useState("");
  const [futureDialogOpen, setFutureDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceMovement, setInvoiceMovement] = useState(null);
  const [invoiceShowErrors, setInvoiceShowErrors] = useState(false);
  const invoiceFieldsRef = useRef(null);
  /** Orden de listado por fecha: coincide con el API; default asc (más antiguas primero). */
  const [dateOrder, setDateOrder] = useState("asc");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      movement_kind: "UNICA VEZ",
      date: DateTime.now().toFormat("yyyy-MM-dd"),
    },
  });

  const filterParams = viewAll
    ? { page, limit: 50, dateOrder }
    : { month: selectedMonth, year: selectedYear, page, limit: 50, dateOrder };

  const { data: movementsRes, isLoading } = useQuery({
    queryKey: queryAccountMovementsKey(filterParams),
    queryFn: () => fetchAccountMovements(filterParams),
  });

  useEffect(() => {
    if (!movementsRes?.data) return;
    if (page === 1) {
      setAllData(movementsRes.data);
    } else {
      setAllData((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        const newItems = movementsRes.data.filter((m) => !existingIds.has(m.id));
        return [...prev, ...newItems];
      });
    }
  }, [movementsRes, page]);

  const summaryParams = viewAll
    ? {}
    : { month: selectedMonth, year: selectedYear };

  const { data: summary } = useQuery({
    queryKey: queryAccountMovementsSummaryKey(summaryParams),
    queryFn: () => fetchAccountMovementsSummary(summaryParams),
  });

  const { data: upcomingCheques } = useQuery({
    queryKey: queryUpcomingChequesKey(),
    queryFn: fetchUpcomingCheques,
  });

  const { data: futureBalancesRes, isLoading: futureBalancesLoading } = useQuery({
    queryKey: queryAccountFutureBalancesKey(),
    queryFn: fetchFutureBalances,
    enabled: futureDialogOpen,
  });

  const movements = allData;

  // Saldo: siempre acumulado en orden cronológico; la vista puede invertirse (dateOrder === "desc")
  const movementsWithBalance = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const q = detailSearch.trim().toLowerCase();
    const filtered = movements.filter((m) => {
      if (kindListFilter && (m.movement_kind || "UNICA VEZ") !== kindListFilter) return false;
      if (q) {
        const desc = (m.description || "").toLowerCase();
        const chequeBits = [
          m.cheque_number ? String(m.cheque_number).toLowerCase() : "",
          (m.cheque_bank || "").toLowerCase(),
        ]
          .filter(Boolean)
          .join(" ");
        const haystack = `${desc} ${chequeBits}`.trim();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const chrono = [...filtered].sort((a, b) => {
      const da = String(effectiveMovementDate(a) || "");
      const db = String(effectiveMovementDate(b) || "");
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      return (a.id || 0) - (b.id || 0);
    });

    let runningBalance = 0;
    const withBal = chrono.map((m) => {
      const amount = parseFloat(m.amount);
      runningBalance += m.type === "INGRESO" ? amount : -amount;
      return { ...m, balance: runningBalance };
    });

    if (dateOrder === "desc") {
      return [...withBal].reverse();
    }
    return withBal;
  }, [allData, detailSearch, kindListFilter, dateOrder]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["account-movements"] });
    queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
    queryClient.invalidateQueries({ queryKey: ["upcoming-cheques"] });
    queryClient.invalidateQueries({ queryKey: queryAccountFutureBalancesKey() });
    queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
    queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
  };

  const openInvoiceDialog = (movement) => {
    setInvoiceMovement(movement);
    setInvoiceDialogOpen(true);
  };

  const createMutation = useMutation({
    mutationFn: createAccountMovement,
    onSuccess: invalidateAll,
  });

  const updateMutation = useMutation({
    mutationFn: updateAccountMovement,
    onSuccess: invalidateAll,
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAccountMovement,
    onSuccess: invalidateAll,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: useCreateInvoiceMutation,
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: useUpdateInvoiceMutation,
  });

  const watchedDate = watch("date");
  const watchedAmount = watch("amount");
  const watchedDescription = watch("description");

  const saveInvoiceForMovement = async (movementId) => {
    if (!invoiceFieldsRef.current?.isActive()) return;

    const validation = invoiceFieldsRef.current.validate();
    if (!validation.ok) {
      setInvoiceShowErrors(true);
      throw new Error(validation.message || "Revise los datos de la factura");
    }

    const payload = invoiceFieldsRef.current.buildPayload(movementId);
    const existingId = invoiceFieldsRef.current.getExistingInvoiceId();

    if (existingId) {
      await updateInvoiceMutation.mutateAsync({ ...payload, id: existingId });
    } else {
      await createInvoiceMutation.mutateAsync(payload);
    }

    queryClient.invalidateQueries({
      queryKey: queryInvoiceByMovementKey(movementId),
    });
    if (payload.supplier_id) {
      queryClient.invalidateQueries({
        queryKey: querySupplierAccountKey(payload.supplier_id),
      });
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);
      setInvoiceShowErrors(false);

      if (movementType === "EGRESO" && invoiceFieldsRef.current?.isActive()) {
        const validation = invoiceFieldsRef.current.validate();
        if (!validation.ok) {
          setInvoiceShowErrors(true);
          setIsLoadingSubmit(false);
          window.alert(validation.message || "Revise los datos de la factura");
          return;
        }
      }

      const body = {
        type: movementType,
        movement_kind: data.movement_kind,
        date: data.date,
        amount: parseFloat(data.amount),
        description: data.description,
        is_cheque: isCheque,
        cheque_number: isCheque ? data.cheque_number : null,
        cheque_bank: isCheque ? data.cheque_bank : null,
        cheque_due_date: isCheque ? data.cheque_due_date : null,
      };

      let movementId;
      if (selectedMovement) {
        await updateMutation.mutateAsync({ ...body, id: selectedMovement.id });
        movementId = selectedMovement.id;
      } else {
        const created = await createMutation.mutateAsync(body);
        movementId = Array.isArray(created) ? created[0]?.id : created?.id;
      }

      if (movementType === "EGRESO" && movementId) {
        await saveInvoiceForMovement(movementId);
        queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
      }

      setIsLoadingSubmit(false);
      setIsCheque(false);
      setMovementType("INGRESO");
      setSelectedMovement(null);
      setInvoiceShowErrors(false);
      invoiceFieldsRef.current?.reset();
      setPage(1);
      setAllData([]);
      reset({
        movement_kind: "UNICA VEZ",
        date: DateTime.now().toFormat("yyyy-MM-dd"),
        amount: "",
        description: "",
        cheque_number: "",
        cheque_bank: "",
        cheque_due_date: "",
      });
      setStage("LIST");
    } catch (e) {
      console.error(e);
      setIsLoadingSubmit(false);
      if (e?.message) window.alert(e.message);
    }
  };

  const onEdit = (movement) => {
    setSelectedMovement(movement);
    setMovementType(movement.type);
    setIsCheque(movement.is_cheque || false);
    reset({
      movement_kind: movement.movement_kind || "UNICA VEZ",
      date: movement.date ? DateTime.fromISO(movement.date).toFormat("yyyy-MM-dd") : "",
      amount: movement.amount,
      description: movement.description || "",
      cheque_number: movement.cheque_number || "",
      cheque_bank: movement.cheque_bank || "",
      cheque_due_date: movement.cheque_due_date
        ? DateTime.fromISO(movement.cheque_due_date).toFormat("yyyy-MM-dd")
        : "",
    });
    setStage("CREATE");
  };

  const onDelete = async (id) => {
    if (window.confirm("¿Seguro desea eliminar este movimiento?")) {
      await deleteMutation.mutateAsync(id);
      setPage(1);
      setAllData([]);
    }
  };

  const onCancel = () => {
    setIsCheque(false);
    setMovementType("INGRESO");
    setIsLoadingSubmit(false);
    setSelectedMovement(null);
    setInvoiceShowErrors(false);
    invoiceFieldsRef.current?.reset();
    reset({
      movement_kind: "UNICA VEZ",
      date: DateTime.now().toFormat("yyyy-MM-dd"),
      amount: "",
      description: "",
      cheque_number: "",
      cheque_bank: "",
      cheque_due_date: "",
    });
    setStage("LIST");
  };

  const handleFilterChange = (month, year) => {
    setSelectedMonth(month);
    setSelectedYear(year);
    setPage(1);
    setAllData([]);
    setViewAll(false);
  };

  const handleViewAll = () => {
    setViewAll(true);
    setPage(1);
    setAllData([]);
  };

  const handleViewMonth = () => {
    setViewAll(false);
    setPage(1);
    setAllData([]);
  };

  const toggleDateOrder = () => {
    setDateOrder((o) => (o === "asc" ? "desc" : "asc"));
    setPage(1);
    setAllData([]);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
  };

  const hasMore = movementsRes?.total > movements.length;
  const listFiltersActive = Boolean(detailSearch.trim() || kindListFilter);

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      onCancel();
    }
  };

  const yearOptions = [];
  const currentYear = DateTime.now().year;
  for (let y = currentYear - 3; y <= currentYear + 1; y++) {
    yearOptions.push(y);
  }

  return (
    <>
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Control</div>
          </div>
          {stage === "LIST" && (
            <Button
              variant="alternative"
              className="ml-auto"
              size="sm"
              onClick={() => {
                setSelectedMovement(null);
                setMovementType("EGRESO");
                setIsCheque(false);
                setInvoiceShowErrors(false);
                invoiceFieldsRef.current?.reset();
                reset({
                  movement_kind: "UNICA VEZ",
                  date: DateTime.now().toFormat("yyyy-MM-dd"),
                  amount: "",
                  description: "",
                  cheque_number: "",
                  cheque_bank: "",
                  cheque_due_date: "",
                });
                setStage("CREATE");
              }}
            >
              Nuevo Movimiento
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto pb-28">
        {stage === "LIST" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo actual (sin cheques)</p>
                <p className={utils.cn(
                  "text-xl font-bold mt-1",
                  (summary?.balanceWithoutCheques ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {utils.formatAmount(summary?.balanceWithoutCheques ?? 0)}
                </p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Saldo actual (con cheques)</p>
                <p className={utils.cn(
                  "text-xl font-bold mt-1",
                  (summary?.balanceWithCheques ?? 0) >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {utils.formatAmount(summary?.balanceWithCheques ?? 0)}
                </p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Ingresos del mes</p>
                <p className="text-xl font-bold mt-1 text-green-600">
                  {utils.formatAmount(summary?.monthlyIncome ?? 0)}
                </p>
              </div>
              <div className="bg-white border rounded-lg p-4 shadow-sm">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Egresos del mes</p>
                <p className="text-xl font-bold mt-1 text-red-600">
                  {utils.formatAmount(summary?.monthlyExpense ?? 0)}
                </p>
              </div>
            </div>

            {/* Upcoming cheques */}
            {upcomingCheques && (upcomingCheques.toExpire?.length > 0 || upcomingCheques.toCredit?.length > 0) && (
              <div className="flex flex-col gap-3 mb-4">
                {upcomingCheques.toExpire?.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-red-700 uppercase mb-2">Cheques a vencer (Egreso)</p>
                    {upcomingCheques.toExpire.map((c) => (
                      <div key={c.id} className="flex justify-between text-xs text-red-800 py-1 border-b border-red-100 last:border-b-0">
                        <span>#{c.cheque_number} - {c.cheque_bank}</span>
                        <span className="font-medium">
                          {utils.formatAmount(c.amount)} - {DateTime.fromISO(c.cheque_due_date).toFormat("dd/MM/yyyy")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {upcomingCheques.toCredit?.length > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-xs font-semibold text-green-700 uppercase mb-2">Cheques a acreditarse (Ingreso)</p>
                    {upcomingCheques.toCredit.map((c) => (
                      <div key={c.id} className="flex justify-between text-xs text-green-800 py-1 border-b border-green-100 last:border-b-0">
                        <span>#{c.cheque_number} - {c.cheque_bank}</span>
                        <span className="font-medium">
                          {utils.formatAmount(c.amount)} - {DateTime.fromISO(c.cheque_due_date).toFormat("dd/MM/yyyy")}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select
                className="border rounded px-2 py-1.5 text-sm bg-white"
                value={selectedMonth}
                onChange={(e) => handleFilterChange(parseInt(e.target.value), selectedYear)}
                disabled={viewAll}
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1.5 text-sm bg-white"
                value={selectedYear}
                onChange={(e) => handleFilterChange(selectedMonth, parseInt(e.target.value))}
                disabled={viewAll}
              >
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                className="border rounded px-2 py-1.5 text-sm bg-white min-w-[10rem]"
                value={kindListFilter}
                onChange={(e) => setKindListFilter(e.target.value)}
              >
                <option value="">Todas las clasificaciones</option>
                {MOVEMENT_KIND_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
              <input
                type="search"
                placeholder="Buscar en detalle…"
                value={detailSearch}
                onChange={(e) => setDetailSearch(e.target.value)}
                className="border rounded px-2 py-1.5 text-sm bg-white flex-1 min-w-[10rem] max-w-md"
              />
              <Button
                type="button"
                variant="outlined"
                size="sm"
                className="shrink-0"
                onClick={() => setFutureDialogOpen(true)}
              >
                Saldos futuros
              </Button>
              <Button
                variant={viewAll ? "alternative" : "outlined"}
                size="sm"
                onClick={viewAll ? handleViewMonth : handleViewAll}
                className="shrink-0"
              >
                {viewAll ? "Filtrar por mes" : "Ver todo"}
              </Button>
            </div>

            <Dialog open={futureDialogOpen} onOpenChange={setFutureDialogOpen}>
              <DialogContent className="w-[95vw] max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-6 gap-3">
                <div className="flex items-start justify-between gap-2">
                  <DialogTitle className="text-lg font-semibold text-slate-800 pr-6">
                    Saldos futuros
                  </DialogTitle>
                  <button
                    type="button"
                    className="text-slate-400 hover:text-slate-600 text-sm shrink-0"
                    onClick={() => setFutureDialogOpen(false)}
                  >
                    Cerrar
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Próximos 3 meses (día a día desde mañana). Saldo al cierre de cada día según fechas efectivas (incluye cheques en su fecha de vencimiento).
                </p>
                <div className="flex-1 min-h-0 overflow-y-auto border border-slate-200 rounded-lg bg-white">
                  {futureBalancesLoading && (
                    <div className="p-8 flex justify-center">
                      <Spinner />
                    </div>
                  )}
                  {!futureBalancesLoading && futureBalancesRes?.error && (
                    <p className="p-4 text-sm text-red-600">{String(futureBalancesRes.error)}</p>
                  )}
                  {!futureBalancesLoading && !futureBalancesRes?.error && (
                    <table className="w-full text-sm border-collapse">
                      <thead className="sticky top-0 bg-slate-100 z-10">
                        <tr>
                          <th className="text-left font-medium p-3 text-slate-600 border-b border-slate-200">Fecha</th>
                          <th className="text-right font-medium p-3 text-slate-600 border-b border-slate-200">Saldo</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(futureBalancesRes?.data || []).length === 0 ? (
                          <tr>
                            <td colSpan={2} className="p-4 text-center text-slate-500">
                              No hay movimientos proyectados después de hoy.
                            </td>
                          </tr>
                        ) : (
                          (futureBalancesRes.data || []).map((row) => (
                            <tr key={row.date} className="border-b border-slate-100 last:border-b-0 hover:bg-slate-50">
                              <td className="p-3 text-slate-700">
                                {utils.formatDate(row.date)}
                              </td>
                              <td
                                className={utils.cn(
                                  "p-3 text-right font-medium tabular-nums",
                                  row.balance >= 0 ? "text-green-700" : "text-red-600"
                                )}
                              >
                                {utils.formatAmount(row.balance)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </DialogContent>
            </Dialog>

            {/* Loading */}
            {isLoading && <Spinner />}

            {/* Movements table */}
            {!isLoading && (
              <div className="mb-4">
                <div className="pl-1 pb-1 text-slate-500 text-sm">
                  Total de movimientos: {movementsRes?.total ?? 0}
                  {listFiltersActive && (
                    <span className="text-slate-400">
                      {" "}
                      · Mostrando {movementsWithBalance.length} con el filtro actual
                    </span>
                  )}
                </div>
                <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
                  <div className="relative rounded-xl overflow-auto">
                    <div className="shadow-sm overflow-auto my-2">
                      <table className="border-collapse table-auto w-full text-sm">
                        <thead>
                          <tr>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">
                              <button
                                type="button"
                                onClick={toggleDateOrder}
                                className="inline-flex items-center gap-1.5 font-medium text-slate-500 hover:text-slate-800 transition-colors"
                                title={
                                  dateOrder === "asc"
                                    ? "Fechas más antiguas primero. Clic para ordenar por más recientes."
                                    : "Fechas más recientes primero. Clic para ordenar por más antiguas."
                                }
                                aria-label={`Ordenar fechas, actualmente ${dateOrder === "asc" ? "ascendente" : "descendente"}`}
                                aria-sort={dateOrder === "asc" ? "ascending" : "descending"}
                              >
                                Fecha
                                {dateOrder === "asc" ? (
                                  <ArrowUpNarrowWide className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
                                ) : (
                                  <ArrowDownWideNarrow className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
                                )}
                              </button>
                            </th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Tipo</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Clasificación</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Detalle</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-right">Monto</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-right">Saldo</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {movementsWithBalance.length > 0 ? (
                            movementsWithBalance.map((m, index) => {
                              const effectiveDate = m.is_cheque && m.cheque_due_date ? m.cheque_due_date : m.date;
                              const kind = m.movement_kind || "UNICA VEZ";
                              const rowKindBg =
                                kind === "PENDIENTE"
                                  ? "bg-yellow-100 hover:bg-yellow-200/80"
                                  : kind === "FIJO"
                                    ? "bg-sky-100 hover:bg-sky-200/80"
                                    : index % 2 === 0
                                      ? "bg-gray-50 hover:bg-gray-100"
                                      : "bg-white hover:bg-gray-100";
                              return (
                                <tr
                                  key={m.id}
                                  className={utils.cn("border-b last:border-b-0", rowKindBg)}
                                >
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-500">
                                    <div className="flex items-center gap-1">
                                      {DateTime.fromISO(effectiveDate).toFormat("dd/MM/yyyy")}
                                      {m.is_cheque && (
                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-1 rounded" title={`Cheque #${m.cheque_number} - ${m.cheque_bank}`}>
                                          CHQ
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-3">
                                    <span className={utils.cn(
                                      "px-2 py-0.5 rounded text-xs font-medium text-white",
                                      m.type === "INGRESO" ? "bg-green-500" : "bg-red-500"
                                    )}>
                                      {m.type === "INGRESO" ? "Ingreso" : "Egreso"}
                                    </span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-600">
                                    {movementKindLabel(m.movement_kind)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-500 max-w-[200px] truncate">
                                    {m.description || "-"}
                                    {m.is_cheque && m.cheque_number && (
                                      <span className="block text-[10px] text-blue-600">
                                        Cheque #{m.cheque_number} - {m.cheque_bank}
                                      </span>
                                    )}
                                  </td>
                                  <td className={utils.cn(
                                    "!text-xs text-right border-b border-slate-100 p-3 font-medium",
                                    m.type === "INGRESO" ? "text-green-600" : "text-red-600"
                                  )}>
                                    {m.type === "INGRESO" ? "+" : "-"}{utils.formatAmount(m.amount)}
                                  </td>
                                  <td className={utils.cn(
                                    "!text-xs text-right border-b border-slate-100 p-3 font-bold",
                                    m.balance >= 0 ? "text-gray-800" : "text-red-600"
                                  )}>
                                    {utils.formatAmount(m.balance)}
                                  </td>
                                  <td className="!text-xs text-center border-b border-slate-100 p-3">
                                    <div className="flex items-center justify-center gap-1 flex-wrap">
                                      {m.type === "EGRESO" && (
                                        <button
                                          type="button"
                                          className="text-amber-600 hover:text-amber-800 text-[10px] font-semibold px-1"
                                          onClick={() => openInvoiceDialog(m)}
                                          title="Ingresar datos de factura"
                                        >
                                          Factura
                                        </button>
                                      )}
                                      <button
                                        className="text-blue-400 hover:text-blue-600"
                                        onClick={() => onEdit(m)}
                                        title="Editar"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                      </button>
                                      <button
                                        className="text-red-400 hover:text-red-600"
                                        onClick={() => onDelete(m.id)}
                                        title="Eliminar"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={7} className="border-b border-slate-100 p-4 text-slate-500 text-center">
                                {movements.length > 0 && listFiltersActive
                                  ? "Ningún movimiento coincide con el filtro"
                                  : "No hay movimientos"}
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Load more */}
                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outlined" size="sm" onClick={loadMore}>
                      Cargar más
                    </Button>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* CREATE stage */}
        {stage === "CREATE" && (
          <div
            className={utils.cn(
              "mx-auto mt-4",
              movementType === "EGRESO" ? "max-w-2xl" : "max-w-lg"
            )}
          >
            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
              {/* Type toggle */}
              <div>
                <label className="text-xs font-sans text-gray-900 mb-2 block">Tipo de movimiento</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className={utils.cn(
                      "flex-1 py-2 rounded text-sm font-medium border transition-colors",
                      movementType === "INGRESO"
                        ? "bg-green-500 text-white border-green-500"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                    onClick={() => setMovementType("INGRESO")}
                  >
                    Ingreso
                  </button>
                  <button
                    type="button"
                    className={utils.cn(
                      "flex-1 py-2 rounded text-sm font-medium border transition-colors",
                      movementType === "EGRESO"
                        ? "bg-red-500 text-white border-red-500"
                        : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                    )}
                    onClick={() => setMovementType("EGRESO")}
                  >
                    Egreso
                  </button>
                </div>
                {movementType !== "EGRESO" && (
                  <p className="text-xs text-slate-500 mt-2">
                    Seleccioná <strong>Egreso</strong> para cargar proveedor, factura e impuestos.
                  </p>
                )}
              </div>

              {/* Clasificación: Fijo / Pendiente / Única vez */}
              <div>
                <label className="text-xs font-sans text-gray-900 mb-2 block">Clasificación</label>
                <select
                  className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                  {...register("movement_kind", { required: true })}
                >
                  {MOVEMENT_KIND_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <Input
                label="Fecha"
                type="date"
                {...register("date", { required: "Ingrese la fecha" })}
                intent={errors.date ? "danger" : "default"}
                helperText={errors.date?.message}
              />

              {/* Amount */}
              <Input
                label="Monto"
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register("amount", {
                  required: "Ingrese el monto",
                  min: { value: 0.01, message: "El monto debe ser mayor a 0" },
                })}
                intent={errors.amount ? "danger" : "default"}
                helperText={errors.amount?.message}
              />

              {/* Description */}
              <Input
                label="Detalle"
                type="text"
                placeholder="Descripción del movimiento"
                {...register("description")}
              />

              {/* Cheque toggle */}
              <div className="flex items-center gap-3 py-2">
                <label className="text-xs font-sans text-gray-900">¿Es cheque?</label>
                <button
                  type="button"
                  className={utils.cn(
                    "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                    isCheque ? "bg-blue-500" : "bg-gray-300"
                  )}
                  onClick={() => setIsCheque(!isCheque)}
                >
                  <span
                    className={utils.cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      isCheque ? "translate-x-6" : "translate-x-1"
                    )}
                  />
                </button>
              </div>

              {/* Cheque fields */}
              {isCheque && (
                <div className="flex flex-col gap-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <Input
                    label="Número de cheque"
                    type="text"
                    placeholder="Número"
                    {...register("cheque_number", {
                      required: isCheque ? "Ingrese el número de cheque" : false,
                    })}
                    intent={errors.cheque_number ? "danger" : "default"}
                    helperText={errors.cheque_number?.message}
                  />
                  <div>
                    <label className="text-xs font-sans text-gray-900 mb-2 block">Banco</label>
                    <select
                      className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                      {...register("cheque_bank", {
                        required: isCheque ? "Seleccione el banco" : false,
                      })}
                    >
                      <option value="">Seleccionar...</option>
                      {utils.getBanks().map((b) => (
                        <option key={b} value={b}>{b}</option>
                      ))}
                    </select>
                    {errors.cheque_bank && (
                      <p className="text-sm text-red-500 pt-1">{errors.cheque_bank.message}</p>
                    )}
                  </div>
                  <Input
                    label="Fecha de vencimiento"
                    type="date"
                    {...register("cheque_due_date", {
                      required: isCheque ? "Ingrese la fecha de vencimiento" : false,
                    })}
                    intent={errors.cheque_due_date ? "danger" : "default"}
                    helperText={errors.cheque_due_date?.message}
                  />
                </div>
              )}

              {movementType === "EGRESO" && (
                <InvoiceDataFields
                  ref={invoiceFieldsRef}
                  accountMovement={selectedMovement}
                  movementDate={watchedDate}
                  movementAmount={watchedAmount}
                  movementDescription={watchedDescription}
                  enabled={movementType === "EGRESO"}
                  showErrors={invoiceShowErrors}
                />
              )}

              {/* Actions */}
              <div className="flex gap-2 mt-2">
                <Button
                  type="submit"
                  variant="default"
                  className="flex-1"
                  disabled={isLoadingSubmit}
                >
                  {isLoadingSubmit ? "Guardando..." : selectedMovement ? "Actualizar" : "Guardar"}
                </Button>
                <Button
                  type="button"
                  variant="outlined"
                  className="flex-1"
                  onClick={onCancel}
                >
                  Cancelar
                </Button>
              </div>
            </form>
          </div>
        )}
      </div>

      <InvoiceDataDialog
        open={invoiceDialogOpen}
        onOpenChange={setInvoiceDialogOpen}
        accountMovement={invoiceMovement}
        onSaved={() => invalidateAll()}
      />
    </>
  );
}
