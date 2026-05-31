import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Controller, useForm } from "react-hook-form";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { sortBy } from "lodash";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ExternalLinkIcon, Eye } from "lucide-react";
import { DateTime } from "luxon";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import SelectComboBox from "./common/SelectComboBox";
import SupplierQuickCreateDialog from "./SupplierQuickCreateDialog";
import PurchaseInvoiceDetailDialog from "./PurchaseInvoiceDetailDialog";
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

function getTotalAmount(taxes, amount) {
  const totalTaxes = (taxes || []).reduce(
    (acc, t) => acc + (parseFloat(t.value) || 0),
    0
  );
  return (parseFloat(amount) || 0) + totalTaxes;
}

const today = DateTime.now().toFormat("yyyy-MM-dd");

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
  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [withoutInvoice, setWithoutInvoice] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [supplierQuickOpen, setSupplierQuickOpen] = useState(false);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [imageFile, setImageFile] = useState(null);
  const [detailInvoice, setDetailInvoice] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: { amount: "", description: "", due_date: today },
  });

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

  const { data: suppliers, isLoading: suppliersLoading } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
    enabled: stage === "CREATE" || stage === "LIST",
  });

  const createMutation = useMutation({ mutationFn: createSupplierInvoice });

  const watchedAmount = watch("amount");
  const amountWithTaxes = useMemo(
    () => getTotalAmount(taxes, watchedAmount),
    [taxes, watchedAmount]
  );

  const invoices = listRes?.data || [];
  const total = listRes?.total || 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);

  const supplierOptions = sortBy(suppliers || [], "fantasy_name").map((p) => ({
    id: p.id,
    name: p.fantasy_name,
    label: p.fantasy_name || p.name,
  }));

  const filterSupplierOptions = useMemo(
    () =>
      sortBy(suppliers || [], "fantasy_name").map((p) => ({
        id: p.id,
        label: p.fantasy_name || p.name || `#${p.id}`,
      })),
    [suppliers]
  );

  const resetForm = () => {
    reset({ amount: "", description: "", due_date: today });
    setTaxes([{ type: "IVA", value: "" }]);
    setInvoiceLetter("A");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    setWithoutInvoice(false);
    setFormSubmitted(false);
    setImageFile(null);
    setValue("supplier", null);
  };

  const openDetail = (inv) => {
    setDetailInvoice(inv);
    setDetailOpen(true);
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

  const onSubmit = async (data) => {
    setFormSubmitted(true);
    if (!data.supplier?.id) return;

    let invoiceNumber = "";
    if (!withoutInvoice) {
      if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) return;
      invoiceNumber = `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;
    }

    try {
      setIsLoadingSubmit(true);

      let imageKey = null;
      if (imageFile) {
        try {
          const uploadRes = await uploadInvoiceImage(imageFile);
          imageKey = uploadRes?.key || null;
        } catch (uploadErr) {
          console.error(uploadErr);
          setIsLoadingSubmit(false);
          window.alert(
            "No se pudo subir la imagen de la factura: " + uploadErr.message
          );
          return;
        }
      }

      const body = {
        supplier_id: data.supplier.id,
        amount: parseFloat(data.amount),
        description: data.description || null,
        invoice_number: invoiceNumber,
        due_date: data.due_date,
        total: getTotalAmount(taxes, data.amount),
        taxes: taxes.filter((t) => t.value !== ""),
        account_movement_id: null,
        image_key: imageKey,
      };

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
    } catch (e) {
      console.error(e);
      setIsLoadingSubmit(false);
      window.alert("No se pudo guardar la factura");
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
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {invoices.length === 0 ? (
                        <tr>
                          <td
                            colSpan={7}
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
            {suppliersLoading ? (
              <div className="py-8 flex justify-center">
                <Spinner />
              </div>
            ) : (
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="flex flex-col gap-4"
              >
                {/* Proveedor */}
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Proveedor
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2 items-start">
                    <Controller
                      name="supplier"
                      control={control}
                      rules={{ required: true }}
                      render={({ field }) => (
                        <SelectComboBox
                          options={supplierOptions}
                          value={field.value}
                          onChange={field.onChange}
                        />
                      )}
                    />
                    <Button
                      type="button"
                      variant="alternative"
                      size="sm"
                      className="h-[52px] shrink-0"
                      onClick={() => setSupplierQuickOpen(true)}
                    >
                      Nuevo
                      <ExternalLinkIcon className="ml-1 h-4 w-4" />
                    </Button>
                  </div>
                  {errors.supplier && (
                    <p className="text-sm text-red-500 pt-1">* Obligatorio</p>
                  )}
                </div>

                {/* Número de factura */}
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Número de factura
                  </label>
                  <div className="flex flex-wrap gap-2 items-center">
                    <select
                      disabled={withoutInvoice}
                      value={invoiceLetter}
                      onChange={(e) => setInvoiceLetter(e.target.value)}
                      className="rounded border border-slate-300 p-3 text-slate-500 w-16 text-center disabled:opacity-50"
                    >
                      <option value="A">A</option>
                      <option value="B">B</option>
                      <option value="C">C</option>
                    </select>
                    <span className="text-slate-400">-</span>
                    <input
                      type="text"
                      value={invoiceFirst4}
                      disabled={withoutInvoice}
                      onChange={(e) =>
                        setInvoiceFirst4(
                          e.target.value.replace(/\D/g, "").slice(0, 4)
                        )
                      }
                      placeholder="0001"
                      maxLength={4}
                      className="rounded border border-slate-200 p-3 text-slate-500 w-20 text-center h-[52px]"
                    />
                    <span className="text-slate-400">-</span>
                    <input
                      type="text"
                      value={invoiceLast8}
                      disabled={withoutInvoice}
                      onChange={(e) =>
                        setInvoiceLast8(
                          e.target.value.replace(/\D/g, "").slice(0, 8)
                        )
                      }
                      placeholder="00000001"
                      maxLength={8}
                      className="rounded border border-slate-200 p-3 text-slate-500 w-28 text-center h-[52px]"
                    />
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={withoutInvoice}
                        onChange={(e) => {
                          setWithoutInvoice(e.target.checked);
                          setInvoiceLetter(e.target.checked ? "" : "A");
                          setInvoiceFirst4("");
                          setInvoiceLast8("");
                        }}
                      />
                      Sin factura
                    </label>
                  </div>
                  {formSubmitted &&
                    !withoutInvoice &&
                    (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) && (
                      <p className="text-sm text-red-500 pt-1">
                        Complete el número de factura
                      </p>
                    )}
                </div>

                {/* Monto neto */}
                <Input
                  label="Monto neto"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  {...register("amount", {
                    required: "Ingrese el monto",
                    min: { value: 0.01, message: "Debe ser mayor a 0" },
                  })}
                  intent={errors.amount ? "danger" : "default"}
                  helperText={errors.amount?.message}
                />

                {/* Descripción */}
                <Input
                  label="Descripción"
                  type="text"
                  placeholder="Detalle de la factura"
                  {...register("description")}
                />

                {/* Fecha vencimiento */}
                <Input
                  label="Fecha vencimiento"
                  type="date"
                  {...register("due_date", { required: "Ingrese la fecha" })}
                  intent={errors.due_date ? "danger" : "default"}
                  helperText={errors.due_date?.message}
                />

                {/* Impuestos */}
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Impuestos
                  </label>
                  {taxes.map((tax, index) => (
                    <div key={index} className="flex items-center gap-2 mb-2">
                      <select
                        value={tax.type}
                        onChange={(e) => {
                          const updated = [...taxes];
                          updated[index].type = e.target.value;
                          setTaxes(updated);
                        }}
                        className="rounded border border-slate-200 p-2 text-slate-500 w-40 text-sm"
                      >
                        {utils.getTaxes().map((t) => (
                          <option key={t.type} value={t.type}>
                            {t.type}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        placeholder="Valor"
                        value={tax.value}
                        onChange={(e) => {
                          const updated = [...taxes];
                          updated[index].value = e.target.value;
                          setTaxes(updated);
                        }}
                        className="rounded border border-slate-200 p-2 text-slate-500 w-32 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setTaxes(taxes.filter((_, i) => i !== index))
                        }
                        className="text-red-500 font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() =>
                      setTaxes([...taxes, { type: "IVA", value: "" }])
                    }
                    className="text-blue-500 text-sm font-medium"
                  >
                    + Agregar impuesto
                  </button>
                  <div className="mt-3 p-3 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 uppercase tracking-wide">
                      Total con impuestos
                    </span>
                    <span className="text-base font-bold text-slate-800">
                      {utils.formatAmount(amountWithTaxes)}
                    </span>
                  </div>
                </div>

                {/* Imagen de la factura */}
                <div>
                  <label className="text-xs font-sans text-gray-900 mb-2 block">
                    Imagen de la factura (opcional)
                  </label>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    className="block w-full text-sm text-slate-500 file:mr-3 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
                  />
                  {imageFile && (
                    <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                      <span className="truncate">{imageFile.name}</span>
                      <button
                        type="button"
                        onClick={() => setImageFile(null)}
                        className="text-red-500 font-bold px-1"
                      >
                        ×
                      </button>
                    </div>
                  )}
                </div>

                {/* Acciones */}
                <div className="flex gap-2 mt-2">
                  <Button
                    type="submit"
                    variant="default"
                    className="flex-1"
                    disabled={isLoadingSubmit}
                  >
                    {isLoadingSubmit ? "Guardando..." : "Guardar"}
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
            )}
          </div>
        )}
      </div>

      <SupplierQuickCreateDialog
        open={supplierQuickOpen}
        onOpenChange={setSupplierQuickOpen}
        onCreated={(option) => setValue("supplier", option)}
      />

      <PurchaseInvoiceDetailDialog
        open={detailOpen}
        onOpenChange={setDetailOpen}
        invoice={detailInvoice}
      />
    </>
  );
}
