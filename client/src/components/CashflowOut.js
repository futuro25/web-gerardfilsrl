import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft } from "lucide-react";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useCreateCashflowMutation } from "../apis/api.cashflow";
import {
  queryCashflowKey,
  queryPaychecksKey,
} from "../apis/queryKeys";
import { useCreatePaycheckMutation } from "../apis/api.paychecks";

export default function CashflowOut() {
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [stage, setStage] = useState("LIST");
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [chequeData, setChequeData] = useState({
    number: "",
    bank: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
  });

  const [paymentMethod, setPaymentMethod] = useState(
    utils.getPaymentMethods()[0] || ""
  );

  const createMutation = useMutation({
    mutationFn: useCreateCashflowMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryCashflowKey() });
    },
    onError: (error) => {
      console.error("Error creando Cashflow:", error);
    },
  });

  const createPaycheckMutation = useMutation({
    mutationFn: useCreatePaycheckMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
    },
    onError: (error) => {
      console.error("Error creando cheque:", error);
    },
  });

  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const watchedAmount = watch("amount");

  const onCancel = () => {
    navigate("/cashflow");
  };

  const handleFormSubmit = async (data) => {
    try {
      if (data.paymentMethod === "CHEQUE" && chequeData.number.length !== 8) {
        alert("El Nro de Cheque debe tener 8 caracteres");
        return;
      }

      setIsLoadingSubmit(true);
      const amount = parseFloat(data.amount) || 0;

      const body = {
        ...data,
        amount: -Math.abs(amount),
        net_amount: -Math.abs(amount),
        type: "EGRESO",
        payment_method: data.paymentMethod || utils.getPaymentMethods()[0],
        category: data.category + " - " + data.subcategory,
        taxes: [],
        date: data.date,
        reference: "",
      };

      const movement = await createMutation.mutateAsync(body);

      if (data.paymentMethod === utils.getPaycheckString()) {
        createPaycheckMutation.mutate({
          number: chequeData.number,
          client_id: null,
          bank: chequeData.bank,
          due_date: chequeData.paymentDate,
          amount: Number(data.amount),
          type: "OUT",
          movement_id: movement[0].id,
        });
      }

      setIsLoadingSubmit(false);
      reset();
      navigate("/cashflow");
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsLoadingSubmit(false);
    onCancel();
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/cashflow-selector");
    } else {
      setStage("LIST");
    }
  };

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div
          className="flex gap-2 items-center cursor-pointer text-xl font-bold pl-2"
          onClick={redirectNavigation}
        >
          <ArrowLeft className="h-5 w-5 cursor-pointer" />
          <span>Egreso</span>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        <div className="my-4">
          <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
            <div
              className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]"
              style={{ backgroundPosition: "10px 10px" }}
            />
            <div className="relative rounded-xl overflow-auto">
              <div className="shadow-sm overflow-hidden my-8">
                <form
                  onSubmit={handleSubmit(handleFormSubmit)}
                  className="w-full flex flex-col"
                >
                  <table className="border-collapse table-fixed w-full text-sm bg-white">
                    <tbody>
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Descripción:
                            </label>
                            <input
                              type="text"
                              {...register("description", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="Ej: Pago de servicios"
                            />
                            {errors.description && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Forma de pago:
                            </label>
                            <select
                              {...register("paymentMethod", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500 text-xs"
                              defaultValue={utils.getPaymentMethods()[0] || ""}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                              {utils.getPaymentMethods().map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                            {errors.paymentMethod && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {paymentMethod === utils.getPaycheckString() && (
                        <>
                          <tr>
                            <td>
                              <div className="p-4 gap-4 flex items-center">
                                <label className="text-slate-500 w-24 font-bold">
                                  Nº Cheque:
                                </label>
                                <input
                                  type="text"
                                  className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                                  value={chequeData.number}
                                  onChange={(e) =>
                                    setChequeData({
                                      ...chequeData,
                                      number: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <div className="p-4 gap-4 flex items-center">
                                <label className="text-slate-500 w-24 font-bold">
                                  Banco:
                                </label>
                                <select
                                  className="flex-1 rounded border border-slate-200 p-4 text-slate-500 text-xs"
                                  value={chequeData.bank}
                                  onChange={(e) =>
                                    setChequeData({
                                      ...chequeData,
                                      bank: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">SELECCIONAR</option>
                                  {utils.getBanks().map((bank) => (
                                    <option key={bank} value={bank}>
                                      {bank}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>
                          <tr>
                            <td>
                              <div className="p-4 gap-4 flex items-center">
                                <label className="text-slate-500 w-24 font-bold">
                                  Fecha de pago:
                                </label>
                                <input
                                  type="date"
                                  className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                                  value={chequeData.paymentDate}
                                  onChange={(e) =>
                                    setChequeData({
                                      ...chequeData,
                                      paymentDate: e.target.value,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        </>
                      )}

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Monto:
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              {...register("amount", {
                                required: true,
                                min: 0.01,
                              })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="0.00"
                            />
                            {errors.amount?.type === "required" && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                            {errors.amount?.type === "min" && (
                              <span className="px-2 text-red-500">
                                * Debe ser mayor a 0
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Categoría:
                            </label>
                            <select
                              {...register("category", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500 text-xs"
                            >
                              <option value="">SELECCIONAR</option>
                              {utils.getCashflowOutCategories().map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat.toUpperCase()}
                                </option>
                              ))}
                            </select>
                            {errors.category && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Servicio:
                            </label>
                            <select
                              {...register("subcategory", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500 text-xs w-24"
                            >
                              <option value="">SELECCIONAR</option>
                              {utils.getExpensesCategories().map((subcategory) => (
                                <option key={subcategory} value={subcategory}>
                                  {subcategory}
                                </option>
                              ))}
                            </select>
                            {errors.subcategory && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                            <label className="text-slate-500 md:w-20 font-bold">
                              Total:
                            </label>
                            <label className="text-slate-500 ml-4">
                              {utils.formatAmount(parseFloat(watchedAmount) || 0)}
                            </label>
                            <p className="text-xs text-slate-400 md:ml-4">
                              Los datos de factura e impuestos se cargan desde Control.
                            </p>
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Fecha:
                            </label>
                            <input
                              type="date"
                              {...register("date", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              defaultValue={new Date().toISOString().split("T")[0]}
                            />
                            {errors.date && (
                              <span className="px-2 text-red-500">* Obligatorio</span>
                            )}
                          </div>
                        </td>
                      </tr>

                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center justify-end">
                            <div className="gap-4 flex">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="bg-red-500 text-white hover:bg-red-600"
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="submit"
                                disabled={isLoadingSubmit}
                                className="bg-red-500 hover:bg-red-600"
                              >
                                {isLoadingSubmit ? "Guardando..." : "Guardar Egreso"}
                              </Button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </form>
              </div>
            </div>
            <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl" />
          </div>
        </div>
      </div>
    </>
  );
}
