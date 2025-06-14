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
  useDeliveriesQuery,
  useCreateDeliveryMutation,
  useUpdateDeliveryMutation,
  useDeleteDeliveryMutation,
} from "../apis/api.deliveries";
import { useClientsQuery } from "../apis/api.clients";
import { queryDeliveryKey, queryClientsKey } from "../apis/queryKeys";

var moment = require("moment");

export default function Deliveries() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedDelivery, setSelectedDelivery] = useState(null);
  const [client, setClient] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [deliveryLetter, setDeliveryLetter] = useState("");
  const [deliveryFirst4, setDeliveryFirst4] = useState("");
  const [deliveryLast8, setDeliveryLast8] = useState("");
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
    queryKey: queryDeliveryKey(),
    queryFn: useDeliveriesQuery,
  });

  const {
    data: clients,
    isLoading: isLoadingClients,
    error: errorClients,
  } = useQuery({
    queryKey: queryClientsKey(),
    queryFn: useClientsQuery,
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
    mutationFn: useCreateDeliveryMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryKey() });
      console.log("Entrega creada:", data);
    },
    onError: (error) => {
      console.error("Error creando entrega:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateDeliveryMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryKey() });
      console.log("Entrega creada:", data);
    },
    onError: (error) => {
      console.error("Error creando entrega:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteDeliveryMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryKey() });
      console.log("Entrega eliminada:", data);
    },
    onError: (error) => {
      console.error("Error eliminando entrega:", error);
    },
  });

  const removeDelivery = async (deliveryId) => {
    if (window.confirm("Seguro desea eliminar esta entrega?")) {
      try {
        await deleteMutation.mutate(deliveryId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      setFormSubmitted(true);

      // Validar que todos los campos del número de factura estén completos
      if (!deliveryLetter || !deliveryFirst4 || !deliveryLast8) {
        return;
      }

      // Validar que hay un cliente seleccionado
      if (!data.client || !data.client.id) {
        return;
      }

      setIsLoadingSubmit(true);

      const concatenatedDeliveryNumber = concatenateDeliveryNumber();

      const body = {
        client_id: data.client.id,
        amount: data.amount,
        description: data.description,
        invoice_number: concatenatedDeliveryNumber,
      };

      if (selectedDelivery) {
        updateMutation.mutate({ ...body, id: selectedDelivery.id });
      } else {
        createMutation.mutate(body);
      }
      setIsLoadingSubmit(false);
      setStage("LIST");
    } catch (e) {
      console.log(e);
    }
  };
  const getClientFantasyName = (id) =>
    clients?.find((s) => s.id === id).fantasy_name;

  const concatenateDeliveryNumber = () => {
    return `${deliveryLetter}${deliveryFirst4}${deliveryLast8}`;
  };

  const splitDeliveryNumber = (deliveryNumber) => {
    if (!deliveryNumber) return { letter: "", first4: "", last8: "" };
    const letter = deliveryNumber.charAt(0);
    const numbers = deliveryNumber.slice(1);
    const first4 = numbers.slice(0, 4);
    const last8 = numbers.slice(4);
    return { letter, first4, last8 };
  };

  const onEdit = (deliveryId) => {
    reset();
    const delivery =
      data.find((delivery) => delivery.id === deliveryId) || null;
    setSelectedDelivery(delivery);
    setFormSubmitted(false);

    if (delivery?.invoice_number) {
      const { letter, first4, last8 } = splitDeliveryNumber(
        delivery.invoice_number
      );
      setDeliveryLetter(letter);
      setDeliveryFirst4(first4);
      setDeliveryLast8(last8);
    } else {
      setDeliveryLetter("");
      setDeliveryFirst4("");
      setDeliveryLast8("");
    }

    // Establecer el proveedor seleccionado para edición
    if (delivery?.client_id && clients) {
      const selectedClient = clients.find((s) => s.id === delivery.client_id);
      if (selectedClient) {
        const clientOption = {
          id: selectedClient.id,
          name: selectedClient.name,
          label: selectedClient.name,
        };
        setValue("client", clientOption);
        setClient(clientOption);
      }
    }

    setStage("CREATE");
  };

  const onView = (deliveryId) => {
    const delivery =
      data.find((delivery) => delivery.id === deliveryId) || null;
    setSelectedDelivery(delivery);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedDelivery(null);
    setDeliveryLetter("");
    setDeliveryFirst4("");
    setDeliveryLast8("");
    setFormSubmitted(false);
    setClient(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedDelivery(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    setDeliveryLetter("");
    setDeliveryFirst4("");
    setDeliveryLast8("");
    setFormSubmitted(false);
    setClient(null);
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
            <div>Entregas</div>
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
              Total de entregas {data.length}
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
                          Cliente
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
                        dataFiltered.map((delivery, index) => (
                          <tr
                            key={delivery.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {delivery.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {getClientFantasyName(delivery.client_id)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {utils.formatInvoiceNumber(
                                delivery.invoice_number
                              )}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {utils.formatAmount(delivery.amount)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(delivery.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(delivery.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removeDelivery(delivery.id)}
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
                                Cliente:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <>{selectedDelivery?.client.fantasy_name}</>
                                ) : (
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
                                )}
                                {errors.client && (
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
                                  {utils.formatInvoiceNumber(
                                    selectedDelivery?.invoice_number
                                  )}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2 items-center">
                                    <select
                                      value={deliveryLetter}
                                      onChange={(e) =>
                                        setDeliveryLetter(e.target.value)
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
                                      value={deliveryFirst4}
                                      onChange={(e) => {
                                        const value = e.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 4);
                                        setDeliveryFirst4(value);
                                      }}
                                      placeholder="0001"
                                      maxLength={4}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-20 text-center"
                                    />
                                    <span className="text-slate-400">-</span>
                                    <input
                                      type="text"
                                      value={deliveryLast8}
                                      onChange={(e) => {
                                        const value = e.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 8);
                                        setDeliveryLast8(value);
                                      }}
                                      placeholder="00000001"
                                      maxLength={8}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-28 text-center"
                                    />
                                  </div>
                                  {formSubmitted &&
                                    (!deliveryLetter ||
                                      !deliveryFirst4 ||
                                      !deliveryLast8) && (
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
                                  {utils.formatAmount(selectedDelivery?.amount)}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="text"
                                    id="amount"
                                    name="amount"
                                    {...register("amount", { required: true })}
                                    placeholder="Ingrese el importe"
                                    defaultValue={
                                      selectedDelivery?.amount || ""
                                    }
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
                                  {selectedDelivery?.description}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <textarea
                                    type="text"
                                    defaultValue={
                                      selectedDelivery?.description || ""
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
