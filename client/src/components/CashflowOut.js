import { ExternalLinkIcon, LinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { Controller } from "react-hook-form";
import SelectComboBox from "./common/SelectComboBox";
import { sortBy } from "lodash";
import { ArrowLeft, User } from "lucide-react";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useCreateCashflowMutation } from "../apis/api.cashflow";
import { useSuppliersQuery } from "../apis/api.suppliers";
import {
  queryCashflowKey,
  queryPaychecksKey,
  querySuppliersKey,
} from "../apis/queryKeys";
import { useCreatePaycheckMutation } from "../apis/api.paychecks";

export default function CashflowOut({}) {
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [stage, setStage] = useState("LIST");
  const [provider, setProvider] = useState("LIST");
  const [taxes, setTaxes] = useState([{ type: "IVA", value: "" }]);
  const [amountWithTaxes, setAmountWithTaxes] = useState(0);
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

  const concatenateInvoiceNumber = () => {
    return `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;
  };

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
    data: providers,
    isLoading,
    error,
  } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

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

  const {
    register,
    watch,
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
  const onSubmit = (body) => {
    createMutation.mutate(body);
    navigate("/cashflow");
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
        amount: -Math.abs(Number(totalAmount)), // Negative for expenses
        net_amount: -Math.abs(Number(data.amount)), // Negative for expenses
        type: "EGRESO",
        payment_method: data.paymentMethod || utils.getPaymentMethods()[0],
        category: data.category + " - " + data.subcategory,
        provider: data.provider.id,
        taxes: taxes.filter((t) => t.value !== ""),
        date: data.date,
        reference: concatenatedNumber,
        // date: new Date().toISOString().split("T")[0],
      };

      const movement = await createMutation.mutateAsync(body);

      if (data.paymentMethod === utils.getPaycheckString()) {
        console.log(chequeData);
        // Create the paycheck using the mutation
        createPaycheckMutation.mutate({
          number: chequeData.number,
          client_id: data.provider.id,
          bank: chequeData.bank,
          due_date: chequeData.paymentDate,
          amount: Number(data.amount),
          type: "OUT",
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

  const getTotalAmount = (taxes, amount) => {
    const totalTaxes = taxes?.reduce((acc, tax) => {
      const taxValue = parseFloat(tax.value) || 0;
      return acc + taxValue;
    }, 0);

    return (parseFloat(amount) || 0) + (totalTaxes || 0);
  };

  const watchedAmount = watch("amount");

  useEffect(() => {
    setAmountWithTaxes(getTotalAmount(taxes, watchedAmount));
  }, [watchedAmount, taxes]);

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeft className="h-5 w-5 cursor-pointer" />
            <div>Egreso</div>
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
                              placeholder="Ej: Pago de servicios"
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
                              {utils.getCashflowOutCategories().map((cat) => (
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

                      {/* Categoría */}
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
                              {utils
                                .getExpensesCategories()
                                .map((subcategory) => (
                                  <option key={subcategory} value={subcategory}>
                                    {subcategory}
                                  </option>
                                ))}
                            </select>
                            {errors.subcategory && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Proveedor */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Proveedor:
                            </label>
                            <div className="flex flex-col gap-2">
                              <div className="flex flex-col sm:flex-row gap-2 w-full items-start sm:items-center justify-start ml-4 pl-1 sm:pl-0 sm:ml-0">
                                <Controller
                                  name="provider"
                                  control={control}
                                  rules={{ required: true }}
                                  defaultValue={null}
                                  render={({ field }) => (
                                    <SelectComboBox
                                      options={sortBy(providers, "name").map(
                                        (provider) => ({
                                          id: provider.id,
                                          name: provider.fantasy_name,
                                          label: provider.name,
                                        })
                                      )}
                                      value={field.value}
                                      onChange={(option) => {
                                        field.onChange(option);
                                        setValue("provider", option);
                                        setProvider(option);
                                        trigger("provider");
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
                                    navigate("/proveedores?create=true");
                                  }}
                                >
                                  Nuevo Proveedor
                                  <ExternalLinkIcon className="ml-1 h-4 w-4" />
                                </Button>
                              </div>
                              {errors.provider && (
                                <span className="text-red-500 text-sm ml-4">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>

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

                      {/* Referencia */}
                      {/* <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Referencia:
                            </label>
                            <input
                              type="text"
                              {...register("reference")}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="Ej: FAC-001, REC-002"
                            />
                          </div>
                        </td>
                      </tr> */}

                      <tr>
                        <td>
                          <div className="p-4 flex flex-col gap-2">
                            <label className="text-slate-500 font-bold">
                              Impuestos:
                            </label>
                            {taxes?.map((tax, index) => (
                              <div
                                key={index}
                                className="flex items-center gap-2 sm:ml-[110px]"
                              >
                                <select
                                  value={tax.type}
                                  onChange={(e) => {
                                    const updated = [...taxes];
                                    updated[index].type = e.target.value;
                                    setTaxes(updated);
                                  }}
                                  className="rounded border border-slate-200 p-2 text-slate-500 w-32"
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
                                  className="rounded border border-slate-200 p-2 text-slate-500 w-32"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    const updated = taxes.filter(
                                      (_, i) => i !== index
                                    );
                                    setTaxes(updated);
                                  }}
                                  className="text-red-500 font-bold text-lg"
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
                              className="text-blue-500 font-bold text-sm sm:ml-[110px] w-fit"
                            >
                              + Agregar impuesto
                            </button>
                            {amountWithTaxes > 0 && (
                              <div className="text-sm text-gray-600 sm:ml-[110px]">
                                Total con impuestos: ${amountWithTaxes.toFixed(2)}
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                      {/* ================ */}

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

                      {/* ================ */}
                      <tr>
                        <td>
                          <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                            <label className="text-slate-500 md:w-20 font-bold">
                              Total:
                            </label>
                            <label className="text-slate-500 ml-4">
                              {utils.formatAmount(amountWithTaxes)}
                            </label>
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
                                className="bg-red-500 hover:bg-red-600"
                              >
                                {isLoadingSubmit
                                  ? "Guardando..."
                                  : "Guardar Egreso"}
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
