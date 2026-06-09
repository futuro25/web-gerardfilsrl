import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DateTime } from "luxon";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { Eye, Receipt } from "lucide-react";
import Button from "./common/Button";
import FormActions from "./common/FormActions";
import Spinner from "./common/Spinner";
import SupplierInvoiceForm from "./SupplierInvoiceForm";
import PurchaseInvoiceDetailDialog from "./PurchaseInvoiceDetailDialog";
import PaymentOrderViewDialog from "./PaymentOrderViewDialog";
import * as utils from "../utils/utils";
import { useSuppliersQuery } from "../apis/api.suppliers";
import {
  fetchPurchaseInvoices,
  createSupplierInvoice,
} from "../apis/api.supplierinvoices";
import { uploadInvoiceImage } from "../apis/api.uploads";
import {
  querySupplierInvoicesListKey,
  queryPurchaseInvoicesKey,
  querySuppliersKey,
  querySupplierAccountsListKey,
} from "../apis/queryKeys";

const PAGE_SIZE = 25;

export default function PurchaseInvoices() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [showInvoiceErrors, setShowInvoiceErrors] = useState(false);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const invoiceFormRef = useRef(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [poViewInvoice, setPoViewInvoice] = useState(null);
  const [poViewOpen, setPoViewOpen] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const queryParams = useMemo(
    () => ({
      page,
      limit: PAGE_SIZE,
      search: debouncedSearch,
      status: statusFilter,
      supplier_id: supplierFilter,
      date_from: dateFrom,
      date_to: dateTo,
    }),
    [page, debouncedSearch, statusFilter, supplierFilter, dateFrom, dateTo]
  );

  const {
    data: listRes,
    isLoading: listLoading,
    isFetching: listFetching,
  } = useQuery({
    queryKey: queryPurchaseInvoicesKey(queryParams),
    queryFn: () => fetchPurchaseInvoices(queryParams),
    enabled: stage === "LIST",
    keepPreviousData: true,
  });

  const { data: suppliers } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled: stage === "LIST",
  });

  const createMutation = useMutation({ mutationFn: createSupplierInvoice });

  const invoices = listRes?.data || [];
  const total = listRes?.total || 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const filterSupplierOptions = useMemo(
    () =>
      sortBy(suppliers || [], "fantasy_name").map((p) => ({
        id: p.id,
        label: p.fantasy_name || p.name || `#${p.id}`,
      })),
    [suppliers]
  );

  const resetForm = () => {
    invoiceFormRef.current?.reset();
    setShowInvoiceErrors(false);
  };

  const openDetail = (inv) => {
    setDetailInvoice(inv);
    setDetailOpen(true);
  };

  const openPaymentOrderView = (inv) => {
    setPoViewInvoice(inv);
    setPoViewOpen(true);
  };

  const openCreate = () => {
    resetForm();
    setStage("CREATE");
  };

  const onCancel = () => {
    resetForm();
    setStage("LIST");
  };

  const headerBack = () => {
    if (stage === "LIST") navigate("/home");
    else onCancel();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    const validation = await invoiceFormRef.current?.validate();
    if (!validation?.ok) {
      setShowInvoiceErrors(true);
      return;
    }

    try {
      setIsLoadingSubmit(true);
      const body = invoiceFormRef.current.buildPayload(null);
      const imageFile = invoiceFormRef.current.getImageFile?.();
      if (imageFile) {
        const uploadRes = await uploadInvoiceImage(imageFile);
        body.image_key = uploadRes?.key || null;
      }

      const result = await createMutation.mutateAsync(body);
      if (result?.error) {
        window.alert(result.error);
        setIsLoadingSubmit(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: querySupplierInvoicesListKey() });
      queryClient.invalidateQueries({ queryKey: querySupplierAccountsListKey() });
      queryClient.invalidateQueries({ queryKey: ["pending-payment-items"] });

      setIsLoadingSubmit(false);
      onCancel();
    } catch (err) {
      console.error(err);
      setIsLoadingSubmit(false);
      window.alert(err.message || "No se pudo guardar la factura");
    }
  };

  return (
    <>
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={headerBack}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Facturas Compras</div>
          </div>
          {stage === "LIST" && (
            <Button
              variant="alternative"
              className="ml-auto"
              size="sm"
              onClick={openCreate}
            >
              Nueva Factura
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto pb-28">
        {stage === "LIST" && (
          <>
            <div className="my-4 flex flex-col gap-3">
              <input
                type="search"
                placeholder="Buscar por proveedor, N° factura o descripción…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="border rounded px-3 py-2 text-sm bg-white w-full max-w-md"
              />
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-500 mb-1">
                    Orden de pago
                  </label>
                  <select
                    value={statusFilter}
                    onChange={(e) => {
                      setStatusFilter(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm bg-white"
                  >
                    <option value="">Todas</option>
                    <option value="con">Con orden de pago</option>
                    <option value="sin">Sin orden de pago</option>
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-500 mb-1">
                    Proveedor
                  </label>
                  <select
                    value={supplierFilter}
                    onChange={(e) => {
                      setSupplierFilter(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm bg-white max-w-[14rem]"
                  >
                    <option value="">Todos</option>
                    {filterSupplierOptions.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-500 mb-1">
                    Vto. desde
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => {
                      setDateFrom(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm bg-white"
                  />
                </div>
                <div className="flex flex-col">
                  <label className="text-[11px] text-slate-500 mb-1">
                    Vto. hasta
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => {
                      setDateTo(e.target.value);
                      setPage(1);
                    }}
                    className="border rounded px-2 py-2 text-sm bg-white"
                  />
                </div>
                {(statusFilter || supplierFilter || dateFrom || dateTo) && (
                  <button
                    type="button"
                    onClick={() => {
                      setStatusFilter("");
                      setSupplierFilter("");
                      setDateFrom("");
                      setDateTo("");
                      setPage(1);
                    }}
                    className="text-sm text-blue-600 hover:underline pb-2"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
            </div>

            {listLoading && (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            )}

            {!listLoading && (
              <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
                <div className="shadow-sm overflow-auto my-2">
                  <table className="border-collapse table-auto w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b font-medium p-3 text-slate-400 text-left">
                          Proveedor
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-left">
                          N° Factura
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-left">
                          Vencimiento
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-left hidden sm:table-cell">
                          Descripción
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-right">
                          Neto
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-right">
                          Total
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-center">
                          Factura
                        </th>
                        <th className="border-b font-medium p-3 text-slate-400 text-center">
                          Orden de pago
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {invoices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={8}
                            className="p-6 text-center text-slate-400"
                          >
                            {listFetching
                              ? "Cargando…"
                              : "No hay facturas que coincidan con los filtros"}
                          </td>
                        </tr>
                      ) : (
                        invoices.map((inv, index) => (
                          <tr
                            key={inv.key}
                            className={utils.cn(
                              "border-b last:border-b-0",
                              !inv.has_payment_order
                                ? "bg-red-100 hover:bg-red-200/70"
                                : index % 2 === 0
                                ? "bg-gray-50 hover:bg-gray-100"
                                : "bg-white hover:bg-gray-100"
                            )}
                          >
                            <td className="p-3 text-slate-700 text-xs font-medium max-w-[160px] truncate">
                              {inv.supplier?.fantasy_name ||
                                inv.supplier_name ||
                                inv.supplier?.name ||
                                "—"}
                            </td>
                            <td className="p-3 text-slate-600 text-xs font-mono">
                              {inv.invoice_number
                                ? utils.formatInvoiceNumber(inv.invoice_number)
                                : "Sin N°"}
                            </td>
                            <td className="p-3 text-slate-600 text-xs whitespace-nowrap">
                              {inv.date
                                ? DateTime.fromISO(inv.date).toFormat(
                                    "dd/MM/yyyy"
                                  )
                                : "-"}
                            </td>
                            <td className="p-3 text-slate-500 text-xs max-w-[200px] truncate hidden sm:table-cell">
                              {inv.description || "-"}
                            </td>
                            <td className="p-3 text-right text-slate-600 text-xs tabular-nums">
                              {utils.formatAmount(inv.amount)}
                            </td>
                            <td className="p-3 text-right font-semibold text-slate-700 text-xs tabular-nums">
                              {utils.formatAmount(inv.total || inv.amount)}
                            </td>
                            <td className="p-3 text-center">
                              <button
                                type="button"
                                onClick={() => openDetail(inv)}
                                title={
                                  inv.image_key
                                    ? "Ver factura"
                                    : "Sin imagen cargada"
                                }
                                className="inline-flex items-center justify-center"
                              >
                                <Eye
                                  className={utils.cn(
                                    "h-5 w-5",
                                    inv.image_key
                                      ? "text-green-600 hover:text-green-700"
                                      : "text-red-500 hover:text-red-600"
                                  )}
                                />
                              </button>
                            </td>
                            <td className="p-3 text-center">
                              {inv.has_payment_order ? (
                                <button
                                  type="button"
                                  onClick={() => openPaymentOrderView(inv)}
                                  title={`Ver orden de pago ${
                                    inv.payment_order?.order_number || ""
                                  }`}
                                  className="inline-flex items-center justify-center"
                                >
                                  <Receipt className="h-5 w-5 text-emerald-600 hover:text-emerald-700" />
                                </button>
                              ) : (
                                <Receipt
                                  className="h-5 w-5 text-slate-300 mx-auto"
                                  aria-label="Sin orden de pago"
                                />
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {!listLoading && total > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm text-slate-600">
                <span>
                  Mostrando{" "}
                  <strong>
                    {(page - 1) * PAGE_SIZE + 1}–
                    {Math.min(page * PAGE_SIZE, total)}
                  </strong>{" "}
                  de <strong>{total}</strong> facturas
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1 || listFetching}
                    onClick={() => setPage((p) => Math.max(p - 1, 1))}
                    className="px-3 py-1.5 rounded border bg-white disabled:opacity-40 hover:bg-gray-50"
                  >
                    Anterior
                  </button>
                  <span className="text-xs text-slate-500">
                    Página {page} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages || listFetching}
                    onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                    className="px-3 py-1.5 rounded border bg-white disabled:opacity-40 hover:bg-gray-50"
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {stage === "CREATE" && (
          <div className="mx-auto mt-4 max-w-lg">
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <SupplierInvoiceForm
                ref={invoiceFormRef}
                enabled
                showErrors={showInvoiceErrors}
                showImageUpload
                embedded
              />
              <FormActions
                className="mt-2"
                equalWidth
                onCancel={onCancel}
                isLoading={isLoadingSubmit}
              />
            </form>
          </div>
        )}
      </div>

      <PurchaseInvoiceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        invoice={detailInvoice}
      />

      <PaymentOrderViewDialog
        open={poViewOpen}
        onOpenChange={setPoViewOpen}
        order={poViewInvoice?.payment_order}
        supplierName={
          poViewInvoice?.supplier?.fantasy_name ||
          poViewInvoice?.supplier_name ||
          poViewInvoice?.supplier?.name ||
          null
        }
        invoiceNumber={poViewInvoice?.invoice_number || null}
      />
    </>
  );
}
