"use client";

import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { Trash2, Plus, ChevronDown, ChevronRight, Copy } from "lucide-react";
import { useForm, useFieldArray, Controller } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { TrashIcon, EyeIcon, CloseIcon } from "./icons";
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
  useDeleteDeliveryNoteMutation,
} from "../apis/api.deliverynotes.js";
import { useActiveOrdersQuery } from "../apis/api.orders.js";
import { queryDeliveryNotesKey, queryOrdersKey } from "../apis/queryKeys";

export default function DeliveryNotes() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedDeliveryNote, setSelectedDeliveryNote] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [selectedOrder, setSelectedOrder] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const defaultProductRow = {
    codigo: "",
    fuerza: "",
    producto_tipo: "",
    manga: "",
    genero: "",
    color: "",
    cuello: "",
    talle: "",
    cantidad_por_talle: "",
    cantidad_total: "",
    cantidad_pedido: "",
    cantidad_pendiente: "",
    origen: "",
    lo_que_falta: 0,
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      order_number_text: "",
      remito_number: "",
      products: Array.from({ length: 3 }, () => ({ ...defaultProductRow })),
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "products",
  });

  const { data, isLoading, error } = useQuery({
    queryKey: queryDeliveryNotesKey(),
    queryFn: useDeliveryNotesQuery,
  });

  const { data: orders, isLoading: isLoadingOrders } = useQuery({
    queryKey: queryOrdersKey(),
    queryFn: useActiveOrdersQuery,
  });

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search
        ? d.order_number_text?.toLowerCase().includes(search.toLowerCase()) ||
          d.remito_number?.toLowerCase().includes(search.toLowerCase())
        : d
    );

  const createMutation = useMutation({
    mutationFn: useCreateDeliveryNoteMutation,
    onError: (error) => {
      console.error("Error creando egreso:", error);
      alert(error.message || "Error al registrar el egreso de mercadería");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteDeliveryNoteMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryDeliveryNotesKey() });
      console.log("Egreso eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando egreso:", error);
    },
  });

  const removeDeliveryNote = async (deliverynoteId) => {
    if (window.confirm("¿Está seguro que desea eliminar este egreso? Esta acción no se puede deshacer.")) {
      try {
        await deleteMutation.mutateAsync(deliverynoteId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const calculateLoQueFalta = (cantidadPorTalle, cantidadTotal) => {
    const porTalle = parseInt(cantidadPorTalle) || 0;
    const total = parseInt(cantidadTotal) || 0;
    return Math.max(0, total - porTalle);
  };

  const handleOrderSelect = (orderOption) => {
    setSelectedOrder(orderOption);
    setValue("selected_order", orderOption);
    
    if (!orderOption || !orderOption.id) {
      return;
    }

    const order = orders?.find((o) => o.id === orderOption.id);
    if (!order || !order.orders_products) {
      return;
    }

    const productsFromOrder = order.orders_products.map((op) => {
      const cantidadPedido = op.quantity || 0;
      const cantidadEntregada = op.quantity_delivered || 0;
      const cantidadPendiente = Math.max(0, cantidadPedido - cantidadEntregada);
      
      return {
        codigo: op.codigo || "",
        fuerza: op.fuerza || "",
        producto_tipo: op.producto_tipo || "",
        manga: op.manga || "",
        genero: op.genero || "",
        color: op.color || "",
        cuello: op.cuello || "",
        talle: op.talle || "",
        cantidad_por_talle: "",
        cantidad_total: cantidadPendiente.toString(),
        cantidad_pedido: cantidadPedido,
        cantidad_pendiente: cantidadPendiente,
        origen: "STOCK",
        lo_que_falta: cantidadPendiente,
      };
    });

    if (productsFromOrder.length > 0) {
      reset({
        ...watch(),
        selected_order: orderOption,
        products: productsFromOrder,
      });
    }
  };

  const handleCantidadChange = (index, field, value) => {
    const currentProducts = watch("products");
    const currentProduct = currentProducts[index];
    const cantidadPorTalle = field === "cantidad_por_talle" ? value : (currentProduct?.cantidad_por_talle || "");
    const cantidadPendiente = currentProduct?.cantidad_pendiente || 0;
    const loQueFalta = Math.max(0, cantidadPendiente - (parseInt(cantidadPorTalle) || 0));
    
    setValue(`products.${index}.lo_que_falta`, loQueFalta);
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);

      const validProducts = data.products.filter(
        (product) =>
          product.producto_tipo &&
          product.talle &&
          parseInt(product.cantidad_por_talle) > 0
      );

      if (validProducts.length === 0) {
        alert("Debe agregar al menos un producto válido con cantidad");
        setIsLoadingSubmit(false);
        return;
      }

      const orderNumber = selectedOrder?.order_number || data.selected_order?.order_number || null;

      const orderId = selectedOrder?.id || data.selected_order?.id || null;
      console.log("=== Creating Delivery Note ===");
      console.log("selectedOrder:", selectedOrder);
      console.log("data.selected_order:", data.selected_order);
      console.log("order_id to send:", orderId);
      console.log("validProducts:", validProducts);
      
      // Debug alert - remove after testing
      if (!orderId) {
        console.warn("WARNING: No order_id found!");
      }

      const body = {
        order_number_text: orderNumber ? `#${orderNumber}` : null,
        order_id: orderId,
        remito_number: data.remito_number || null,
        products: validProducts.map((product) => ({
          product_id: null,
          codigo: product.codigo || null,
          fuerza: product.fuerza || null,
          producto_tipo: product.producto_tipo || null,
          manga: product.manga || null,
          genero: product.genero || null,
          color: product.color || null,
          cuello: product.cuello || null,
          talle: product.talle || null,
          cantidad_por_talle: parseInt(product.cantidad_por_talle) || 0,
          cantidad_total: parseInt(product.cantidad_pedido) || 0,
          origen: product.origen || null,
          lo_que_falta: Math.max(0, (parseInt(product.cantidad_pendiente) || 0) - (parseInt(product.cantidad_por_talle) || 0)),
          quantity: parseInt(product.cantidad_por_talle) || 0,
          price: 0,
        })),
        amount: 0,
      };

      const result = await createMutation.mutateAsync(body);

      if (result.error) {
        alert(result.error);
        setIsLoadingSubmit(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: queryDeliveryNotesKey() });
      queryClient.invalidateQueries({ queryKey: queryOrdersKey() });

      reset({
        selected_order: null,
        remito_number: "",
        products: Array.from({ length: 3 }, () => ({ ...defaultProductRow })),
      });
      setSelectedOrder(null);
      setIsLoadingSubmit(false);
      setStage("LIST");
      alert("Egreso de mercadería registrado exitosamente");
    } catch (e) {
      console.log(e);
      alert("Error al guardar el egreso de mercadería");
      setIsLoadingSubmit(false);
    }
  };

  const addRow = () => {
    append({ ...defaultProductRow });
  };

  const duplicateRow = (index) => {
    const currentProducts = watch("products");
    const productToDuplicate = currentProducts[index];
    if (productToDuplicate) {
      append({
        codigo: productToDuplicate.codigo || "",
        fuerza: productToDuplicate.fuerza || "",
        producto_tipo: productToDuplicate.producto_tipo || "",
        manga: productToDuplicate.manga || "",
        genero: productToDuplicate.genero || "",
        color: productToDuplicate.color || "",
        cuello: productToDuplicate.cuello || "",
        talle: "",
        cantidad_por_talle: "",
        cantidad_total: productToDuplicate.cantidad_total || "",
        cantidad_pedido: productToDuplicate.cantidad_pedido || "",
        cantidad_pendiente: productToDuplicate.cantidad_pendiente || "",
        origen: productToDuplicate.origen || "",
        lo_que_falta: productToDuplicate.cantidad_pendiente || 0,
      });
    }
  };

  const onCreate = () => {
    setSelectedDeliveryNote(null);
    setSelectedOrder(null);
    setViewOnly(false);
    reset({
      selected_order: null,
      remito_number: "",
      products: Array.from({ length: 3 }, () => ({ ...defaultProductRow })),
    });
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedDeliveryNote(null);
    setSelectedOrder(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    reset({
      selected_order: null,
      remito_number: "",
      products: Array.from({ length: 3 }, () => ({ ...defaultProductRow })),
    });
    setStage("LIST");
  };

  const onView = (deliverynoteId) => {
    const deliverynote = data.find((d) => d.id === deliverynoteId) || null;
    setSelectedDeliveryNote(deliverynote);
    setViewOnly(true);
    setStage("VIEW");
  };

  const toggleRowExpansion = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

  const getTotalProducts = (entry) => {
    if (entry.deliverynotes_products) {
      return entry.deliverynotes_products.length;
    }
    return 0;
  };

  const getTotalQuantity = (entry) => {
    if (entry.deliverynotes_products) {
      return entry.deliverynotes_products.reduce(
        (sum, product) => sum + (product.cantidad_por_talle || product.quantity || 0),
        0
      );
    }
    return 0;
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
            <div>Egreso de Mercadería</div>
          </div>
          {stage === "LIST" && (
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
          <>
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
                placeholder="Buscar por número de pedido o remito..."
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isLoading && (
              <div>
                <Spinner />
              </div>
            )}
            {error && <div className="text-red-500">{/* ERROR... */}</div>}
            {data && (
              <div className="my-4 mb-28">
                <p className="pl-1 pb-1 text-slate-500">
                  Total de egresos {data?.length}
                </p>
                <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
                  <div
                    className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]"
                    style={{ backgroundPosition: "10px 10px" }}
                  ></div>
                  <div className="relative rounded-xl overflow-auto">
                    <div className="shadow-sm overflow-auto my-8">
                      <table className="border-collapse table-auto w-full text-sm">
                        <thead>
                          <tr>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left w-4"></th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left w-4">
                              #
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Fecha
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Nro. Pedido
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Nro. Remito
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Productos
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Cantidad Total
                            </th>
                            <th className="border-b font-medium text-sm p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                              Acciones
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white">
                          {dataFiltered?.length ? (
                            dataFiltered.map((entry, index) => (
                              <React.Fragment key={entry.id}>
                                <tr
                                  className={utils.cn(
                                    "border-b last:border-b-0 hover:bg-gray-100",
                                    index % 2 === 0 && "bg-gray-50"
                                  )}
                                >
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <button
                                      onClick={() => toggleRowExpansion(entry.id)}
                                      className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded"
                                    >
                                      {expandedRows[entry.id] ? (
                                        <ChevronDown className="h-4 w-4" />
                                      ) : (
                                        <ChevronRight className="h-4 w-4" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {entry.id}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {new Date(entry.created_at).toLocaleDateString("es-AR")}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {entry.order_number_text || entry.order_number || "-"}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {entry.remito_number || entry.number || "-"}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {getTotalProducts(entry)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {getTotalQuantity(entry)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                    <div className="flex gap-2">
                                      <button
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Ver detalle"
                                        onClick={() => onView(entry.id)}
                                      >
                                        <EyeIcon />
                                      </button>
                                      <button
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Eliminar"
                                        onClick={() => removeDeliveryNote(entry.id)}
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedRows[entry.id] && (
                                  <tr>
                                    <td colSpan={8} className="bg-gray-50 border-b border-slate-200">
                                      <div className="p-4">
                                        <h4 className="font-semibold text-slate-700 mb-3">
                                          Detalle de Productos
                                        </h4>
                                        {entry.deliverynotes_products?.length > 0 ? (
                                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-slate-100">
                                                <tr>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Código</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Fuerza</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Producto</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Manga</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Género</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Color</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Cuello</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Talle</th>
                                                  <th className="text-center p-2 text-slate-600 font-medium text-xs">Cant/Talle</th>
                                                  <th className="text-center p-2 text-slate-600 font-medium text-xs">Cant Total</th>
                                                  <th className="text-left p-2 text-slate-600 font-medium text-xs">Origen</th>
                                                  <th className="text-center p-2 text-slate-600 font-medium text-xs">Falta</th>
                                                </tr>
                                              </thead>
                                              <tbody>
                                                {entry.deliverynotes_products.map((product, idx) => (
                                                  <tr key={product.id || idx} className="border-t border-slate-200">
                                                    <td className="p-2 text-slate-700 text-xs">{product.codigo || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.fuerza || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.producto_tipo || product.products?.name || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.manga || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.genero || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.color || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.cuello || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.talle || "-"}</td>
                                                    <td className="p-2 text-center text-slate-700 text-xs">{product.cantidad_por_talle || product.quantity || "-"}</td>
                                                    <td className="p-2 text-center text-slate-700 text-xs">{product.cantidad_total || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">
                                                      <span className={utils.cn(
                                                        "px-2 py-1 rounded text-xs",
                                                        product.origen === "STOCK" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                                                      )}>
                                                        {product.origen || "-"}
                                                      </span>
                                                    </td>
                                                    <td className="p-2 text-center text-slate-700 text-xs font-medium">
                                                      {product.lo_que_falta || 0}
                                                    </td>
                                                  </tr>
                                                ))}
                                              </tbody>
                                            </table>
                                          </div>
                                        ) : (
                                          <div className="text-slate-500 text-center py-4 bg-white rounded border border-slate-200">
                                            No hay productos en este egreso
                                          </div>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={8} className="border-b border-slate-100 p-4 text-slate-500">
                                No hay egresos registrados
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
          </>
        )}

        {stage === "VIEW" && selectedDeliveryNote && (
          <div className="my-4">
            <div className="bg-white rounded-lg p-6 shadow">
              <h3 className="text-lg font-bold mb-4">Detalle del Egreso #{selectedDeliveryNote.id}</h3>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="text-slate-500 font-medium">Nro. Pedido:</label>
                  <p className="text-slate-700">{selectedDeliveryNote.order_number_text || "-"}</p>
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Nro. Remito:</label>
                  <p className="text-slate-700">{selectedDeliveryNote.remito_number || selectedDeliveryNote.number || "-"}</p>
                </div>
                <div>
                  <label className="text-slate-500 font-medium">Fecha:</label>
                  <p className="text-slate-700">{new Date(selectedDeliveryNote.created_at).toLocaleDateString("es-AR")}</p>
                </div>
              </div>
              
              <h4 className="font-semibold text-slate-700 mb-3 mt-6">Productos</h4>
              {selectedDeliveryNote.deliverynotes_products?.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border border-slate-200 rounded">
                    <thead className="bg-slate-100">
                      <tr>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Código</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Fuerza</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Producto</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Manga</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Género</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Color</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Cuello</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Talle</th>
                        <th className="text-center p-2 text-slate-600 font-medium text-xs">Cant/Talle</th>
                        <th className="text-center p-2 text-slate-600 font-medium text-xs">Cant Total</th>
                        <th className="text-left p-2 text-slate-600 font-medium text-xs">Origen</th>
                        <th className="text-center p-2 text-slate-600 font-medium text-xs">Falta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedDeliveryNote.deliverynotes_products.map((product, idx) => (
                        <tr key={product.id || idx} className="border-t border-slate-200">
                          <td className="p-2 text-slate-700 text-xs">{product.codigo || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.fuerza || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.producto_tipo || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.manga || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.genero || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.color || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.cuello || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">{product.talle || "-"}</td>
                          <td className="p-2 text-center text-slate-700 text-xs">{product.cantidad_por_talle || product.quantity || "-"}</td>
                          <td className="p-2 text-center text-slate-700 text-xs">{product.cantidad_total || "-"}</td>
                          <td className="p-2 text-slate-700 text-xs">
                            <span className={utils.cn(
                              "px-2 py-1 rounded text-xs",
                              product.origen === "STOCK" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"
                            )}>
                              {product.origen || "-"}
                            </span>
                          </td>
                          <td className="p-2 text-center text-slate-700 text-xs font-medium">{product.lo_que_falta || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-slate-500">No hay productos</p>
              )}

              <div className="mt-6 flex gap-4 justify-end">
                <Button variant="destructive" onClick={() => removeDeliveryNote(selectedDeliveryNote.id)}>
                  Eliminar
                </Button>
                <Button variant="alternative" onClick={() => setStage("LIST")}>
                  Volver
                </Button>
              </div>
            </div>
          </div>
        )}

        {stage === "CREATE" && (
          <div className="my-4">
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
              <div
                className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]"
                style={{ backgroundPosition: "10px 10px" }}
              ></div>
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-hidden my-8">
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full flex flex-col"
                  >
                    <div className="bg-white p-4">
                      {/* Número de Pedido */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-32 font-bold text-sm">
                          Nro. Pedido:
                        </label>
                        <div className="flex-1 max-w-md">
                          <Controller
                            name="selected_order"
                            control={control}
                            render={({ field }) => (
                              <SelectComboBox
                                options={sortBy(orders || [], "order_number").map((order) => ({
                                  id: order.id,
                                  name: `#${order.order_number} - ${order.client_name || "Sin cliente"}`,
                                  label: `Pedido #${order.order_number}`,
                                  order_number: order.order_number,
                                }))}
                                value={field.value}
                                onChange={(option) => {
                                  field.onChange(option);
                                  handleOrderSelect(option);
                                }}
                                placeholder="Buscar pedido por número..."
                              />
                            )}
                          />
                        </div>
                        {selectedOrder && (
                          <span className="text-xs text-green-600 font-medium">
                            Pedido #{selectedOrder.order_number} seleccionado
                          </span>
                        )}
                      </div>

                      {/* Número de Remito */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-32 font-bold text-sm">
                          Nro. Remito:
                        </label>
                        <input
                          type="text"
                          {...register("remito_number")}
                          className="rounded border border-slate-200 p-2 text-slate-500 text-sm max-w-xs"
                          placeholder="Número de remito"
                        />
                      </div>

                      {/* Productos */}
                      <div className="p-4">
                        <div className="flex items-center justify-between mb-4">
                          <label className="text-slate-500 font-bold">
                            Productos:
                          </label>
                          <button
                            type="button"
                            onClick={addRow}
                            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                          >
                            <Plus className="h-5 w-5" />
                            Agregar fila
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse text-xs">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Código</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Fuerza</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Producto *</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Manga</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Género</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Color</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Cuello</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Talle *</th>
                                <th className="border border-slate-200 p-2 text-center text-xs text-slate-600 bg-blue-50">Pedido</th>
                                <th className="border border-slate-200 p-2 text-center text-xs text-slate-600 bg-orange-50">Pendiente</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Cant/Talle</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Origen</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">Falta</th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600 w-12">Acción</th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map((field, index) => (
                                <tr key={field.id}>
                                  {/* Código */}
                                  <td className="border border-slate-200 p-1">
                                    <input
                                      type="text"
                                      {...register(`products.${index}.codigo`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                      placeholder="Código"
                                    />
                                  </td>
                                  {/* Fuerza */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.fuerza`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      {utils.getProductFuerzas().map((fuerza) => (
                                        <option key={fuerza} value={fuerza}>{fuerza}</option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Producto */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.producto_tipo`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      {utils.getProductTypes().map((tipo) => (
                                        <option key={tipo} value={tipo}>{tipo}</option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Manga - solo para CAMISA */}
                                  <td className="border border-slate-200 p-1">
                                    {watch(`products.${index}.producto_tipo`) === "CAMISA" ? (
                                      <select
                                        {...register(`products.${index}.manga`)}
                                        className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                      >
                                        <option value="">-</option>
                                        {utils.getProductSleeves().map((sleeve) => (
                                          <option key={sleeve} value={sleeve}>{sleeve}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs text-slate-400 p-1">N/A</span>
                                    )}
                                  </td>
                                  {/* Género */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.genero`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      {utils.getProductGenres().map((genre) => (
                                        <option key={genre} value={genre}>{genre}</option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Color */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.color`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      {utils.getProductColors().map((color) => (
                                        <option key={color} value={color}>{color}</option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Cuello - solo para CAMISA */}
                                  <td className="border border-slate-200 p-1">
                                    {watch(`products.${index}.producto_tipo`) === "CAMISA" ? (
                                      <select
                                        {...register(`products.${index}.cuello`)}
                                        className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                      >
                                        <option value="">-</option>
                                        {utils.getProductNecks().map((neck) => (
                                          <option key={neck} value={neck}>{neck}</option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs text-slate-400 p-1">N/A</span>
                                    )}
                                  </td>
                                  {/* Talle */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.talle`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      {utils.getProductTalles().map((talle) => (
                                        <option key={talle} value={talle}>{talle}</option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Cantidad Pedido (readonly) */}
                                  <td className="border border-slate-200 p-1 bg-blue-50">
                                    <span className="block w-14 text-center text-xs font-semibold text-blue-700">
                                      {watch(`products.${index}.cantidad_pedido`) || "-"}
                                    </span>
                                  </td>
                                  {/* Cantidad Pendiente (readonly) */}
                                  <td className="border border-slate-200 p-1 bg-orange-50">
                                    <span className="block w-14 text-center text-xs font-semibold text-orange-700">
                                      {watch(`products.${index}.cantidad_pendiente`) || "-"}
                                    </span>
                                  </td>
                                  {/* Cantidad por Talle */}
                                  <td className="border border-slate-200 p-1">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      {...register(`products.${index}.cantidad_por_talle`)}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        e.target.value = value;
                                        handleCantidadChange(index, "cantidad_por_talle", value);
                                      }}
                                      className="w-16 rounded border border-slate-200 p-1 text-xs text-slate-500 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="0"
                                    />
                                  </td>
                                  {/* Origen */}
                                  <td className="border border-slate-200 p-1">
                                    <select
                                      {...register(`products.${index}.origen`)}
                                      className="w-full rounded border border-slate-200 p-1 text-xs text-slate-500"
                                    >
                                      <option value="">-</option>
                                      <option value="STOCK">STOCK</option>
                                      <option value="CONFECCION">CONFECCION</option>
                                    </select>
                                  </td>
                                  {/* Lo que falta */}
                                  <td className="border border-slate-200 p-1 text-center">
                                    <span className="text-xs font-medium text-orange-600">
                                      {watch(`products.${index}.lo_que_falta`) || 0}
                                    </span>
                                  </td>
                                  {/* Acción */}
                                  <td className="border border-slate-200 p-1 text-center">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        type="button"
                                        onClick={() => duplicateRow(index)}
                                        className="text-blue-500 hover:text-blue-700 p-1"
                                        title="Duplicar fila"
                                      >
                                        <Copy className="h-3 w-3" />
                                      </button>
                                      {fields.length > 1 && (
                                        <button
                                          type="button"
                                          onClick={() => remove(index)}
                                          className="text-red-500 hover:text-red-700 font-bold text-lg"
                                          title="Eliminar fila"
                                        >
                                          ×
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Botones */}
                      <div className="p-4 gap-4 flex items-center justify-end">
                        <div className="gap-4 flex">
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={onCancel}
                          >
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={isLoadingSubmit}>
                            {isLoadingSubmit ? "Guardando..." : "Guardar"}
                          </Button>
                        </div>
                      </div>
                    </div>
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
