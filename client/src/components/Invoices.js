import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import SelectComboBox from "./common/SelectComboBox";
import { sortBy } from "lodash";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useInvoicesQuery,
  useCreateInvoiceMutation,
  useUpdateInvoiceMutation,
  useDeleteInvoiceMutation,
} from "../apis/api.invoices";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { queryInvoicesKey, querySuppliersKey } from "../apis/queryKeys";

var moment = require("moment");

export default function Invoices() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [supplier, setSupplier] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [invoiceLetter, setInvoiceLetter] = useState("");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    setValue,
    control,
    formState: { errors },
  } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: queryInvoicesKey(),
    queryFn: useInvoicesQuery,
  });

  const {
    data: suppliers,
    isLoading: isLoadingSuppliers,
    error: errorSuppliers,
  } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search
        ? d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.last_name.toLowerCase().includes(search.toLowerCase()) ||
          d.username.toLowerCase().includes(search.toLowerCase())
        : d
    );
  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreateInvoiceMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
      console.log("Factura creada:", data);
    },
    onError: (error) => {
      console.error("Error creando factura:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateInvoiceMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
      console.log("Factura creada:", data);
    },
    onError: (error) => {
      console.error("Error creando factura:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteInvoiceMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryInvoicesKey() });
      console.log("Factura eliminada:", data);
    },
    onError: (error) => {
      console.error("Error eliminando factura:", error);
    },
  });

  const removeInvoice = async (invoiceId) => {
    if (window.confirm("Seguro desea eliminar esta factura?")) {
      try {
        await deleteMutation.mutate(invoiceId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const invoiceValidation = (value) => {
    const concatenatedNumber = concatenateInvoiceNumber();
    if (!concatenatedNumber) return true;

    const existingInvoice = data.find(
      (invoice) =>
        invoice.invoice_number === concatenatedNumber &&
        (!selectedInvoice || invoice.id !== selectedInvoice.id)
    );
    return !existingInvoice || "Factura ya existe";
  };

  const onSubmit = async (data) => {
    try {
      setFormSubmitted(true);

      // Validar que todos los campos del número de factura estén completos
      if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
        return;
      }

      // Validar que hay un proveedor seleccionado
      if (!data.supplier || !data.supplier.id) {
        return;
      }

      setIsLoadingSubmit(true);

      const concatenatedInvoiceNumber = concatenateInvoiceNumber();

      const body = {
        supplier_id: data.supplier.id,
        amount: data.amount,
        description: data.description,
        invoice_number: concatenatedInvoiceNumber,
      };

      if (selectedInvoice) {
        updateMutation.mutate({ ...body, id: selectedInvoice.id });
      } else {
        createMutation.mutate(body);
      }
      setIsLoadingSubmit(false);
      setStage("LIST");
    } catch (e) {
      console.log(e);
    }
  };
  const getSupplierFantasyName = (id) =>
    suppliers?.find((s) => s.id === id).fantasy_name;

  const concatenateInvoiceNumber = () => {
    return `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;
  };

  const splitInvoiceNumber = (invoiceNumber) => {
    if (!invoiceNumber) return { letter: "", first4: "", last8: "" };
    const letter = invoiceNumber.charAt(0);
    const numbers = invoiceNumber.slice(1);
    const first4 = numbers.slice(0, 4);
    const last8 = numbers.slice(4);
    return { letter, first4, last8 };
  };

  const onEdit = (invoiceId) => {
    reset();
    const invoice = data.find((invoice) => invoice.id === invoiceId) || null;
    setSelectedInvoice(invoice);
    setFormSubmitted(false);

    if (invoice?.invoice_number) {
      const { letter, first4, last8 } = splitInvoiceNumber(
        invoice.invoice_number
      );
      setInvoiceLetter(letter);
      setInvoiceFirst4(first4);
      setInvoiceLast8(last8);
    } else {
      setInvoiceLetter("");
      setInvoiceFirst4("");
      setInvoiceLast8("");
    }

    // Establecer el proveedor seleccionado para edición
    if (invoice?.supplier_id && suppliers) {
      const selectedSupplier = suppliers.find(
        (s) => s.id === invoice.supplier_id
      );
      if (selectedSupplier) {
        const supplierOption = {
          id: selectedSupplier.id,
          name: selectedSupplier.name,
          label: selectedSupplier.name,
        };
        setValue("supplier", supplierOption);
        setSupplier(supplierOption);
      }
    }

    setStage("CREATE");
  };

  const onView = (invoiceId) => {
    const invoice = data.find((invoice) => invoice.id === invoiceId) || null;
    setSelectedInvoice(invoice);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedInvoice(null);
    setInvoiceLetter("");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    setFormSubmitted(false);
    setSupplier(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedInvoice(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    setInvoiceLetter("");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    setFormSubmitted(false);
    setSupplier(null);
    reset();
    setStage("LIST");
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
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
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Facturas</div>
          </div>
          {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size={"sm"}
              onClick={() => onCreate()}
            >
              Crear
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        {stage === "LIST" && (
          <div className="w-full flex shadow rounded mb-4">
            <Input
              rightElement={
                <div className="cursor-pointer" onClick={() => setSearch("")}>
                  {search && <CloseIcon />}
                </div>
              }
              type="text"
              value={search}
              name="search"
              id="search"
              placeholder="Buscador..."
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        )}
        {isLoading && (
          <div>
            <Spinner />
          </div>
        )}
        {error && <div className="text-red-500">{/* ERROR... */}</div>}
        {stage === "LIST" && data && (
          <div className="my-4 mb-28">
            <p className="pl-1 pb-1 text-slate-500">
              Total de facturas {data.length}
            </p>
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden ">
              <div
                className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] "
                style={{ backgroundPosition: "10px 10px" }}
              ></div>
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-auto my-8">
                  <table className="border-collapse table-auto w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left w-4">
                          #
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Proveedor
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fc nro
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Importe
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((invoice, index) => (
                          <tr
                            key={invoice.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {invoice.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {getSupplierFantasyName(invoice.supplier_id)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {invoice.invoice_number}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {invoice.amount}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(invoice.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(invoice.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removeInvoice(invoice.id)}
                                >
                                  <TrashIcon />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={4}
                            className="border-b border-slate-100  p-4  text-slate-500 "
                          >
                            No data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl "></div>
            </div>
          </div>
        )}

        {stage === "CREATE" && (
          <div className="my-4">
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden ">
              <div
                className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] "
                style={{ backgroundPosition: "10px 10px" }}
              ></div>
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-hidden my-8">
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full flex flex-col"
                  >
                    <table className="border-collapse table-fixed w-full text-sm bg-white">
                      <tbody>
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Proveedor:
                              </label>
                              <div className="flex flex-col gap-2">
                                <Controller
                                  name="supplier"
                                  control={control}
                                  rules={{ required: true }}
                                  defaultValue={null}
                                  render={({ field }) => (
                                    <SelectComboBox
                                      options={sortBy(
                                        suppliers,
                                        "fantasy_name"
                                      ).map((supplier) => ({
                                        id: supplier.id,
                                        name: supplier.name,
                                        label: supplier.name,
                                      }))}
                                      value={field.value}
                                      onChange={(option) => {
                                        field.onChange(option);
                                        setValue("supplier", option);
                                        setSupplier(option);
                                        trigger("supplier");
                                      }}
                                      onKeyDown={(e) => {
                                        if (e.key === "Enter") {
                                          e.preventDefault();
                                        }
                                      }}
                                    />
                                  )}
                                />
                                {errors.supplier && (
                                  <span className="text-red-500 text-sm">
                                    * Obligatorio
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Factura Nro:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedInvoice?.invoice_number}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2 items-center">
                                    <select
                                      value={invoiceLetter}
                                      onChange={(e) =>
                                        setInvoiceLetter(e.target.value)
                                      }
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-16 text-center"
                                    >
                                      <option value="A">A</option>
                                      <option value="B">B</option>
                                      <option value="C" selected>
                                        C
                                      </option>
                                    </select>
                                    <span className="text-slate-400">-</span>
                                    <input
                                      type="text"
                                      value={invoiceFirst4}
                                      onChange={(e) => {
                                        const value = e.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 4);
                                        setInvoiceFirst4(value);
                                      }}
                                      placeholder="0001"
                                      maxLength={4}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-20 text-center"
                                    />
                                    <span className="text-slate-400">-</span>
                                    <input
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
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-28 text-center"
                                    />
                                  </div>
                                  {formSubmitted &&
                                    (!invoiceLetter ||
                                      !invoiceFirst4 ||
                                      !invoiceLast8) && (
                                      <span className="text-red-500 text-sm">
                                        * Todos los campos son obligatorios
                                      </span>
                                    )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Importe:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedInvoice?.amount}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    id="amount"
                                    name="amount"
                                    {...register("amount", { required: true })}
                                    placeholder="Ingrese el importe"
                                    defaultValue={selectedInvoice?.amount || ""}
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-auto"
                                  />
                                  {errors.amount && (
                                    <span className="text-red-500 text-sm">
                                      * Obligatorio
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-start">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Descripcion:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedInvoice?.description}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <textarea
                                    type="text"
                                    defaultValue={
                                      selectedInvoice?.description || ""
                                    }
                                    {...register("description", {
                                      required: true,
                                    })}
                                    id="description"
                                    name="description"
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-[400px] h-[100px]"
                                    rows={4}
                                    cols={50}
                                    placeholder="Ingrese una descripcion"
                                  />
                                  {errors.description && (
                                    <span className="text-red-500 text-sm">
                                      * Obligatorio
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-end">
                              {viewOnly ? (
                                <div>
                                  <Button
                                    variant="destructive"
                                    onClick={() => onCancel()}
                                    className="w-full md:w-auto"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                  <Button
                                    variant="destructive"
                                    onClick={() => onCancel()}
                                    className="w-full md:w-auto"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="submit"
                                    disabled={isLoadingSubmit}
                                    className="w-full md:w-auto"
                                  >
                                    {isLoadingSubmit
                                      ? "Guardando..."
                                      : "Guardar"}
                                  </Button>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </form>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl "></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
