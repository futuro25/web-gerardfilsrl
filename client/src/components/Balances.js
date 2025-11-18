import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { PlusCircle, Trash2, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import Spinner from "./common/Spinner";
import Button from "./common/Button";
import {
  useBalancesQuery,
  useCreateBalanceMutation,
  useDeleteBalanceMutation,
} from "../apis/api.balances";
import { queryBalancesKey } from "../apis/queryKeys";

const initialFormState = {
  movementDate: "",
  impactDate: "",
  movementType: "INGRESO",
  amount: "",
  detail: "",
  invoiceNumber: "",
  paymentMethod: "EFECTIVO",
  chequeNumber: "",
  chequePaymentDate: "",
  taxes: [],
  taxDraft: { name: "", amount: "" },
};

const currencyFormatter = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
});

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("es-AR");
};

export default function Balances() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [form, setForm] = React.useState(initialFormState);
  const [showFutureOnly, setShowFutureOnly] = React.useState(false);

  const { data, isLoading } = useQuery({
    queryKey: queryBalancesKey(),
    queryFn: useBalancesQuery,
  });

  const createBalanceMutation = useMutation({
    mutationFn: useCreateBalanceMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryBalancesKey() });
      setForm(initialFormState);
    },
  });

  const deleteBalanceMutation = useMutation({
    mutationFn: useDeleteBalanceMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryBalancesKey() });
    },
  });

  const movements = React.useMemo(
    () => (data?.movements ? [...data.movements] : []),
    [data?.movements]
  );

  const taxLabels = React.useMemo(() => {
    const labels = new Set();
    movements.forEach((movement) => {
      (movement.taxes || []).forEach((tax) => {
        if (tax?.name) {
          labels.add(tax.name);
        }
      });
    });
    return Array.from(labels);
  }, [movements]);

  const monthlyForecast = React.useMemo(
    () => data?.monthlyForecast || [],
    [data?.monthlyForecast]
  );

  const handleInputChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleTaxDraftChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      taxDraft: {
        ...prev.taxDraft,
        [name]: value,
      },
    }));
  };

  const handleAddTax = () => {
    const { name, amount } = form.taxDraft;
    if (!name || !amount) return;

    setForm((prev) => ({
      ...prev,
      taxes: [
        ...prev.taxes,
        {
          name: name.trim(),
          amount: Number(amount),
        },
      ],
      taxDraft: { name: "", amount: "" },
    }));
  };

  const handleRemoveTax = (index) => {
    setForm((prev) => ({
      ...prev,
      taxes: prev.taxes.filter((_, idx) => idx !== index),
    }));
  };

  const handleSubmitMovement = (event) => {
    event.preventDefault();
    if (!form.movementDate || !form.amount) {
      window.alert("Completa la fecha y el monto para registrar el movimiento.");
      return;
    }

    const parsedAmount = Number(form.amount);
    if (Number.isNaN(parsedAmount) || parsedAmount < 0) {
      window.alert("El monto debe ser un número mayor o igual a cero.");
      return;
    }

    const payload = {
      movementDate: form.movementDate,
      movementType: form.movementType,
      amount: parsedAmount,
      detail: form.detail || null,
      invoiceNumber: form.invoiceNumber || null,
      paymentMethod: form.paymentMethod,
      taxes: form.taxes,
      effectiveDate: form.impactDate || undefined,
      chequeNumber:
        form.paymentMethod === "CHEQUE" ? form.chequeNumber || null : null,
      chequePaymentDate:
        form.paymentMethod === "CHEQUE" ? form.chequePaymentDate || null : null,
    };

    createBalanceMutation.mutate(payload, {
      onError: (error) => {
        window.alert(error?.message || "Error al crear el movimiento");
      },
    });
  };

  const handleDeleteMovement = (movement) => {
    if (!movement?.id) return;
    const confirmed = window.confirm(
      "¿Deseas eliminar este movimiento de la cuenta corriente?"
    );
    if (!confirmed) return;

    deleteBalanceMutation.mutate(movement.id, {
      onError: (error) => {
        window.alert(error?.message || "Error al eliminar el movimiento");
      },
    });
  };

  const filteredMovements = React.useMemo(() => {
    if (!showFutureOnly) return movements;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return movements.filter((movement) => {
      const effective = new Date(movement.effectiveDate || movement.movementDate);
      return !Number.isNaN(effective.getTime()) && effective >= today;
    });
  }, [movements, showFutureOnly]);

  if (isLoading) {
    return <Spinner />;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-sm mb-4">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <button
            type="button"
            className="flex gap-2 items-center cursor-pointer text-gray-700 hover:text-gray-900"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5" />
            <span>Cuenta Corriente</span>
          </button>
        </div>
      </header>

      <main className="px-4 pb-12 space-y-8">
        <section className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center gap-2 mb-6">
            <PlusCircle className="h-5 w-5 text-emerald-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Nuevo Movimiento
            </h2>
          </div>
          <form onSubmit={handleSubmitMovement} className="grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="movementDate">
                Fecha del movimiento
              </label>
              <input
                id="movementDate"
                name="movementDate"
                type="date"
                value={form.movementDate}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="impactDate">
                Fecha de impacto (opcional)
              </label>
              <input
                id="impactDate"
                name="impactDate"
                type="date"
                value={form.impactDate}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="movementType">
                Tipo de movimiento
              </label>
              <select
                id="movementType"
                name="movementType"
                value={form.movementType}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="INGRESO">Ingreso</option>
                <option value="EGRESO">Egreso</option>
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="amount">
                Monto
              </label>
              <input
                id="amount"
                name="amount"
                type="number"
                min="0"
                step="0.01"
                value={form.amount}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>
            <div className="flex flex-col gap-1 md:col-span-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="detail">
                Detalle
              </label>
              <textarea
                id="detail"
                name="detail"
                value={form.detail}
                onChange={handleInputChange}
                rows={3}
                className="border border-gray-300 rounded-md px-3 py-2 resize-none"
                placeholder="Descripción del movimiento"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="invoiceNumber">
                Número de factura (opcional)
              </label>
              <input
                id="invoiceNumber"
                name="invoiceNumber"
                type="text"
                value={form.invoiceNumber}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium text-gray-700" htmlFor="paymentMethod">
                Método de pago
              </label>
              <select
                id="paymentMethod"
                name="paymentMethod"
                value={form.paymentMethod}
                onChange={handleInputChange}
                className="border border-gray-300 rounded-md px-3 py-2"
              >
                <option value="EFECTIVO">Efectivo</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CHEQUE">Cheque</option>
                <option value="OTRO">Otro</option>
              </select>
            </div>
            {form.paymentMethod === "CHEQUE" && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-sm font-medium text-gray-700" htmlFor="chequeNumber">
                    Número de cheque
                  </label>
                  <input
                    id="chequeNumber"
                    name="chequeNumber"
                    type="text"
                    value={form.chequeNumber}
                    onChange={handleInputChange}
                    className="border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    className="text-sm font-medium text-gray-700"
                    htmlFor="chequePaymentDate"
                  >
                    Fecha de cobro/pago
                  </label>
                  <input
                    id="chequePaymentDate"
                    name="chequePaymentDate"
                    type="date"
                    value={form.chequePaymentDate}
                    onChange={handleInputChange}
                    className="border border-gray-300 rounded-md px-3 py-2"
                    required
                  />
                </div>
              </>
            )}
            <div className="md:col-span-2 border border-gray-100 rounded-lg p-4 bg-gray-50">
              <div className="flex flex-col gap-3">
                <span className="text-sm font-semibold text-gray-700">
                  Impuestos (opcional)
                </span>
                <div className="flex flex-col md:flex-row gap-3">
                  <input
                    name="name"
                    type="text"
                    placeholder="Tipo de impuesto"
                    value={form.taxDraft.name}
                    onChange={handleTaxDraftChange}
                    className="flex-1 border border-gray-300 rounded-md px-3 py-2"
                  />
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="Monto"
                    value={form.taxDraft.amount}
                    onChange={handleTaxDraftChange}
                    className="w-full md:w-48 border border-gray-300 rounded-md px-3 py-2"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddTax}
                    disabled={!form.taxDraft.name || !form.taxDraft.amount}
                  >
                    Agregar impuesto
                  </Button>
                </div>
                {form.taxes.length > 0 && (
                  <ul className="space-y-2">
                    {form.taxes.map((tax, index) => (
                      <li
                        key={`${tax.name}-${index}`}
                        className="flex items-center justify-between bg-white border border-gray-200 rounded-md px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-medium text-gray-700">{tax.name}</p>
                          <p className="text-xs text-gray-500">
                            {currencyFormatter.format(tax.amount || 0)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveTax(index)}
                          className="text-sm text-red-500 hover:text-red-600"
                        >
                          Quitar
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <div className="md:col-span-2 flex items-center justify-end gap-3">
              <Button
                type="button"
                variant="outlined"
                onClick={() => setForm(initialFormState)}
              >
                Limpiar
              </Button>
              <Button
                type="submit"
                disabled={createBalanceMutation.isPending}
              >
                {createBalanceMutation.isPending ? (
                  <span className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Guardando...
                  </span>
                ) : (
                  "Registrar movimiento"
                )}
              </Button>
            </div>
          </form>
        </section>

        <section className="bg-white shadow rounded-lg p-6 space-y-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">
                Movimientos de Cuenta Corriente
              </h2>
              <p className="text-sm text-gray-500">
                Visualizá la evolución y el saldo acumulado de la cuenta corriente.
              </p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500"
                checked={showFutureOnly}
                onChange={(event) => setShowFutureOnly(event.target.checked)}
              />
              Mostrar solo movimientos futuros
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Fecha
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Impacto
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Tipo
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Método
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Detalle
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Monto
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Saldo
                  </th>
                  {taxLabels.length
                    ? taxLabels.map((label) => (
                        <th
                          key={`header-tax-${label}`}
                          className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider"
                        >
                          {label}
                        </th>
                      ))
                    : null}
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {filteredMovements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7 + taxLabels.length}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      No hay movimientos para las condiciones seleccionadas.
                    </td>
                  </tr>
                ) : (
                  filteredMovements.map((movement) => {
                    const taxesByName = new Map(
                      (movement.taxes || []).map((tax) => [
                        tax.name,
                        Number(tax.amount) || 0,
                      ])
                    );
                    const amount =
                      movement.movementType === "INGRESO"
                        ? Number(movement.amount) || 0
                        : (Number(movement.amount) || 0) * -1;
                    return (
                      <tr key={movement.id}>
                        <td className="px-4 py-2 text-gray-700">
                          {formatDate(movement.movementDate)}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {formatDate(movement.effectiveDate)}
                        </td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-flex px-2 py-1 rounded text-xs font-semibold ${
                              movement.movementType === "INGRESO"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {movement.movementType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {movement.paymentMethod || "-"}
                        </td>
                        <td className="px-4 py-2 text-gray-700 max-w-[320px]">
                          <div className="flex flex-col gap-1">
                            <span className="font-medium">
                              {movement.detail || "-"}
                            </span>
                            {movement.invoiceNumber ? (
                              <span className="text-xs text-gray-500">
                                Factura: {movement.invoiceNumber}
                              </span>
                            ) : null}
                            {movement.chequeNumber ? (
                              <span className="text-xs text-gray-500">
                                Cheque: {movement.chequeNumber}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            movement.movementType === "INGRESO"
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {currencyFormatter.format(amount)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {currencyFormatter.format(movement.runningBalance || 0)}
                        </td>
                        {taxLabels.length
                          ? taxLabels.map((label) => (
                              <td
                                key={`${movement.id}-tax-${label}`}
                                className="px-4 py-2 text-right text-gray-700"
                              >
                                {taxesByName.has(label)
                                  ? currencyFormatter.format(
                                      taxesByName.get(label) || 0
                                    )
                                  : "-"}
                              </td>
                            ))
                          : null}
                        <td className="px-4 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteMovement(movement)}
                            className="inline-flex items-center gap-1 text-sm text-rose-500 hover:text-rose-600"
                            disabled={deleteBalanceMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="bg-white shadow rounded-lg p-6 space-y-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">
              Proyección Mensual
            </h2>
            <p className="text-sm text-gray-500">
              Visualiza el saldo proyectado mes a mes (incluye hasta 6 meses a futuro).
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Mes
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Ingresos
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Egresos
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Variación
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                    Saldo proyectado
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {monthlyForecast.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-6 text-center text-gray-500"
                    >
                      Aún no hay datos suficientes para calcular la proyección.
                    </td>
                  </tr>
                ) : (
                  monthlyForecast.map((entry) => {
                    const isFuture =
                      new Date(entry.month + "-01") >
                      new Date(new Date().getFullYear(), new Date().getMonth(), 1);

                    return (
                      <tr
                        key={entry.month}
                        className={isFuture ? "bg-emerald-50/40" : undefined}
                      >
                        <td className="px-4 py-2 text-gray-700 font-medium">
                          {entry.label}
                        </td>
                        <td className="px-4 py-2 text-right text-emerald-600 font-medium">
                          {currencyFormatter.format(entry.incomes || 0)}
                        </td>
                        <td className="px-4 py-2 text-right text-rose-600 font-medium">
                          {currencyFormatter.format(entry.expenses || 0)}
                        </td>
                        <td
                          className={`px-4 py-2 text-right font-medium ${
                            entry.netChange >= 0
                              ? "text-emerald-600"
                              : "text-rose-600"
                          }`}
                        >
                          {currencyFormatter.format(entry.netChange || 0)}
                        </td>
                        <td className="px-4 py-2 text-right font-semibold text-gray-800">
                          {currencyFormatter.format(entry.closingBalance || 0)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}


