"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { useFieldArray } from "react-hook-form";
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
  useDeliveryNotesQuery,
  useCreateDeliveryNoteMutation,
  useUpdateDeliveryNoteMutation,
  useDeleteDeliveryNoteMutation,
} from "../apis/api.deliverynotes.js";
import { useClientsQuery } from "../apis/api.clients";
import {
  queryDeliveryNotesKey,
  queryClientsKey,
  queryProductsKey,
  queryOrdersKey,
} from "../apis/queryKeys";
import { useProductsQuery } from "../apis/api.products.js";
import { useActiveOrdersQuery } from "../apis/api.orders.js";

export default function DeliveryNotes() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState(null);
  const [client, setClient] = useState(null);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

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

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "products",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryDeliveryNotesKey(),
    queryFn: useDeliveryNotesQuery,
  });

  const {
    data: clients,
    isLoading: isLoadingClients,
    error: errorClients,
  } = useQuery({
    queryKey: queryClientsKey(),
    queryFn: useClientsQuery,
  });

  const {
    data: availableProducts,
    isLoading: isLoadingProducts,
    error: errorProducts,
  } = useQuery({
    queryKey: queryProductsKey(),
    queryFn: useProductsQuery,
  });

  const {
    data: activeOrders,
    isLoading: isLoadingOrders,
    error: errorOrders,
  } = useQuery({
    queryKey: queryOrdersKey(),
    queryFn: useActiveOrdersQuery,
  });

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search ? d.name.toLowerCase().includes(search.toLowerCase()) : d
    );
  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreateDeliveryNoteMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryNotesKey() });
      console.log("Remito creada:", data);
    },
    onError: (error) => {
      console.error("Error creando remito:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateDeliveryNoteMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryNotesKey() });
      console.log("Remito creada:", data);
    },
    onError: (error) => {
      console.error("Error creando remito:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteDeliveryNoteMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryNotesKey() });
      console.log("Remito eliminada:", data);
    },
    onError: (error) => {
      console.error("Error eliminando remito:", error);
    },
  });

  const removeDeliveryNote = async (deliverynoteId) => {
    if (window.confirm("Seguro desea eliminar esta remito?")) {
      try {
        await deleteMutation.mutate(deliverynoteId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const addProduct = () => {
    if (selectedProduct && productQuantity > 0) {
      const existingIndex = fields?.findIndex(
        (field) => field.productId === selectedProduct.id
      );

      if (existingIndex >= 0) {
        update(existingIndex, {
          ...fields[existingIndex],
          quantity: fields[existingIndex].quantity + productQuantity,
        });
      } else {
        append({
          productId: selectedProduct.id,
          productName: selectedProduct.name + "- " + selectedProduct.color,
          productCode: selectedProduct.code,
          productPrice: selectedProduct.price,
          quantity: productQuantity,
        });
      }

      setSelectedProduct(null);
      setProductQuantity(1);
    }
  };

  const updateProductQuantity = (index, newQuantity) => {
    if (newQuantity > 0) {
      update(index, {
        ...fields[index],
        quantity: newQuantity,
      });
    }
  };

  const onSubmit = async (data) => {
    try {
      setFormSubmitted(true);

      if (!data.client || !data.client.id) {
        return;
      }

      setIsLoadingSubmit(true);

      const body = {
        client_id: data.client.id,
        order_id: data.order?.id || null,
        description: data.description,
        products: fields.map((field) => ({
          product_id: field.productId,
          quantity: field.quantity,
          price: field.productPrice || 0,
        })),
        amount: fields.reduce(
          (total, field) =>
            total +
            (availableProducts.find((p) => p.id === field.productId)?.price ||
              0) *
              field.quantity,
          0
        ),
      };

      if (selectedDeliveryNote) {
        updateMutation.mutate({ ...body, id: selectedDeliveryNote.id });
      } else {
        createMutation.mutate(body);
      }
      setIsLoadingSubmit(false);
      setStage("LIST");
    } catch (e) {
      console.log(e);
    }
  };

  const getClientFantasyName = (id) => {
    return clients?.find((s) => s.id === id)?.fantasy_name || "";
  };

  const onEdit = (deliverynoteId) => {
    const deliverynote =
      data.find((deliverynote) => deliverynote.id === deliverynoteId) || null;
    setSelectedDeliveryNote(deliverynote);
    setFormSubmitted(false);
    setViewOnly(false);

    console.log("[v0] onEdit - deliverynote:", deliverynote);
    console.log(
      "[v0] onEdit - deliverynotes_products:",
      deliverynote?.deliverynotes_products
    );
    console.log("[v0] onEdit - availableProducts:", availableProducts);

    const formData = {
      products: [],
      client: null,
      order: null,
      description: deliverynote?.description || "",
    };

    if (deliverynote?.client_id && clients) {
      const selectedClient = clients.find(
        (s) => s.id === deliverynote.client_id
      );
      if (selectedClient) {
        const clientOption = {
          id: selectedClient.id,
          name: selectedClient.name,
          label: selectedClient.name,
        };
        formData.client = clientOption;
        setClient(clientOption);
      }
    }

    if (deliverynote?.order_id && activeOrders) {
      const order = activeOrders.find((o) => o.id === deliverynote.order_id);
      if (order) {
        const orderOption = {
          id: order.id,
          name: `Pedido #${order.order_number}`,
          label: `Pedido #${order.order_number}`,
        };
        formData.order = orderOption;
        setSelectedOrder(orderOption);
      }
    }

    if (deliverynote?.deliverynotes_products && availableProducts) {
      const productsToLoad = deliverynote.deliverynotes_products.map((dnp) => {
        const product = availableProducts.find((p) => p.id === dnp.product_id);
        return {
          productId: dnp.product_id,
          productName: product?.name + "- " + product?.color || "",
          productCode: product?.code || "",
          productPrice: dnp.price || product?.price || 0,
          quantity: dnp.quantity,
        };
      });
      formData.products = productsToLoad;
      console.log("[v0] onEdit - productsToLoad:", productsToLoad);
    }

    console.log("[v0] onEdit - formData:", formData);
    reset(formData);

    setStage("CREATE");
  };

  const onView = (deliverynoteId) => {
    reset();
    const deliverynote =
      data.find((deliverynote) => deliverynote.id === deliverynoteId) || null;
    setSelectedDeliveryNote(deliverynote);
    setViewOnly(true);

    if (deliverynote?.client_id && clients) {
      const selectedClient = clients.find(
        (s) => s.id === deliverynote.client_id
      );
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

    if (deliverynote?.order_id && activeOrders) {
      const order = activeOrders.find((o) => o.id === deliverynote.order_id);
      if (order) {
        const orderOption = {
          id: order.id,
          name: `Pedido #${order.order_number}`,
          label: `Pedido #${order.order_number}`,
        };
        setValue("order", orderOption);
        setSelectedOrder(orderOption);
      }
    }

    if (deliverynote?.deliverynotes_products && availableProducts) {
      const productsToLoad = deliverynote.deliverynotes_products.map((dnp) => {
        const product = availableProducts.find((p) => p.id === dnp.product_id);
        return {
          productId: dnp.product_id,
          productName: product?.name + " - " + product?.color || "",
          productCode: product?.code || "",
          productPrice: dnp.price || product?.price || 0,
          quantity: dnp.quantity,
        };
      });
      setValue("products", productsToLoad);
    }

    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedDeliveryNote(null);
    setSelectedProduct(null);
    setFormSubmitted(false);
    setClient(null);
    setSelectedOrder(null);
    setStage("CREATE");
    reset({ products: [] });
  };

  const onCancel = () => {
    setSelectedDeliveryNote(null);
    setSelectedProduct(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    setFormSubmitted(false);
    setClient(null);
    setSelectedOrder(null);
    reset({ products: [] });
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
            <div>Remitos</div>
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
              Total de remitos {data?.length}
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
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left w-4">
                          #
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Cliente
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Nro Pedido
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Status
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {dataFiltered?.length ? (
                        dataFiltered.map((deliverynote, index) => (
                          <tr
                            key={deliverynote.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {deliverynote.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {new Date(
                                deliverynote.created_at
                              ).toLocaleDateString()}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {getClientFantasyName(deliverynote.client_id)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {deliverynote.order_number
                                ? `#${deliverynote.order_number}`
                                : "-"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4">
                              {deliverynote.order_status ? (
                                <span
                                  className={utils.cn(
                                    "px-2 py-1 rounded text-xs font-medium",
                                    deliverynote.order_status === "ENTREGADO"
                                      ? "bg-green-100 text-green-800"
                                      : "bg-yellow-100 text-yellow-800"
                                  )}
                                >
                                  {deliverynote.order_status}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(deliverynote.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(deliverynote.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() =>
                                    removeDeliveryNote(deliverynote.id)
                                  }
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
                            colSpan={6}
                            className="border-b border-slate-100 p-4 text-slate-500"
                          >
                            No data
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
            </div>
          </div>
        )}

        {stage === "CREATE" && (
          <div className="my-4">
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
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
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Cliente:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <>
                                    {getClientFantasyName(
                                      selectedDeliveryNote?.client_id
                                    )}
                                  </>
                                ) : (
                                  <div className="flex gap-2 w-full items-center">
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

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Pedido:
                              </label>
                              <div className="flex flex-col gap-2 flex-1">
                                {viewOnly ? (
                                  <>
                                    {selectedDeliveryNote?.order_id
                                      ? `Pedido #${
                                          activeOrders?.find(
                                            (o) =>
                                              o.id ===
                                              selectedDeliveryNote.order_id
                                          )?.order_number || ""
                                        }`
                                      : "Sin pedido asociado"}
                                  </>
                                ) : (
                                  <div className="flex gap-2 w-full items-center">
                                    <Controller
                                      name="order"
                                      control={control}
                                      defaultValue={null}
                                      render={({ field }) => (
                                        <SelectComboBox
                                          options={
                                            activeOrders
                                              ? sortBy(
                                                  activeOrders,
                                                  "order_number"
                                                ).map((order) => ({
                                                  id: order.id,
                                                  name: `Pedido #${order.order_number} - ${order.client_name}`,
                                                  label: `Pedido #${order.order_number}`,
                                                }))
                                              : []
                                          }
                                          value={field.value}
                                          onChange={(option) => {
                                            field.onChange(option);
                                            setValue("order", option);
                                            setSelectedOrder(option);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter") {
                                              e.preventDefault();
                                            }
                                          }}
                                        />
                                      )}
                                    />
                                    <span className="text-slate-400 text-sm whitespace-nowrap">
                                      (Opcional)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col gap-4">
                              <label className="text-slate-500 font-bold">
                                Productos:
                              </label>

                              {!viewOnly && (
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                  <div className="flex flex-col md:flex-row gap-4 items-end">
                                    <div className="flex-1">
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Seleccionar Producto
                                      </label>
                                      <select
                                        value={selectedProduct?.id || ""}
                                        onChange={(e) => {
                                          const product =
                                            availableProducts.find(
                                              (p) =>
                                                p.id ===
                                                Number.parseInt(e.target.value)
                                            );
                                          setSelectedProduct(product || null);
                                        }}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">
                                          Seleccione un producto...
                                        </option>
                                        {availableProducts.map((product) => (
                                          <option
                                            key={product.id}
                                            value={product.id}
                                          >
                                            {product.code} - {product.name} -{" "}
                                            {product.color} (Stock:{" "}
                                            {product.stock})
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    <div className="w-full md:w-32">
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Cantidad
                                      </label>
                                      <input
                                        type="number"
                                        min="1"
                                        value={productQuantity}
                                        onChange={(e) =>
                                          setProductQuantity(
                                            Number.parseInt(e.target.value) || 1
                                          )
                                        }
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700 text-center"
                                      />
                                    </div>

                                    <Button
                                      type="button"
                                      onClick={addProduct}
                                      disabled={!selectedProduct}
                                      className="w-full md:w-auto"
                                    >
                                      <Plus className="h-4 w-4 mr-2" />
                                      Agregar
                                    </Button>
                                  </div>
                                </div>
                              )}

                              <div className="space-y-2">
                                {viewOnly &&
                                  selectedDeliveryNote.deliverynotes_products
                                    .length && (
                                    <>
                                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        <table className="w-full">
                                          <thead className="bg-slate-100">
                                            <tr>
                                              <th className="text-left p-3 text-slate-600 font-medium">
                                                Código
                                              </th>
                                              <th className="text-left p-3 text-slate-600 font-medium">
                                                Producto
                                              </th>
                                              <th className="text-left p-3 text-slate-600 font-medium">
                                                Color
                                              </th>
                                              <th className="text-center p-3 text-slate-600 font-medium">
                                                Cantidad
                                              </th>
                                              {!viewOnly && (
                                                <th className="text-center p-3 text-slate-600 font-medium">
                                                  Acciones
                                                </th>
                                              )}
                                            </tr>
                                          </thead>
                                          <tbody>
                                            {selectedDeliveryNote.deliverynotes_products?.map(
                                              (field, index) => (
                                                <tr
                                                  key={field.id}
                                                  className="border-t border-slate-200"
                                                >
                                                  <td className="p-3 text-slate-700 text-sm">
                                                    {field.products.id}
                                                  </td>
                                                  <td className="p-3 text-slate-700">
                                                    {field.products.name}
                                                  </td>
                                                  <td className="p-3 text-slate-700">
                                                    {field.products.color}
                                                  </td>
                                                  <td className="p-3 text-center">
                                                    {viewOnly ? (
                                                      <span className="text-slate-700">
                                                        {field.quantity}
                                                      </span>
                                                    ) : (
                                                      <input
                                                        type="number"
                                                        min="1"
                                                        value={field.quantity}
                                                        onChange={(e) =>
                                                          updateProductQuantity(
                                                            index,
                                                            Number.parseInt(
                                                              e.target.value
                                                            ) || 1
                                                          )
                                                        }
                                                        className="w-20 rounded border border-slate-200 p-2 text-center text-slate-700"
                                                      />
                                                    )}
                                                  </td>
                                                  {!viewOnly && (
                                                    <td className="p-3 text-center">
                                                      <Button
                                                        type="button"
                                                        variant="outline"
                                                        size="sm"
                                                        onClick={() =>
                                                          remove(index)
                                                        }
                                                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                      >
                                                        <Trash2 className="h-4 w-4" />
                                                      </Button>
                                                    </td>
                                                  )}
                                                </tr>
                                              )
                                            )}
                                          </tbody>
                                        </table>
                                      </div>
                                    </>
                                  )}

                                {!viewOnly && fields?.length > 0 && (
                                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                                    <table className="w-full">
                                      <thead className="bg-slate-100">
                                        <tr>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Código
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Producto
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Precio
                                          </th>
                                          <th className="text-center p-3 text-slate-600 font-medium">
                                            Cantidad
                                          </th>
                                          {!viewOnly && (
                                            <th className="text-center p-3 text-slate-600 font-medium">
                                              Acciones
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {fields?.map((field, index) => (
                                          <tr
                                            key={field.id}
                                            className="border-t border-slate-200"
                                          >
                                            <td className="p-3 text-slate-700 text-sm">
                                              {field.productId}
                                            </td>
                                            <td className="p-3 text-slate-700">
                                              {field.productName}
                                            </td>
                                            <td className="p-3 text-slate-700">
                                              {field.productPrice}
                                            </td>
                                            <td className="p-3 text-center">
                                              {viewOnly ? (
                                                <span className="text-slate-700">
                                                  {field.quantity}
                                                </span>
                                              ) : (
                                                <input
                                                  type="number"
                                                  min="1"
                                                  value={field.quantity}
                                                  onChange={(e) =>
                                                    updateProductQuantity(
                                                      index,
                                                      Number.parseInt(
                                                        e.target.value
                                                      ) || 1
                                                    )
                                                  }
                                                  className="w-20 rounded border border-slate-200 p-2 text-center text-slate-700"
                                                />
                                              )}
                                            </td>
                                            {!viewOnly && (
                                              <td className="p-3 text-center">
                                                <Button
                                                  type="button"
                                                  variant="outline"
                                                  size="sm"
                                                  onClick={() => remove(index)}
                                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                >
                                                  <Trash2 className="h-4 w-4" />
                                                </Button>
                                              </td>
                                            )}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {!viewOnly && fields?.length === 0 && (
                                  <div className="text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">
                                    No hay productos seleccionados
                                  </div>
                                )}

                                {selectedDeliveryNote &&
                                  selectedDeliveryNote.deliverynotes_products
                                    ?.length === 0 && (
                                    <div className="text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">
                                      No hay productos seleccionados
                                    </div>
                                  )}

                                {errors.products && (
                                  <span className="text-red-500 text-sm">
                                    * Debe seleccionar al menos un producto
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col gap-2 md:gap-4 md:items-start">
                              <label className="text-slate-500 md:w-20 font-bold">
                                Descripcion:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedDeliveryNote?.description}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <textarea
                                    type="text"
                                    defaultValue={
                                      selectedDeliveryNote?.description || ""
                                    }
                                    {...register("description")}
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
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
