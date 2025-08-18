import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import * as utils from "../utils/utils";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { Controller } from "react-hook-form";
import { ArrowLeft, Home } from "lucide-react";
import SelectComboBox from "./common/SelectComboBox";
import { setWith, sortBy } from "lodash";
import Button from "./common/Button";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCreateCashflowMutation } from "../apis/api.cashflow";
import { useCreatePaycheckMutation } from "../apis/api.paychecks";
import { useClientsQuery } from "../apis/api.clients";
import {
  queryCashflowKey,
  queryPaychecksKey,
  queryClientsKey,
} from "../apis/queryKeys";

export default function CashflowIn({}) {
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [stage, setStage] = useState("LIST");
  const [client, setClient] = useState();
  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [withoutInvoice, setWithoutInvoice] = useState(false);

  const [chequeData, setChequeData] = useState({
    number: "",
    bank: "",
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
  });

  const [paymentMethod, setPaymentMethod] = useState(
    utils.getPaymentMethods()[0] || ""
  );
  console.log(paymentMethod);
  const {
    data: clients,
    isLoading: isLoadingClients,
    error: errorClients,
  } = useQuery({
    queryKey: queryClientsKey(),
    queryFn: useClientsQuery,
  });

  const createMutation = useMutation({
    mutationFn: useCreateCashflowMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryCashflowKey() });
    },
    onError: (error) => {
      console.error("Error creando Cashflow:", error);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    control,
    setValue,
    formState: { errors },
  } = useForm();

  const onCancel = () => {
    navigate("/cashflow");
  };

  const createPaycheckMutation = useMutation({
    mutationFn: useCreatePaycheckMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
      console.log("Cheque creado:", data);
    },
    onError: (error) => {
      console.error("Error creando cheque:", error);
    },
  });

  const concatenateInvoiceNumber = () => {
    return `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;
  };

  const getTotalAmount = (taxes, amount) => {
    const totalTaxes = taxes?.reduce((acc, tax) => {
      const taxValue = parseFloat(tax.value) || 0;
      return acc + taxValue;
    }, 0);

    return (parseFloat(amount) || 0) + (totalTaxes || 0);
  };

  const handleFormSubmit = async (data) => {
    try {

      if (data.paymentMethod === "CHEQUE" && chequeData.number.length !== 8) {
        alert("El Nro de Cheque debe tener 8 caracteres");
        return;
      }

      setFormSubmitted(true);

      let concatenatedNumber = "";

      // Validar que todos los campos del número de factura estén completos
      if (withoutInvoice) {
        setInvoiceLetter("");
        setInvoiceFirst4("");
        setInvoiceLast8("");
      } else {
        if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
          return;
        }
        setInvoiceLetter(invoiceLetter || "A");
        setInvoiceFirst4(invoiceFirst4 || "");
        setInvoiceLast8(invoiceLast8 || "");
        concatenatedNumber = concatenateInvoiceNumber();
      }

      const totalAmount = getTotalAmount(taxes, data.amount);

      setIsLoadingSubmit(true);
      const body = {
        ...data,
        amount: Number(totalAmount),
        net_amount: Number(data.amount),
        type: "INGRESO",
        payment_method: data.paymentMethod,
        provider: data.client.id,
        reference: concatenatedNumber,
      };

      const movement = await createMutation.mutateAsync(body);

      if (data.paymentMethod === utils.getPaycheckString()) {
        // Create the paycheck using the mutation
        createPaycheckMutation.mutate({
          number: chequeData.number,
          client_id: data.client.id,
          bank: chequeData.bank,
          due_date: chequeData.paymentDate,
          amount: Number(data.amount),
          type: "IN",
          movement_id: movement[0].id,
        });
      }

      setIsLoadingSubmit(false);
      setFormSubmitted(false);
      reset();
      navigate("/cashflow");
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
      setFormSubmitted(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsLoadingSubmit(false);
    setFormSubmitted(false);
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
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeft className="h-5 w-5 cursor-pointer" />
            <div>Ingreso</div>
          </div>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        <div className="my-4">
          <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
            <div
              className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]"
              style={{ backgroundPosition: "10px 10px" }}
            ></div>
            <div className="relative rounded-xl overflow-auto">
              <div className="shadow-sm overflow-hidden my-8">
                <form
                  onSubmit={handleSubmit(handleFormSubmit)}
                  className="w-full flex flex-col"
                >
                  <table className="border-collapse table-fixed w-full text-sm bg-white">
                    <tbody>
                      {/* Descripción */}
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
                              placeholder="Ej: Venta de productos"
                            />
                            {errors.description && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Forma de pago */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Forma de pago:
                            </label>
                            <select
                              {...register("paymentMethod", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500 text-xs"
                              defaultValue={paymentMethod}
                              onChange={(e) => setPaymentMethod(e.target.value)}
                            >
                              {utils.getPaymentMethods().map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                            {errors.paymentMethod && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {paymentMethod === utils.getPaycheckString() && (
                        <>
                          {/* Número de cheque */}
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

                          {/* Banco */}
                          <tr>
                            <td>
                              <div className="p-4 gap-4 flex items-center">
                                <label className="text-slate-500 w-24 font-bold">
                                  Banco:
                                </label>
                                <select
                                  className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                                  value={chequeData.bank}
                                  onChange={(e) =>
                                    setChequeData({
                                      ...chequeData,
                                      bank: e.target.value,
                                    })
                                  }
                                >
                                  <option value="">Seleccionar banco</option>
                                  {utils.getBanks().map((bank) => (
                                    <option key={bank} value={bank}>
                                      {bank}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </td>
                          </tr>

                          {/* Fecha de pago */}
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

                      {/* Monto */}
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
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                            {errors.amount?.type === "min" && (
                              <span className="px-2 text-red-500">
                                * Debe ser mayor a 0
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Categoría */}
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
                              {utils.getCashflowInCategories().map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat.toUpperCase()}
                                </option>
                              ))}
                            </select>
                            {errors.category && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* ================ */}
                      <tr>
                        <td>
                          <div className="p-4 flex md:flex-row gap-2 md:gap-4 md:items-center">
                            <label className="text-slate-500 md:w-20 font-bold">
                              Cliente:
                            </label>
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col sm:flex-row gap-2 w-full items-start sm:items-center justify-start ml-12 pl-1 sm:pl-0 sm:ml-4">
                                <Controller
                                  name="client"
                                  control={control}
                                  rules={{ required: true }}
                                  defaultValue={null}
                                  render={({ field }) => (
                                    <SelectComboBox
                                      options={sortBy(
                                        clients,
                                        "fantasy_name"
                                      ).map((client) => ({
                                        id: client.id,
                                        name: client.fantasy_name,
                                        label: client.name,
                                      }))}
                                      value={field.value}
                                      onChange={(option) => {
                                        field.onChange(option);
                                        setValue("client", option);
                                        setClient(option);
                                        trigger("client");
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  )}
                                />

                                <Button
                                  variant="alternative"
                                  className="h-8"
                                  onClick={() => {
                                    navigate("/clientes?create=true");
                                  }}
                                >
                                  Nuevo Cliente
                                  <ExternalLinkIcon className="ml-1 h-4 w-4" />
                                </Button>
                              </div>
                              {errors.client && (
                                <span className="text-red-500 text-sm ml-4">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* ================ */}

                      {/* Referencia */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Factura:
                            </label>
                            <div className="flex flex-col gap-2">
                              <div className="flex sm:flex-row flex-col gap-2 items-start sm:items-center justify-start sm:ml-0">
                                <select
                                  disabled={withoutInvoice}
                                  value={invoiceLetter}
                                  onChange={(e) =>
                                    setInvoiceLetter(e.target.value)
                                  }
                                  className="rounded border border-slate-300 p-4 text-slate-500 w-16 text-center disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-slate-500"
                                >
                                  <option value="A">A</option>
                                  <option value="B">B</option>
                                  <option value="C">C</option>
                                </select>
                                {window.innerWidth > 600 && (
                                  <span className="text-slate-400">-</span>
                                )}
                                <input
                                  type="text"
                                  value={invoiceFirst4}
                                  disabled={withoutInvoice}
                                  onChange={(e) => {
                                    const value = e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 4);
                                    setInvoiceFirst4(value);
                                  }}
                                  placeholder="0001"
                                  maxLength={4}
                                  className="rounded border border-slate-200 p-4 text-slate-500 w-20 text-center disabled:cursor-not-allowed h-[52px]"
                                />
                                {window.innerWidth > 600 && (
                                  <span className="text-slate-400">-</span>
                                )}
                                <input
                                  disabled={withoutInvoice}
                                  type="text"
                                  value={invoiceLast8}
                                  onChange={(e) => {
                                    const value = e.target.value
                                      .replace(/\D/g, "")
                                      .slice(0, 8);
                                    setInvoiceLast8(value);
                                  }}
                                  placeholder="00000001"
                                  maxLength={8}
                                  className="rounded border border-slate-200 p-4 text-slate-500 w-28 text-center disabled:cursor-not-allowed h-[52px]"
                                />
                                <label className="flex items-center gap-2">
                                  <input
                                    type="checkbox"
                                    checked={
                                      !invoiceLetter &&
                                      !invoiceFirst4 &&
                                      !invoiceLast8
                                    }
                                    onChange={(e) => {
                                      if (e.target.checked) {
                                        setInvoiceLetter("");
                                        setInvoiceFirst4("");
                                        setInvoiceLast8("");
                                        setWithoutInvoice(true);
                                      } else {
                                        setInvoiceLetter("A");
                                        setInvoiceFirst4("");
                                        setInvoiceLast8("");
                                        setWithoutInvoice(false);
                                      }
                                    }}
                                    className="rounded border border-slate-200 p-2 text-slate-500"
                                  />
                                  Sin Factura
                                </label>
                              </div>
                              {formSubmitted &&
                                !withoutInvoice &&
                                (!invoiceLetter ||
                                  !invoiceFirst4 ||
                                  !invoiceLast8) && (
                                  <span className="text-red-500 text-sm">
                                    * Todos los campos son obligatorios
                                  </span>
                                )}
                            </div>
                          </div>
                        </td>
                      </tr>
                      {/* Fecha */}
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
                              defaultValue={
                                new Date().toISOString().split("T")[0]
                              }
                            />
                            {errors.date && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Botones */}
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
                                className="bg-green-500 hover:bg-green-600"
                              >
                                {isLoadingSubmit
                                  ? "Guardando..."
                                  : "Guardar Ingreso"}
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
            <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
          </div>
        </div>
      </div>
    </>
  );
}
