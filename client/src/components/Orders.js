"use client";

import { ExternalLinkIcon } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { Trash2, Plus, ChevronDown, ChevronRight } from "lucide-react";
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
  useOrdersQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useDeleteOrderMutation,
} from "../apis/api.orders.js";
import { useClientsQuery } from "../apis/api.clients";
import {
  queryOrdersKey,
  queryClientsKey,
  queryProductsKey,
} from "../apis/queryKeys";
import { useProductsQuery } from "../apis/api.products.js";

export default function Orders() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [productQuantity, setProductQuantity] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
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
    queryKey: queryOrdersKey(),
    queryFn: useOrdersQuery,
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

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search ? d.order_number?.toString().includes(search) : d
    );
  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreateOrderMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryOrdersKey() });
      console.log("Pedido creado:", data);
      if (data.error) {

        let error = data.error;

        if (error.includes("duplicate key value violates unique constraint")) {
          error = "El número de pedido ya existe";
        }
        if (error.includes("violates foreign key constraint")) {
          error = "El cliente no existe";
        }
        if (error.includes("violates check constraint")) {
          error = "El tipo de pedido no es válido";
        }

        if (error.includes("violates not null constraint")) {
          error = "El número de pedido es requerido";
        }

        alert(error);
      }
    },
    onError: (error) => {
      console.error("Error creando pedido:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateOrderMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryOrdersKey() });
      console.log("Pedido actualizado:", data);
    },
    onError: (error) => {
      console.error("Error actualizando pedido:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteOrderMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryOrdersKey() });
      console.log("Pedido eliminado:", data);
    },
    onError: (error) => {
      console.log(error);
    },
  });

  const removeOrder = async (orderId) => {
    if (window.confirm("Seguro desea eliminar este pedido?")) {
      try {
        await deleteMutation.mutate(orderId);
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
          productName: selectedProduct.name + " - " + selectedProduct.color,
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

      if (!fields || fields.length === 0) {
        return;
      }

      if (!data.order_type) {
        return;
      }

      setIsLoadingSubmit(true);

      const body = {
        client_id: data.client.id,
        order_number: data.order_number,
        order_type: data.order_type,
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

      if (selectedOrder) {
        updateMutation.mutate({ ...body, id: selectedOrder.id });
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

  const getOrderTypeName = (type) => {
    return type;
  };

  const toggleRowExpansion = (orderId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [orderId]: !prev[orderId],
    }));
  };

  const onEdit = (orderId) => {
    const order = data.find((order) => order.id === orderId) || null;
    setSelectedOrder(order);
    setFormSubmitted(false);
    setViewOnly(false);

    const formData = {
      order_number: order?.order_number || "",
      order_type: order?.order_type || "",
      description: order?.description || "",
      client: null,
      products: [],
    };

    if (order?.client_id && clients) {
      const selectedClient = clients.find((s) => s.id === order.client_id);
      if (selectedClient) {
        formData.client = {
          id: selectedClient.id,
          name: selectedClient.fantasy_name,
          label: selectedClient.name,
        };
        setClient(formData.client);
      }
    }

    if (order?.orders_products && availableProducts) {
      formData.products = order.orders_products.map((op) => {
        const product = availableProducts.find((p) => p.id === op.product_id);
        return {
          productId: op.product_id,
          productName: product?.name + " - " + product.color || "",
          productCode: product?.code || "",
          productPrice: op.price || product?.price || 0,
          quantity: op.quantity,
        };
      });
      console.log("[v0] Loading products for edit:", formData.products);
    }

    reset(formData);
    setStage("CREATE");
  };

  const onView = (orderId) => {
    const order = data.find((order) => order.id === orderId) || null;
    setSelectedOrder(order);
    setViewOnly(true);
    setFormSubmitted(false);

    const formData = {
      order_number: order?.order_number || "",
      order_type: order?.order_type || "",
      description: order?.description || "",
      client: null,
      products: [],
    };

    if (order?.client_id && clients) {
      const selectedClient = clients.find((s) => s.id === order.client_id);
      if (selectedClient) {
        formData.client = {
          id: selectedClient.id,
          name: selectedClient.fantasy_name,
          label: selectedClient.name,
        };
      }
    }

    if (order?.orders_products && availableProducts) {
      formData.products = order.orders_products.map((op) => {
        const product = availableProducts.find((p) => p.id === op.product_id);
        return {
          productId: op.product_id,
          productName: product?.name + " - " + product?.color || "",
          productCode: product?.code || "",
          productPrice: op.price || product?.price || 0,
          quantity: op.quantity,
        };
      });
      console.log("[v0] Loading products for view:", formData.products);
    }

    reset(formData);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedOrder(null);
    setFormSubmitted(false);
    setClient(null);
    reset({ products: [] });
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedOrder(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    setFormSubmitted(false);
    setClient(null);
    reset({ products: [] });
    setStage("LIST");
  };

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Pedidos</div>
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
              placeholder="Buscar por número de pedido..."
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
              Total de pedidos {data?.length}
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
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left w-4"></th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left w-4">
                          #
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Nro Pedido
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Cliente
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Tipo
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Status
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered?.length ? (
                        dataFiltered.map((order, index) => {
                          const allProductsDelivered =
                            order.orders_products?.every((op) => {
                              const quantityDelivered =
                                op.quantity_delivered || 0;
                              return quantityDelivered >= op.quantity;
                            });
                          const orderStatus = allProductsDelivered
                            ? "ENTREGADO"
                            : "PENDIENTE";

                          return (
                            <>
                              <tr
                                key={order.id}
                                className={utils.cn(
                                  "border-b last:border-b-0 hover:bg-gray-100",
                                  index % 2 === 0 && "bg-gray-50"
                                )}
                              >
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  <button
                                    onClick={() => toggleRowExpansion(order.id)}
                                    className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded"
                                    title={
                                      expandedRows[order.id]
                                        ? "Contraer"
                                        : "Expandir"
                                    }
                                  >
                                    {expandedRows[order.id] ? (
                                      <ChevronDown className="h-4 w-4" />
                                    ) : (
                                      <ChevronRight className="h-4 w-4" />
                                    )}
                                  </button>
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {order.id}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {order.order_number}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {new Date(
                                    order.created_at
                                  ).toLocaleDateString()}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {getClientFantasyName(order.client_id)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {getOrderTypeName(order.order_type)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  <span
                                    className={utils.cn(
                                      "px-2 py-1 rounded text-xs font-medium",
                                      orderStatus === "ENTREGADO"
                                        ? "bg-green-100 text-green-700"
                                        : "bg-yellow-100 text-yellow-700"
                                    )}
                                  >
                                    {orderStatus}
                                  </span>
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                  <div className="flex gap-2">
                                    <button
                                      className="flex items-center justify-center w-8 h-8"
                                      title="Ver detalle"
                                      onClick={() => onView(order.id)}
                                    >
                                      <EyeIcon />
                                    </button>
                                    <button
                                      className="flex items-center justify-center w-8 h-8"
                                      title="Editar"
                                      onClick={() => onEdit(order.id)}
                                    >
                                      <EditIcon />
                                    </button>
                                    <button
                                      className="flex items-center justify-center w-8 h-8"
                                      title="Eliminar"
                                      onClick={() => removeOrder(order.id)}
                                    >
                                      <TrashIcon />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                              {expandedRows[order.id] && (
                                <tr key={`${order.id}-detail`}>
                                  <td
                                    colSpan={8}
                                    className="bg-gray-50 border-b border-slate-200"
                                  >
                                    <div className="p-4">
                                      <h4 className="font-semibold text-slate-700 mb-3">
                                        Detalle de Productos
                                      </h4>
                                      {order.orders_products &&
                                      order.orders_products.length > 0 ? (
                                        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                          <table className="w-full text-sm">
                                            <thead className="bg-slate-100">
                                              <tr>
                                                <th className="text-left p-3 text-slate-600 font-medium">
                                                  Código
                                                </th>
                                                <th className="text-left p-3 text-slate-600 font-medium">
                                                  Producto
                                                </th>
                                                <th className="text-center p-3 text-slate-600 font-medium">
                                                  Cantidad Pedida
                                                </th>
                                                <th className="text-center p-3 text-slate-600 font-medium">
                                                  Cantidad Entregada
                                                </th>
                                                <th className="text-center p-3 text-slate-600 font-medium">
                                                  Cantidad Pendiente
                                                </th>
                                                <th className="text-right p-3 text-slate-600 font-medium"></th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {order.orders_products.map(
                                                (orderProduct, idx) => {
                                                  const product =
                                                    orderProduct.products;
                                                  const quantityOrdered =
                                                    orderProduct.quantity;
                                                  const quantityDelivered =
                                                    orderProduct.quantity_delivered ||
                                                    0;
                                                  const quantityPending =
                                                    quantityOrdered -
                                                    quantityDelivered;

                                                  return (
                                                    <tr
                                                      key={orderProduct.id}
                                                      className={utils.cn(
                                                        "border-t border-slate-200",
                                                        idx % 2 === 0 &&
                                                          "bg-gray-50"
                                                      )}
                                                    >
                                                      <td className="p-3 text-slate-700">
                                                        {product?.code || "N/A"}
                                                      </td>
                                                      <td className="p-3 text-slate-700">
                                                        {product?.name || "N/A"}
                                                      </td>
                                                      <td className="p-3 text-center text-slate-700">
                                                        {quantityOrdered}
                                                      </td>
                                                      <td className="p-3 text-center text-green-600 font-medium">
                                                        {quantityDelivered}
                                                      </td>
                                                      <td className="p-3 text-center text-orange-600 font-medium">
                                                        {quantityPending}
                                                      </td>
                                                      <td className="p-3 text-right text-slate-700 font-medium"></td>
                                                    </tr>
                                                  );
                                                }
                                              )}
                                            </tbody>
                                            <tfoot className="bg-slate-100 border-t-2 border-slate-300">
                                              <tr>
                                                <td
                                                  colSpan={5}
                                                  className="p-3 text-right font-bold text-slate-700"
                                                ></td>
                                                <td className="p-3 text-right font-bold text-slate-700"></td>
                                              </tr>
                                            </tfoot>
                                          </table>
                                        </div>
                                      ) : (
                                        <div className="text-slate-500 text-center py-4 bg-white rounded border border-slate-200">
                                          No hay productos en este pedido
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={8}
                            className="border-b border-slate-100 p-4 text-slate-500"
                          >
                            No hay pedidos
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
                              <label className="text-slate-500 md:w-32 font-bold">
                                Nro Pedido:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <span className="text-slate-700">
                                    {selectedOrder?.order_number}
                                  </span>
                                ) : (
                                  <>
                                    <input
                                      type="text"
                                      defaultValue={
                                        selectedOrder?.order_number || ""
                                      }
                                      {...register("order_number", {
                                        required: true,
                                      })}
                                      className="rounded border border-slate-200 p-3 text-slate-700 w-full md:w-[300px]"
                                      placeholder="Ingrese número de pedido"
                                    />
                                    {errors.order_number && (
                                      <span className="text-red-500 text-sm">
                                        * Obligatorio
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Tipo de Pedido:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <span className="text-slate-700">
                                    {getOrderTypeName(
                                      selectedOrder?.order_type
                                    )}
                                  </span>
                                ) : (
                                  <>
                                    <select
                                      defaultValue={
                                        selectedOrder?.order_type || ""
                                      }
                                      {...register("order_type", {
                                        required: true,
                                      })}
                                      className="rounded border border-slate-200 p-3 text-slate-700 w-full md:w-[300px]"
                                    >
                                      <option value="">
                                        Seleccione tipo de pedido...
                                      </option>
                                      <option value="Egreso">
                                        Egreso
                                      </option>
                                      <option value="Consignacion">
                                        Consignación
                                      </option>
                                    </select>
                                    {errors.order_type && (
                                      <span className="text-red-500 text-sm">
                                        * Obligatorio
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Cliente:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <>
                                    {getClientFantasyName(
                                      selectedOrder?.client_id
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
                                            {product.code} - {product.name}{" "}
                                            {product.color
                                              ? `- ${product.color}`
                                              : ""}
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
                                        className="w-full rounded border border-slate-200 p-3 text-center text-slate-700"
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
                                {fields?.length === 0 ? (
                                  <div className="text-slate-400 text-center py-4 border border-dashed border-slate-200 rounded">
                                    No hay productos seleccionados
                                  </div>
                                ) : (
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
                                            <td className="p-3 text-slate-700 text-sm ml-2">
                                              {field.productId}
                                            </td>
                                            <td className="p-3 text-slate-700">
                                              {field.productName}
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
                                {formSubmitted && fields?.length === 0 && (
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
                              <label className="text-slate-500 md:w-32 font-bold">
                                Descripción:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedOrder?.description}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2 w-full">
                                  <textarea
                                    type="text"
                                    defaultValue={
                                      selectedOrder?.description || ""
                                    }
                                    {...register("description")}
                                    id="description"
                                    name="description"
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-[400px] h-[100px]"
                                    rows={4}
                                    cols={50}
                                    placeholder="Ingrese una descripción (opcional)"
                                  />
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
