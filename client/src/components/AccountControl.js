import { useNavigate } from "react-router-dom";
import { useState, useMemo, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ArrowDownWideNarrow, ArrowUpNarrowWide, Eye, Pin, Receipt, Trash2, Undo2 } from "lucide-react";
import { Input } from "./common/Input";
import Button from "./common/Button";
import FormActions from "./common/FormActions";
import Spinner from "./common/Spinner";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "./common/Tooltip";
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
  querySupplierAccountsListKey,
  querySupplierInvoiceByMovementKey,
  querySupplierAccountKey,
} from "../apis/queryKeys";
import InvoiceDataFields from "./InvoiceDataFields";
import EgresoSupplierFields from "./EgresoSupplierFields";
import PaymentOrderFields, { PAYMENT_METHOD_LABELS } from "./PaymentOrderFields";
import PaymentOrderDialog from "./PaymentOrderDialog";
import MovementDetailDialog from "./MovementDetailDialog";
import {
  createSupplierInvoice,
  updateSupplierInvoice,
} from "../apis/api.supplierinvoices";
import { uploadInvoiceImage } from "../apis/api.uploads";
import { createPaymentOrder, cancelPaymentOrder } from "../apis/api.paymentorders";
import {
  queryPendingPaymentItemsKey,
  queryPurchaseInvoicesKey,
  queryPaymentOrdersByMovementKey,
  queryRetentionPaymentsKey,
} from "../apis/queryKeys";

function FixedMovementsTooltipList({ items }) {
  if (!items?.length) {
    return (
      <p className="text-xs text-slate-300 py-1">No hay movimientos fijos en este período.</p>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5 min-w-[14rem] max-w-[20rem]">
      {items.map((m) => (
        <li
          key={m.id}
          className="flex items-start justify-between gap-3 text-xs border-b border-white/10 last:border-b-0 pb-1.5 last:pb-0"
        >
          <div className="min-w-0 flex-1">
            <span className="text-slate-300 block tabular-nums">
              {m.date ? DateTime.fromISO(m.date).toFormat("dd/MM/yyyy") : "—"}
            </span>
            <span className="text-white block truncate">
              {m.description || "Sin detalle"}
            </span>
          </div>
          <span
            className={utils.cn(
              "font-semibold tabular-nums shrink-0",
              m.type === "INGRESO" ? "text-green-300" : "text-red-300"
            )}
          >
            {m.type === "INGRESO" ? "+" : "−"}
            {utils.formatAmount(m.amount)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function deleteMovementConfirmMessage(m) {
  const extras = [];
  if (m.has_payment_order) extras.push("orden de pago");
  if (
    m.expense_category === "FACTURA" ||
    m.supplier_invoice_id ||
    m.invoice_payment_pending
  ) {
    extras.push("factura vinculada");
  }
  if (m.is_cheque) extras.push("datos de cheque del movimiento");
  if (m.paycheck_id) extras.push("registro en Cheques");

  let msg = "¿Eliminar este movimiento?";
  if (extras.length) {
    msg += ` También se eliminarán: ${extras.join(", ")}.`;
  }
  msg += " Esta acción no se puede deshacer.";
  return msg;
}

const MOVEMENT_KIND_OPTIONS = [
  { value: "UNICA VEZ", label: "Única vez" },
  { value: "FIJO", label: "Fijo" },
];

// Concepto del egreso. "FACTURA" exige factura asociada; el resto son
// excepciones que se registran sin factura.
const EXPENSE_CATEGORY_OPTIONS = [
  { value: "FACTURA", label: "Factura de proveedor" },
  { value: "GASTOS_BANCARIOS", label: "Gastos bancarios" },
  { value: "IMPUESTOS", label: "Impuestos" },
  { value: "PAGO_HABERES", label: "Pago de Haberes" },
  { value: "SERVICIOS", label: "Servicios" },
  { value: "OTRO", label: "Otro" },
];

function movementKindLabel(kind) {
  const k = kind || "UNICA VEZ";
  return MOVEMENT_KIND_OPTIONS.find((o) => o.value === k)?.label ?? "Única vez";
}

/** Botones de acción en filas: área táctil amplia para uso en móvil. */
const ROW_ACTION_BTN =
  "inline-flex items-center justify-center min-h-10 min-w-10 p-2 rounded-md shrink-0 touch-manipulation transition-colors";

function effectiveMovementDate(m) {
  if (m?.expense_category === "FACTURA") {
    return m.invoice_document_date || m.date;
  }
  if (m?.is_cheque && m.cheque_due_date) return m.cheque_due_date;
  return m.date;
}

function inferExpenseCategory(movement) {
  if (movement?.expense_category) return movement.expense_category;
  if (movement?.supplier_invoice_id) return "FACTURA";
  if (movement?.type === "EGRESO") return "OTRO";
  return "FACTURA";
}

function paymentOrderBlockMessage(movement) {
  const orders = movement?.payment_orders || [];
  const numbers =
    movement?.payment_order_number ||
    orders.map((o) => o.order_number).filter(Boolean).join(", ");
  const op = numbers ? ` (${numbers})` : "";
  const partial =
    movement?.invoice_payment_pending &&
    movement?.invoice_remaining_amount > 0.009 &&
    orders.length > 0
      ? ` Saldo pendiente: ${utils.formatAmount(movement.invoice_remaining_amount)}.`
      : "";
  return `Este movimiento tiene ${orders.length > 1 ? "órdenes de pago activas" : "una orden de pago activa"}${op}.${partial} Anulá la(s) OP para editarlo y, si corresponde, creá nuevas OP al guardar.`;
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
  const [expenseCategory, setExpenseCategory] = useState("FACTURA");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [isCancellingOp, setIsCancellingOp] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState(null);
  const [detailSearch, setDetailSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [kindListFilter, setKindListFilter] = useState("");
  const [pendingListFilter, setPendingListFilter] = useState("");
  const [futureDialogOpen, setFutureDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [detailMovement, setDetailMovement] = useState(null);
  const [invoiceShowErrors, setInvoiceShowErrors] = useState(false);
  const [togglingFixedId, setTogglingFixedId] = useState(null);
  const [invoicePayMode, setInvoicePayMode] = useState("pending");
  const [payOrderOpen, setPayOrderOpen] = useState(false);
  const [payOrderMovement, setPayOrderMovement] = useState(null);
  const [paymentOrderShowErrors, setPaymentOrderShowErrors] = useState(false);
  const [egresoPaymentShowErrors, setEgresoPaymentShowErrors] = useState(false);
  const [egresoSupplierShowErrors, setEgresoSupplierShowErrors] = useState(false);
  const [invoiceTotalForPo, setInvoiceTotalForPo] = useState(0);
  const invoiceFieldsRef = useRef(null);
  const paymentOrderFieldsRef = useRef(null);
  const egresoPaymentFieldsRef = useRef(null);
  const egresoSupplierFieldsRef = useRef(null);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(detailSearch.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [detailSearch]);

  useEffect(() => {
    setPage(1);
    setAllData([]);
  }, [debouncedSearch]);

  const listQueryBase = {
    page,
    limit: 50,
    dateOrder,
    pending: pendingListFilter === "pending",
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
  };

  const filterParams = viewAll
    ? listQueryBase
    : {
        ...listQueryBase,
        month: selectedMonth,
        year: selectedYear,
      };

  const { data: movementsRes, isLoading } = useQuery({
    queryKey: queryAccountMovementsKey(filterParams),
    queryFn: () => fetchAccountMovements(filterParams),
  });

  useEffect(() => {
    if (movementsRes?.error) {
      if (page === 1) setAllData([]);
      return;
    }
    if (!Array.isArray(movementsRes?.data)) return;
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

  /** Al volver al listado, re-sincronizar por si la caché ya tenía datos. */
  useEffect(() => {
    if (stage !== "LIST") return;
    if (movementsRes?.error || !Array.isArray(movementsRes?.data)) return;
    if (page === 1) setAllData(movementsRes.data);
  }, [stage, movementsRes, page]);

  const summaryParams = viewAll
    ? {}
    : { month: selectedMonth, year: selectedYear };

  const { data: summary } = useQuery({
    queryKey: queryAccountMovementsSummaryKey(summaryParams),
    queryFn: () => fetchAccountMovementsSummary(summaryParams),
  });

  const { data: upcomingCheques } = useQuery({
    queryKey: queryUpcomingChequesKey(),
    queryFn: () => fetchUpcomingCheques(15),
  });

  const { data: futureBalancesRes, isLoading: futureBalancesLoading } = useQuery({
    queryKey: queryAccountFutureBalancesKey(),
    queryFn: fetchFutureBalances,
    enabled: futureDialogOpen,
  });

  const movements = allData;

  const filteredMovements = useMemo(() => {
    if (!movements || movements.length === 0) return [];

    const filtered = movements.filter((m) => {
      if (kindListFilter && (m.movement_kind || "UNICA VEZ") !== kindListFilter) return false;
      return true;
    });

    const chrono = [...filtered].sort((a, b) => {
      const da = String(effectiveMovementDate(a) || "");
      const db = String(effectiveMovementDate(b) || "");
      const c = da.localeCompare(db);
      if (c !== 0) return c;
      return (a.id || 0) - (b.id || 0);
    });

    if (dateOrder === "desc") {
      return [...chrono].reverse();
    }
    return chrono;
  }, [allData, kindListFilter, dateOrder]);

  const refreshMovementsList = async () => {
    await queryClient.refetchQueries({ queryKey: ["account-movements"] });
  };

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["account-movements"] });
    queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
    queryClient.invalidateQueries({ queryKey: ["upcoming-cheques"] });
    queryClient.invalidateQueries({ queryKey: queryAccountFutureBalancesKey() });
    queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
    queryClient.invalidateQueries({
      queryKey: querySupplierAccountsListKey(),
    });
  };

  const openPaymentOrderDialog = (movement) => {
    setPayOrderMovement(movement);
    setPayOrderOpen(true);
  };

  const handleDeleteMovement = async (movement) => {
    if (!window.confirm(deleteMovementConfirmMessage(movement))) {
      return;
    }
    try {
      const result = await deleteAccountMovement(movement.id);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      invalidateAll();
      invalidatePaymentQueries();
      queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
      setPage(1);
      await refreshMovementsList();
    } catch (e) {
      console.error(e);
      window.alert(e.message || "No se pudo eliminar el movimiento");
    }
  };

  const handleCancelPaymentOrder = async (
    movement,
    { fromEdit = false, orderId = null } = {}
  ) => {
    const opId = orderId || movement.payment_order_id;
    const opNumber =
      movement.payment_orders?.find((o) => o.id === opId)?.order_number ||
      movement.payment_order_number ||
      "";
    if (
      !window.confirm(
        `¿Anular la orden de pago ${opNumber}?${
          movement.payment_orders?.length > 1
            ? " Las demás OP seguirán activas."
            : " El movimiento volverá a pendiente."
        }`
      )
    ) {
      return false;
    }
    try {
      setIsCancellingOp(true);
      const result = await cancelPaymentOrder(opId);
      if (result?.error) {
        window.alert(result.error);
        return false;
      }
      invalidateAll();
      invalidatePaymentQueries();
      setPage(1);
      await refreshMovementsList();

      if (fromEdit && movement?.id) {
        queryClient.invalidateQueries({
          queryKey: querySupplierInvoiceByMovementKey(movement.id),
        });
        queryClient.invalidateQueries({
          queryKey: queryPaymentOrdersByMovementKey(movement.id),
        });
        setSelectedMovement((prev) => {
          if (prev?.id !== movement.id) return prev;
          const category = inferExpenseCategory(prev);
          const remainingOrders = (prev.payment_orders || []).filter(
            (o) => o.id !== opId
          );
          const paidAmount = remainingOrders.reduce(
            (acc, o) => acc + (parseFloat(o.amount) || 0),
            0
          );
          const total =
            parseFloat(prev.invoice_total_amount ?? prev.amount) || 0;
          const remainingAmount = Math.max(0, total - paidAmount);
          const fullyPaid = remainingAmount <= 0.009;
          const latest = remainingOrders[remainingOrders.length - 1] || null;
          return {
            ...prev,
            ...(result.movement || {}),
            payment_orders: remainingOrders,
            has_payment_order: remainingOrders.length > 0,
            payment_order_id: latest?.id || null,
            payment_order_number:
              remainingOrders.map((o) => o.order_number).filter(Boolean).join(", ") ||
              null,
            invoice_paid_amount: paidAmount,
            invoice_remaining_amount: remainingAmount,
            invoice_fully_paid: fullyPaid,
            invoice_payment_pending:
              category === "FACTURA" && Boolean(prev.supplier_invoice_id) && !fullyPaid,
          };
        });
        if (!result.fully_paid) {
          setInvoicePayMode("pending");
        }
      }

      return true;
    } catch (e) {
      console.error(e);
      window.alert(e.message || "No se pudo anular la orden de pago");
      return false;
    } finally {
      setIsCancellingOp(false);
    }
  };

  const invalidatePaymentQueries = () => {
    queryClient.invalidateQueries({ queryKey: queryPendingPaymentItemsKey() });
    queryClient.invalidateQueries({ queryKey: queryPurchaseInvoicesKey() });
  };

  const buildMovementUpdateBody = (movement, overrides = {}) => ({
    id: movement.id,
    type: movement.type,
    movement_kind: movement.movement_kind || "UNICA VEZ",
    date: movement.date,
    amount: movement.amount,
    description: movement.description || null,
    is_cheque: movement.is_cheque || false,
    cheque_number: movement.cheque_number || null,
    cheque_bank: movement.cheque_bank || null,
    cheque_due_date: movement.cheque_due_date || null,
    expense_category: movement.expense_category || null,
    payment_method: movement.payment_method || null,
    ...overrides,
  });

  const refetchSummary = () =>
    queryClient.refetchQueries({
      queryKey: queryAccountMovementsSummaryKey(summaryParams),
    });

  const toggleFixedKind = async (movement) => {
    const current = movement.movement_kind || "UNICA VEZ";
    const nextKind = current === "FIJO" ? "UNICA VEZ" : "FIJO";
    setTogglingFixedId(movement.id);
    try {
      const result = await updateMutation.mutateAsync(
        buildMovementUpdateBody(movement, { movement_kind: nextKind })
      );
      if (result?.error) {
        throw new Error(result.error);
      }
      setAllData((prev) =>
        prev.map((m) =>
          m.id === movement.id ? { ...m, movement_kind: nextKind } : m
        )
      );
      await refetchSummary();
    } catch (e) {
      console.error(e);
      window.alert(
        e.message || "No se pudo actualizar la clasificación del movimiento"
      );
    } finally {
      setTogglingFixedId(null);
    }
  };

  const createMutation = useMutation({
    mutationFn: createAccountMovement,
    onSuccess: invalidateAll,
  });

  const parseMovementResponse = (result) => {
    if (result?.error) {
      throw new Error(result.error);
    }
    const movement = Array.isArray(result) ? result[0] : result;
    if (!movement?.id) {
      throw new Error("No se pudo guardar el movimiento");
    }
    return movement;
  };

  const updateMutation = useMutation({
    mutationFn: updateAccountMovement,
    onSuccess: invalidateAll,
  });

  const createInvoiceMutation = useMutation({
    mutationFn: createSupplierInvoice,
  });

  const updateInvoiceMutation = useMutation({
    mutationFn: updateSupplierInvoice,
  });

  const watchedDate = watch("date");
  const watchedDescription = watch("description");

  // Solo los egresos con concepto "Factura de proveedor" exigen factura.
  const requiresInvoice =
    movementType === "EGRESO" && expenseCategory === "FACTURA";

  const requiresPaymentMethod =
    movementType === "EGRESO" && expenseCategory !== "FACTURA";

  const showsSupplierFields =
    movementType === "EGRESO" &&
    (expenseCategory === "OTRO" || expenseCategory === "SERVICIOS");

  const requiresSupplier = expenseCategory === "SERVICIOS";

  const requiresSupplierInvoiceNumber = expenseCategory === "SERVICIOS";

  const movementHasPaymentOrder = Boolean(
    selectedMovement?.has_payment_order
  );

  const saveInvoiceForMovement = async (movementId) => {
    const validation = await invoiceFieldsRef.current?.validate();
    if (!validation?.ok) {
      setInvoiceShowErrors(true);
      throw new Error(validation.message || "Revise los datos de la factura");
    }

    const payload = invoiceFieldsRef.current.buildPayload(movementId);
    const imageFile = invoiceFieldsRef.current.getImageFile?.();
    if (imageFile) {
      const uploadRes = await uploadInvoiceImage(imageFile);
      payload.image_key = uploadRes?.key || null;
    }

    const existingId = invoiceFieldsRef.current.getExistingInvoiceId();
    let invoiceId = existingId;

    if (existingId) {
      await updateInvoiceMutation.mutateAsync({ ...payload, id: existingId });
    } else {
      const created = await createInvoiceMutation.mutateAsync(payload);
      invoiceId = created?.invoice?.id ?? created?.id ?? null;
    }

    queryClient.invalidateQueries({
      queryKey: querySupplierInvoiceByMovementKey(movementId),
    });
    if (payload.supplier_id) {
      queryClient.invalidateQueries({
        queryKey: querySupplierAccountKey(payload.supplier_id),
      });
    }
    invalidatePaymentQueries();
    return { invoiceId, payload };
  };

  const createPaymentOrderForInvoice = async (
    movementId,
    invoiceId,
    supplierId
  ) => {
    const poValidation = await paymentOrderFieldsRef.current?.validate();
    if (!poValidation?.ok) {
      setPaymentOrderShowErrors(true);
      throw new Error(
        poValidation.message || "Revise los datos de la orden de pago"
      );
    }
    const poPayload = paymentOrderFieldsRef.current.getPayload();
    const result = await createPaymentOrder({
      supplier_invoice_id: invoiceId,
      supplier_id: supplierId,
      account_movement_id: movementId,
      ...poPayload,
    });
    if (result?.error) {
      throw new Error(result.error);
    }
    invalidatePaymentQueries();
    queryClient.invalidateQueries({
      queryKey: queryPaymentOrdersByMovementKey(movementId),
    });
    return result;
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);
      setInvoiceShowErrors(false);
      setPaymentOrderShowErrors(false);
      setEgresoPaymentShowErrors(false);
      setEgresoSupplierShowErrors(false);

      if (selectedMovement && movementHasPaymentOrder) {
        setIsLoadingSubmit(false);
        window.alert(paymentOrderBlockMessage(selectedMovement));
        return;
      }

      if (showsSupplierFields && requiresSupplier) {
        const supplierValidation =
          await egresoSupplierFieldsRef.current?.validate();
        if (!supplierValidation?.ok) {
          setEgresoSupplierShowErrors(true);
          setIsLoadingSubmit(false);
          window.alert(
            supplierValidation.message || "Revise los datos del proveedor"
          );
          return;
        }
      }

      if (requiresPaymentMethod) {
        const payValidation = await egresoPaymentFieldsRef.current?.validate();
        if (!payValidation?.ok) {
          setEgresoPaymentShowErrors(true);
          setIsLoadingSubmit(false);
          window.alert(
            payValidation.message || "Revise la forma de pago del egreso"
          );
          return;
        }
      }

      if (requiresInvoice) {
        const validation = await invoiceFieldsRef.current?.validate();
        if (!validation?.ok) {
          setInvoiceShowErrors(true);
          setIsLoadingSubmit(false);
          window.alert(validation.message || "Revise los datos de la factura");
          return;
        }
        if (
          invoicePayMode === "pay_now" &&
          !movementHasPaymentOrder
        ) {
          const poValidation = await paymentOrderFieldsRef.current?.validate();
          if (!poValidation?.ok) {
            setPaymentOrderShowErrors(true);
            setIsLoadingSubmit(false);
            window.alert(
              poValidation.message || "Revise los datos de la orden de pago"
            );
            return;
          }
        }
      }

      const chequeActive = isCheque && movementType !== "EGRESO";

      let movementAmount = parseFloat(data.amount);
      let movementDate = data.date;
      if (requiresInvoice && invoiceFieldsRef.current) {
        const invoicePayload = invoiceFieldsRef.current.buildPayload(
          selectedMovement?.id ?? null
        );
        movementAmount = invoiceFieldsRef.current.getTotalAmount();
        movementDate = invoicePayload.document_date;
      }

      const body = {
        type: movementType,
        movement_kind: selectedMovement?.movement_kind || "UNICA VEZ",
        date: movementDate,
        amount: movementAmount,
        description: data.description,
        is_cheque: chequeActive,
        cheque_number: chequeActive ? data.cheque_number : null,
        cheque_bank: chequeActive ? data.cheque_bank : null,
        cheque_due_date: chequeActive ? data.date : null,
        expense_category: movementType === "EGRESO" ? expenseCategory : null,
        payment_method: null,
        supplier_id: null,
        invoice_number: null,
      };

      if (showsSupplierFields && egresoSupplierFieldsRef.current) {
        const supplierPayload = egresoSupplierFieldsRef.current.getPayload();
        body.supplier_id = supplierPayload.supplier_id;
        body.invoice_number = supplierPayload.invoice_number;
      }

      if (requiresPaymentMethod) {
        const payPayload = egresoPaymentFieldsRef.current.getPayload();
        body.payment_method = payPayload.payment_method;
        body.is_cheque = payPayload.is_cheque;
        body.cheque_number = payPayload.cheque_number || null;
        body.cheque_bank = payPayload.cheque_bank || null;
        body.cheque_due_date = payPayload.cheque_due_date || null;
        if (payPayload.is_cheque && payPayload.cheque_due_date) {
          body.date = payPayload.cheque_due_date;
        }
      } else if (movementType === "EGRESO" && !requiresInvoice) {
        body.payment_method = null;
      }

      let movementId;
      if (selectedMovement) {
        const updated = await updateMutation.mutateAsync({ ...body, id: selectedMovement.id });
        parseMovementResponse(updated);
        movementId = selectedMovement.id;
      } else {
        const created = await createMutation.mutateAsync(body);
        movementId = parseMovementResponse(created).id;
      }

      if (requiresInvoice && movementId) {
        const { invoiceId, payload } = await saveInvoiceForMovement(movementId);
        if (
          invoicePayMode === "pay_now" &&
          !movementHasPaymentOrder &&
          invoiceId
        ) {
          await createPaymentOrderForInvoice(
            movementId,
            invoiceId,
            payload.supplier_id
          );
        }
        queryClient.invalidateQueries({
          queryKey: querySupplierAccountsListKey(),
        });
      }

      setIsLoadingSubmit(false);
      setIsCheque(false);
      setMovementType("INGRESO");
      setExpenseCategory("FACTURA");
      setInvoicePayMode("pending");
      setSelectedMovement(null);
      setInvoiceShowErrors(false);
      setPaymentOrderShowErrors(false);
      setEgresoPaymentShowErrors(false);
      setEgresoSupplierShowErrors(false);
      invoiceFieldsRef.current?.reset();
      paymentOrderFieldsRef.current?.reset?.();
      egresoPaymentFieldsRef.current?.reset?.();
      egresoSupplierFieldsRef.current?.reset?.();
      setPage(1);
      setStage("LIST");
      await refreshMovementsList();
      reset({
        movement_kind: "UNICA VEZ",
        date: DateTime.now().toFormat("yyyy-MM-dd"),
        amount: "",
        description: "",
        cheque_number: "",
        cheque_bank: "",
        cheque_due_date: "",
      });
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
    setExpenseCategory(inferExpenseCategory(movement));
    setInvoicePayMode(
      movement.invoice_payment_pending ? "pending" : "pay_now"
    );
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

  const onCancel = () => {
    setIsCheque(false);
    setMovementType("INGRESO");
    setExpenseCategory("FACTURA");
    setInvoicePayMode("pending");
    setIsLoadingSubmit(false);
    setIsCancellingOp(false);
    setSelectedMovement(null);
    setInvoiceShowErrors(false);
    setPaymentOrderShowErrors(false);
    setEgresoPaymentShowErrors(false);
    setEgresoSupplierShowErrors(false);
    invoiceFieldsRef.current?.reset();
    paymentOrderFieldsRef.current?.reset?.();
    egresoPaymentFieldsRef.current?.reset?.();
    egresoSupplierFieldsRef.current?.reset?.();
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

  const handlePendingFilterChange = (value) => {
    setPendingListFilter(value);
    setPage(1);
    setAllData([]);
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
  const listFiltersActive = Boolean(
    detailSearch.trim() || kindListFilter || pendingListFilter
  );

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
                setExpenseCategory("FACTURA");
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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 my-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="bg-white border rounded-lg p-4 shadow-sm cursor-help hover:border-slate-300 transition-colors text-left w-full">
                    <p className="text-xs text-gray-500 uppercase tracking-wide">
                      Movimientos fijos{viewAll ? "" : " del mes"}
                    </p>
                    <p
                      className={utils.cn(
                        "text-xl font-bold mt-1",
                        (summary?.totalFixed ?? 0) >= 0
                          ? "text-green-600"
                          : "text-red-600"
                      )}
                    >
                      {utils.formatAmount(summary?.totalFixed ?? 0)}
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1">
                      Suma neta (ingresos − egresos) · pasá el mouse para ver el detalle
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent
                  side="bottom"
                  sideOffset={8}
                  intent="dark"
                  className="!rounded-lg !p-0 text-left overflow-hidden max-w-xs"
                >
                  <div className="px-3 py-2 border-b border-white/10">
                    <p className="text-xs font-semibold text-white leading-tight m-0">
                      Movimientos fijos ({summary?.fixedMovements?.length ?? 0})
                    </p>
                  </div>
                  <div className="max-h-64 overflow-y-auto px-3 py-2">
                    <FixedMovementsTooltipList items={summary?.fixedMovements} />
                  </div>
                </TooltipContent>
              </Tooltip>
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
              <select
                className="border rounded px-2 py-1.5 text-sm bg-white min-w-[10rem]"
                value={pendingListFilter}
                onChange={(e) => handlePendingFilterChange(e.target.value)}
              >
                <option value="">Todos los estados</option>
                <option value="pending">Pendientes de pago</option>
              </select>
              <input
                type="search"
                placeholder={viewAll ? "Buscar en todos los meses…" : "Buscar en el mes…"}
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

            {/* Cheques a vencer — arriba del listado */}
            {!isLoading &&
              upcomingCheques?.toExpire?.length > 0 && (
                <div className="mb-4 bg-amber-50 border border-amber-200 rounded-lg overflow-hidden">
                  <p className="text-xs font-semibold text-amber-900 uppercase tracking-wide px-4 py-2.5 border-b border-amber-200/80">
                    Cheques a vencer (próximos 15 días)
                  </p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="text-left text-slate-500 bg-amber-50/80">
                          <th className="font-medium px-4 py-2">Fecha de pago</th>
                          <th className="font-medium px-4 py-2">Proveedor</th>
                          <th className="font-medium px-4 py-2 text-right">
                            Importe
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {upcomingCheques.toExpire.map((c) => (
                          <tr
                            key={c.id}
                            className="border-t border-amber-100/80 hover:bg-amber-100/40"
                          >
                            <td className="px-4 py-2 text-slate-700 whitespace-nowrap">
                              {c.cheque_due_date
                                ? DateTime.fromISO(c.cheque_due_date).toFormat(
                                    "dd/MM/yyyy"
                                  )
                                : "—"}
                            </td>
                            <td className="px-4 py-2 text-slate-800">
                              {c.supplier_name || "—"}
                              {c.cheque_number && (
                                <span className="block text-[10px] text-slate-500 mt-0.5">
                                  Cheque #{c.cheque_number}
                                  {c.cheque_bank ? ` · ${c.cheque_bank}` : ""}
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-2 text-right font-medium text-red-700 whitespace-nowrap tabular-nums">
                              {utils.formatAmount(c.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

            {/* Movements table */}
            {!isLoading && (
              <div className="mb-4">
                <div className="pl-1 pb-1 text-slate-500 text-sm">
                  Total de movimientos: {movementsRes?.total ?? 0}
                  {listFiltersActive && (
                    <span className="text-slate-400">
                      {" "}
                      · Mostrando {filteredMovements.length} con el filtro actual
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
                                Fecha comprobante
                                {dateOrder === "asc" ? (
                                  <ArrowUpNarrowWide className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
                                ) : (
                                  <ArrowDownWideNarrow className="h-4 w-4 text-slate-500 shrink-0" aria-hidden />
                                )}
                              </button>
                            </th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Clasificación</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Proveedor</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-left">Detalle</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-right">Monto</th>
                            <th className="border-b font-medium p-3 pt-0 pb-3 text-slate-400 text-center min-w-[11rem]"></th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {filteredMovements.length > 0 ? (
                            filteredMovements.map((m, index) => {
                              const effectiveDate = effectiveMovementDate(m);
                              const kind = m.movement_kind || "UNICA VEZ";
                              const rowKindBg =
                                m.invoice_payment_pending
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
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-600">
                                    {movementKindLabel(m.movement_kind)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-600 max-w-[140px] truncate">
                                    {m.supplier_name || ""}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-3 text-slate-500 max-w-[200px] truncate">
                                    {m.description || "-"}
                                    {m.invoice_payment_pending && (
                                      <span className="block text-[10px] text-amber-700 font-medium">
                                        {m.has_payment_order && m.invoice_remaining_amount > 0.009
                                          ? `Saldo pendiente: ${utils.formatAmount(m.invoice_remaining_amount)}`
                                          : "Factura pendiente de pago"}
                                      </span>
                                    )}
                                    {m.has_payment_order && m.payment_order_number && (
                                      <span className="block text-[10px] text-emerald-700">
                                        OP: {m.payment_order_number}
                                      </span>
                                    )}
                                    {m.invoice_number &&
                                      m.expense_category === "SERVICIOS" && (
                                        <span className="block text-[10px] text-slate-500">
                                          Factura {m.invoice_number}
                                        </span>
                                      )}
                                    {m.payment_method && m.expense_category !== "FACTURA" && (
                                      <span className="block text-[10px] text-slate-500">
                                        {PAYMENT_METHOD_LABELS[m.payment_method] ||
                                          m.payment_method}
                                      </span>
                                    )}
                                    {m.is_cheque && m.cheque_number && (
                                      <span className="block text-[10px] text-blue-600">
                                        Cheque #{m.cheque_number} - {m.cheque_bank}
                                      </span>
                                    )}
                                  </td>
                                  <td className={utils.cn(
                                    "!text-xs text-right border-b border-slate-100 p-3 font-medium",
                                    m.type === "INGRESO" ? "text-green-600" : "text-red-600",
                                    m.excludes_from_balance && "opacity-60"
                                  )}>
                                    {m.type === "INGRESO" ? "+" : "-"}
                                    {utils.formatAmount(m.amount)}
                                    {m.excludes_from_balance && (
                                      <span className="block text-[10px] font-normal text-slate-400">
                                        sin impacto en saldo
                                      </span>
                                    )}
                                  </td>
                                  <td className="!text-xs border-b border-slate-100 px-2 py-2 sm:px-3 sm:py-3">
                                    <div className="flex items-center justify-end gap-2 sm:gap-2.5 flex-nowrap">
                                      {m.type === "EGRESO" && (
                                        <button
                                          type="button"
                                          className={utils.cn(
                                            ROW_ACTION_BTN,
                                            "disabled:opacity-40",
                                            kind === "FIJO"
                                              ? "text-sky-600 hover:bg-sky-50 hover:text-sky-800"
                                              : "text-slate-400 hover:bg-slate-100 hover:text-sky-600"
                                          )}
                                          onClick={() => toggleFixedKind(m)}
                                          disabled={togglingFixedId === m.id}
                                          title={
                                            kind === "FIJO"
                                              ? "Quitar marca de gasto fijo"
                                              : "Marcar como gasto fijo"
                                          }
                                          aria-label={
                                            kind === "FIJO"
                                              ? "Quitar marca de gasto fijo"
                                              : "Marcar como gasto fijo"
                                          }
                                          aria-pressed={kind === "FIJO"}
                                        >
                                          <Pin
                                            className={utils.cn(
                                              "w-5 h-5",
                                              kind === "FIJO" && "fill-current"
                                            )}
                                          />
                                        </button>
                                      )}
                                      <button
                                        type="button"
                                        className={utils.cn(
                                          ROW_ACTION_BTN,
                                          "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        )}
                                        onClick={() => { setDetailMovement(m); setDetailDialogOpen(true); }}
                                        title="Ver detalle"
                                        aria-label="Ver detalle"
                                      >
                                        <Eye className="w-5 h-5" />
                                      </button>
                                      {m.invoice_payment_pending && (
                                        <button
                                          type="button"
                                          className={utils.cn(
                                            ROW_ACTION_BTN,
                                            "text-emerald-700 hover:bg-emerald-50 hover:text-emerald-900"
                                          )}
                                          onClick={() => openPaymentOrderDialog(m)}
                                          title="Crear orden de pago"
                                          aria-label="Crear orden de pago"
                                        >
                                          <Receipt className="w-5 h-5" />
                                        </button>
                                      )}
                                      {m.has_payment_order && m.payment_order_id && (() => {
                                        const latestOp =
                                          m.payment_orders?.[m.payment_orders.length - 1];
                                        const cancelTarget = latestOp
                                          ? {
                                              ...m,
                                              payment_order_id: latestOp.id,
                                              payment_order_number: latestOp.order_number,
                                            }
                                          : m;
                                        return (
                                          <button
                                            type="button"
                                            className={utils.cn(
                                              ROW_ACTION_BTN,
                                              "text-amber-700 hover:bg-amber-50 hover:text-amber-900"
                                            )}
                                            onClick={() =>
                                              handleCancelPaymentOrder(cancelTarget, {
                                                orderId: cancelTarget.payment_order_id,
                                              })
                                            }
                                            title={
                                              m.payment_orders?.length > 1
                                                ? `Anular última OP (${latestOp?.order_number || ""})`
                                                : "Anular orden de pago"
                                            }
                                            aria-label="Anular orden de pago"
                                          >
                                            <Undo2 className="w-5 h-5" />
                                          </button>
                                        );
                                      })()}
                                      <button
                                        type="button"
                                        className={utils.cn(
                                          ROW_ACTION_BTN,
                                          "text-red-500 hover:bg-red-50 hover:text-red-700"
                                        )}
                                        onClick={() => handleDeleteMovement(m)}
                                        title="Eliminar movimiento"
                                        aria-label="Eliminar movimiento"
                                      >
                                        <Trash2 className="w-5 h-5" />
                                      </button>
                                      <button
                                        type="button"
                                        className={utils.cn(
                                          ROW_ACTION_BTN,
                                          "text-blue-500 hover:bg-blue-50 hover:text-blue-700"
                                        )}
                                        onClick={() => onEdit(m)}
                                        title="Editar"
                                        aria-label="Editar"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5" aria-hidden>
                                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                                        </svg>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td colSpan={6} className="border-b border-slate-100 p-4 text-slate-500 text-center">
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
              {selectedMovement && movementHasPaymentOrder && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 flex flex-col gap-3">
                  <div>
                    <p className="font-semibold">Orden(es) de pago activa(s)</p>
                    <p className="mt-1">
                      {paymentOrderBlockMessage(selectedMovement)}
                    </p>
                  </div>
                  {(selectedMovement.payment_orders?.length
                    ? selectedMovement.payment_orders
                    : selectedMovement.payment_order_id
                      ? [
                          {
                            id: selectedMovement.payment_order_id,
                            order_number: selectedMovement.payment_order_number,
                          },
                        ]
                      : []
                  ).map((op) => (
                    <div
                      key={op.id}
                      className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-200/60 pt-2 first:border-t-0 first:pt-0"
                    >
                      <span className="font-medium">
                        {op.order_number || "OP"}
                        {op.amount != null && (
                          <span className="font-normal text-amber-800 ml-2">
                            {utils.formatAmount(op.amount)}
                          </span>
                        )}
                      </span>
                      <Button
                        type="button"
                        variant="outlined"
                        size="sm"
                        className="border-amber-400 text-amber-900 hover:bg-amber-100"
                        disabled={isCancellingOp}
                        onClick={() =>
                          handleCancelPaymentOrder(
                            {
                              ...selectedMovement,
                              payment_order_id: op.id,
                              payment_order_number: op.order_number,
                            },
                            { fromEdit: true, orderId: op.id }
                          )
                        }
                      >
                        Anular
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <fieldset
                disabled={Boolean(selectedMovement && movementHasPaymentOrder)}
                className="flex flex-col gap-4 min-w-0 border-0 p-0 m-0 disabled:opacity-60"
              >
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
                    onClick={() => {
                      setMovementType("EGRESO");
                      setIsCheque(false);
                    }}
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

              {/* Date — oculto para facturas: la fecha comprobante va en el formulario de factura */}
              {!requiresInvoice && (
                <Input
                  label={
                    movementType !== "EGRESO" && isCheque
                      ? "Fecha de pago"
                      : "Fecha"
                  }
                  type="date"
                  {...register("date", { required: "Ingrese la fecha" })}
                  intent={errors.date ? "danger" : "default"}
                  helperText={errors.date?.message}
                />
              )}

              {/* Amount — oculto para facturas: el monto sale del formulario de factura */}
              {!requiresInvoice && (
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
              )}

              {/* Description */}
              <Input
                label="Detalle"
                type="text"
                placeholder="Descripción del movimiento"
                {...register("description", {
                  required: "Ingrese el detalle del movimiento",
                  validate: (value) =>
                    String(value || "").trim().length > 0 ||
                    "Ingrese el detalle del movimiento",
                })}
                intent={errors.description ? "danger" : "default"}
                helperText={errors.description?.message}
              />

              {/* Cheque toggle y campos — solo para INGRESO */}
              {movementType !== "EGRESO" && (
                <>
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
                    </div>
                  )}
                </>
              )}

              {movementType === "EGRESO" && (
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Concepto del egreso
                  </label>
                  <select
                    className="w-full border border-gray-100 rounded px-2 h-12 text-sm focus:outline-none focus:border-slate-400"
                    value={expenseCategory}
                    onChange={(e) => setExpenseCategory(e.target.value)}
                  >
                    {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <p className="text-xs text-slate-500 mt-2">
                    {requiresInvoice
                      ? "Registrá la factura y dejala pendiente o pagala con una orden de pago."
                      : expenseCategory === "SERVICIOS"
                        ? "Indicá el proveedor, el número de factura y la forma de pago."
                        : expenseCategory === "OTRO"
                          ? "Podés indicar un proveedor (opcional). Indicá la forma de pago del egreso."
                          : "Indicá la forma de pago con la que se realizó el egreso."}
                  </p>
                </div>
              )}

              {showsSupplierFields && (
                <EgresoSupplierFields
                  key={`egreso-supplier-${selectedMovement?.id ?? "new"}-${expenseCategory}`}
                  ref={egresoSupplierFieldsRef}
                  accountMovement={selectedMovement}
                  requireSupplier={requiresSupplier}
                  requireInvoiceNumber={requiresSupplierInvoiceNumber}
                  showErrors={egresoSupplierShowErrors}
                />
              )}

              {requiresPaymentMethod && (
                <PaymentOrderFields
                  key={`egreso-pay-${selectedMovement?.id ?? "new"}-${expenseCategory}`}
                  ref={egresoPaymentFieldsRef}
                  variant="egreso"
                  showErrors={egresoPaymentShowErrors}
                  defaultPaymentMethod={
                    selectedMovement?.payment_method || "TRANSFERENCIA"
                  }
                  defaultChequeNumber={selectedMovement?.cheque_number || ""}
                  defaultChequeBank={selectedMovement?.cheque_bank || ""}
                  defaultPaymentDate={
                    selectedMovement?.cheque_due_date || selectedMovement?.date
                      ? DateTime.fromISO(
                          selectedMovement.cheque_due_date || selectedMovement.date
                        ).toFormat("yyyy-MM-dd")
                      : ""
                  }
                />
              )}

              {requiresInvoice && (
                <InvoiceDataFields
                  ref={invoiceFieldsRef}
                  accountMovement={selectedMovement}
                  movementDate={watchedDate}
                  movementDescription={watchedDescription}
                  enabled={requiresInvoice && !movementHasPaymentOrder}
                  showErrors={invoiceShowErrors}
                  onTotalChange={setInvoiceTotalForPo}
                />
              )}

              {requiresInvoice && !movementHasPaymentOrder && (
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Estado del pago
                  </label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      className={utils.cn(
                        "flex-1 py-2 rounded text-sm font-medium border transition-colors",
                        invoicePayMode === "pending"
                          ? "bg-amber-500 text-white border-amber-500"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                      onClick={() => setInvoicePayMode("pending")}
                    >
                      Pendiente
                    </button>
                    <button
                      type="button"
                      className={utils.cn(
                        "flex-1 py-2 rounded text-sm font-medium border transition-colors",
                        invoicePayMode === "pay_now"
                          ? "bg-emerald-600 text-white border-emerald-600"
                          : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                      )}
                      onClick={() => setInvoicePayMode("pay_now")}
                    >
                      Pagar ahora (OP)
                    </button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {invoicePayMode === "pending"
                      ? "La factura quedará pendiente. Podrás crear la orden de pago desde la fila del movimiento."
                      : "Al guardar se creará la orden de pago con la forma de pago indicada."}
                  </p>
                </div>
              )}

              {requiresInvoice &&
                invoicePayMode === "pay_now" &&
                !movementHasPaymentOrder && (
                  <PaymentOrderFields
                    ref={paymentOrderFieldsRef}
                    defaultAmount={invoiceTotalForPo || ""}
                    showErrors={paymentOrderShowErrors}
                  />
                )}

              </fieldset>

              {/* Actions */}
              <FormActions
                className="mt-2"
                equalWidth
                onCancel={onCancel}
                isLoading={isLoadingSubmit}
                submitLabel={selectedMovement ? "Actualizar" : "Guardar"}
                disabled={Boolean(selectedMovement && movementHasPaymentOrder)}
              />
            </form>
          </div>
        )}
      </div>

      <PaymentOrderDialog
        open={payOrderOpen}
        onOpenChange={setPayOrderOpen}
        movement={payOrderMovement}
        onCreated={async () => {
          invalidateAll();
          invalidatePaymentQueries();
          setPage(1);
          await refreshMovementsList();
        }}
      />

      <MovementDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        movement={detailMovement}
      />
    </>
  );
}
