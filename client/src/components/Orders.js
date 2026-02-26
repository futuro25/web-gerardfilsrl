"use client";

import React from 'react';
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
import { useStockEntriesQuery } from "../apis/api.stock";
import { useDeliveryNotesQuery } from "../apis/api.deliverynotes";
import {
  queryOrdersKey,
  queryClientsKey,
  queryProductsKey,
  queryDeliveryNotesKey,
} from "../apis/queryKeys";
import { useProductsQuery } from "../apis/api.products.js";

export default function Orders() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [client, setClient] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [formSubmitted, setFormSubmitted] = useState(false);

  // States for new product line
  const [newProductCodigo, setNewProductCodigo] = useState("");
  const [newProductTipo, setNewProductTipo] = useState("");
  const [newProductManga, setNewProductManga] = useState("");
  const [newProductGenero, setNewProductGenero] = useState("");
  const [newProductColor, setNewProductColor] = useState("");
  const [newProductCuello, setNewProductCuello] = useState("");
  const [newProductTalle, setNewProductTalle] = useState("");
  const [newProductCantidad, setNewProductCantidad] = useState(1);

  const {
    register,
    handleSubmit,
    reset,
    trigger,
    setValue,
    control,
    watch,
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

  const {
    data: stockEntries,
    isLoading: isLoadingStock,
  } = useQuery({
    queryKey: ["stockEntries"],
    queryFn: useStockEntriesQuery,
  });

  const {
    data: deliveryNotes,
    isLoading: isLoadingDeliveryNotes,
  } = useQuery({
    queryKey: queryDeliveryNotesKey(),
    queryFn: useDeliveryNotesQuery,
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
    onError: (error) => {
      console.error("Error creando pedido:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateOrderMutation,
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
    if (window.confirm("¿Está seguro que desea eliminar este pedido? Esta acción no se puede deshacer.")) {
      try {
        await deleteMutation.mutate(orderId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const getStockForVariant = (productoTipo, manga, genero, color, cuello, talle) => {
    let totalEntradas = 0;
    let totalSalidas = 0;
    
    // Sumar entradas de stock
    if (stockEntries && Array.isArray(stockEntries)) {
      stockEntries.forEach((entry) => {
        if (entry.stock_entries_products) {
          entry.stock_entries_products.forEach((sep) => {
            const sepProductoTipo = sep.producto_tipo || sep.products?.name || "";
            const matchesType = !productoTipo || sepProductoTipo.toUpperCase() === productoTipo.toUpperCase();
            
            const sepManga = sep.sleeve || sep.manga || "";
            const matchesManga = !manga || sepManga.toUpperCase() === manga.toUpperCase();
            
            const sepGenero = sep.genre || sep.genero || "";
            const matchesGenero = !genero || sepGenero.toUpperCase() === genero.toUpperCase();
            
            const matchesColor = !color || (sep.color || "").toUpperCase() === color.toUpperCase();
            
            const sepCuello = sep.neck || sep.cuello || "";
            const matchesCuello = !cuello || sepCuello.toUpperCase() === cuello.toUpperCase();
            
            const matchesTalle = !talle || sep.talle === talle;
            
            if (matchesType && matchesManga && matchesGenero && matchesColor && matchesCuello && matchesTalle) {
              totalEntradas += sep.quantity || 0;
            }
          });
        }
      });
    }
    
    // Restar salidas (delivery notes)
    if (deliveryNotes && Array.isArray(deliveryNotes)) {
      deliveryNotes.forEach((dn) => {
        if (dn.deliverynotes_products) {
          dn.deliverynotes_products.forEach((dnp) => {
            const dnpProductoTipo = dnp.producto_tipo || "";
            const matchesType = !productoTipo || dnpProductoTipo.toUpperCase() === productoTipo.toUpperCase();
            
            const dnpManga = dnp.manga || "";
            const matchesManga = !manga || dnpManga.toUpperCase() === manga.toUpperCase();
            
            const dnpGenero = dnp.genero || "";
            const matchesGenero = !genero || dnpGenero.toUpperCase() === genero.toUpperCase();
            
            const matchesColor = !color || (dnp.color || "").toUpperCase() === color.toUpperCase();
            
            const dnpCuello = dnp.cuello || "";
            const matchesCuello = !cuello || dnpCuello.toUpperCase() === cuello.toUpperCase();
            
            const matchesTalle = !talle || dnp.talle === talle;
            
            if (matchesType && matchesManga && matchesGenero && matchesColor && matchesCuello && matchesTalle) {
              totalSalidas += dnp.cantidad_por_talle || dnp.quantity || 0;
            }
          });
        }
      });
    }
    
    return Math.max(0, totalEntradas - totalSalidas);
  };

  const resetNewProductFields = () => {
    setNewProductCodigo("");
    setNewProductTipo("");
    setNewProductManga("");
    setNewProductGenero("");
    setNewProductColor("");
    setNewProductCuello("");
    setNewProductTalle("");
    setNewProductCantidad(1);
  };

  const addProduct = () => {
    if (!newProductTipo || !newProductTalle || newProductCantidad <= 0) {
      alert("Debe seleccionar al menos el tipo de producto, talle y cantidad");
      return;
    }

    const variantKey = `${newProductCodigo}-${newProductTipo}-${newProductManga}-${newProductGenero}-${newProductColor}-${newProductCuello}-${newProductTalle}`;

    const existingIndex = fields?.findIndex(
      (field) => field.variantKey === variantKey
    );

    if (existingIndex >= 0) {
      update(existingIndex, {
        ...fields[existingIndex],
        cantidad: fields[existingIndex].cantidad + newProductCantidad,
      });
    } else {
      const stockDisponible = getStockForVariant(
        newProductTipo,
        newProductManga,
        newProductGenero,
        newProductColor,
        newProductCuello,
        newProductTalle
      );

      append({
        variantKey,
        codigo: newProductCodigo,
        producto_tipo: newProductTipo,
        manga: newProductManga,
        genero: newProductGenero,
        color: newProductColor,
        cuello: newProductCuello,
        talle: newProductTalle,
        cantidad: newProductCantidad,
        stockDisponible,
        product_id: null,
        price: 0,
      });
    }

    resetNewProductFields();
  };

  const updateProductQuantity = (index, newQuantity) => {
    if (newQuantity > 0) {
      update(index, {
        ...fields[index],
        cantidad: newQuantity,
      });
    }
  };

  const getProductDescription = (field) => {
    const parts = [];
    if (field.producto_tipo) parts.push(field.producto_tipo);
    if (field.manga) parts.push(`Manga: ${field.manga}`);
    if (field.genero) parts.push(`Género: ${field.genero}`);
    if (field.color) parts.push(`Color: ${field.color}`);
    if (field.cuello) parts.push(`Cuello: ${field.cuello}`);
    if (field.talle) parts.push(`Talle: ${field.talle}`);
    return parts.join(" - ");
  };

  const getStockInfo = (field) => {
    const stockDisponible = field.stockDisponible || 0;
    const cantidad = field.cantidad || 0;
    const enDeposito = Math.max(0, stockDisponible - cantidad);
    
    return {
      hayStock: stockDisponible > 0,
      stockDisponible,
      aRetirar: Math.min(cantidad, stockDisponible),
      enDeposito,
    };
  };

  const parseErrorMessage = (errorMsg) => {
    if (errorMsg.includes("duplicate key value violates unique constraint")) {
      return "El número de pedido ya existe";
    }
    if (errorMsg.includes("violates foreign key constraint")) {
      return "El cliente no existe";
    }
    if (errorMsg.includes("violates check constraint")) {
      return "El tipo de pedido no es válido";
    }
    if (errorMsg.includes("violates not null constraint")) {
      return "Hay campos requeridos sin completar";
    }
    return errorMsg;
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
        order_date: data.order_date || null,
        delivery_date: data.delivery_date || null,
        description: data.description,
        products: fields.map((field) => ({
          product_id: field.product_id || null,
          quantity: field.cantidad,
          price: field.price || 0,
          codigo: field.codigo || null,
          producto_tipo: field.producto_tipo || null,
          manga: field.manga || null,
          genero: field.genero || null,
          color: field.color || null,
          cuello: field.cuello || null,
          talle: field.talle || null,
        })),
        amount: 0,
      };

      let result;
      if (selectedOrder) {
        result = await updateMutation.mutateAsync({ ...body, id: selectedOrder.id });
      } else {
        result = await createMutation.mutateAsync(body);
      }

      if (result.error) {
        const errorMsg = parseErrorMessage(result.error);
        alert(errorMsg);
        setIsLoadingSubmit(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: queryOrdersKey() });
      setIsLoadingSubmit(false);
      setStage("LIST");
    } catch (e) {
      console.error("Error guardando pedido:", e);
      alert("Error al guardar el pedido. Por favor intente nuevamente.");
      setIsLoadingSubmit(false);
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

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const date = new Date(dateString);
    return date.toLocaleDateString("es-AR");
  };

  const onEdit = (orderId) => {
    const order = data.find((order) => order.id === orderId) || null;
    setSelectedOrder(order);
    setFormSubmitted(false);
    setViewOnly(false);

    const formData = {
      order_number: order?.order_number || "",
      order_type: order?.order_type || "",
      order_date: order?.order_date ? order.order_date.split("T")[0] : "",
      delivery_date: order?.delivery_date ? order.delivery_date.split("T")[0] : "",
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

    if (order?.orders_products) {
      formData.products = order.orders_products.map((op) => {
        const stockDisponible = getStockForVariant(
          op.producto_tipo,
          op.manga,
          op.genero,
          op.color,
          op.cuello,
          op.talle
        );
        
        return {
          variantKey: `${op.codigo || ""}-${op.producto_tipo || ""}-${op.manga || ""}-${op.genero || ""}-${op.color || ""}-${op.cuello || ""}-${op.talle || ""}`,
          product_id: op.product_id,
          codigo: op.codigo || "",
          producto_tipo: op.producto_tipo || "",
          manga: op.manga || "",
          genero: op.genero || "",
          color: op.color || "",
          cuello: op.cuello || "",
          talle: op.talle || "",
          cantidad: op.quantity,
          price: op.price || 0,
          stockDisponible,
        };
      });
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
      order_date: order?.order_date ? order.order_date.split("T")[0] : "",
      delivery_date: order?.delivery_date ? order.delivery_date.split("T")[0] : "",
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

    if (order?.orders_products) {
      formData.products = order.orders_products.map((op) => {
        const stockDisponible = getStockForVariant(
          op.producto_tipo,
          op.manga,
          op.genero,
          op.color,
          op.cuello,
          op.talle
        );
        
        return {
          variantKey: `${op.codigo || ""}-${op.producto_tipo || ""}-${op.manga || ""}-${op.genero || ""}-${op.color || ""}-${op.cuello || ""}-${op.talle || ""}`,
          product_id: op.product_id,
          codigo: op.codigo || "",
          producto_tipo: op.producto_tipo || "",
          manga: op.manga || "",
          genero: op.genero || "",
          color: op.color || "",
          cuello: op.cuello || "",
          talle: op.talle || "",
          cantidad: op.quantity,
          price: op.price || 0,
          stockDisponible,
        };
      });
    }

    reset(formData);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedOrder(null);
    setFormSubmitted(false);
    setClient(null);
    resetNewProductFields();
    reset({ 
      products: [],
      order_date: new Date().toISOString().split("T")[0],
      delivery_date: "",
      order_number: "",
      order_type: "",
      description: "",
    });
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedOrder(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    setFormSubmitted(false);
    setClient(null);
    resetNewProductFields();
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
                          Fecha Pedido
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha Entrega
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
                            <React.Fragment key={order.id}>
                              <tr
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
                                  {formatDate(order.order_date)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {formatDate(order.delivery_date)}
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
                                    colSpan={9}
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
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Código
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Producto
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Manga
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Género
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Color
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Cuello
                                                </th>
                                                <th className="text-left p-2 text-slate-600 font-medium text-xs">
                                                  Talle
                                                </th>
                                                <th className="text-center p-2 text-slate-600 font-medium text-xs bg-blue-50">
                                                  Pedido
                                                </th>
                                                <th className="text-center p-2 text-slate-600 font-medium text-xs bg-green-50">
                                                  Entregado
                                                </th>
                                                <th className="text-center p-2 text-slate-600 font-medium text-xs bg-orange-50">
                                                  Pendiente
                                                </th>
                                                <th className="text-center p-2 text-slate-600 font-medium text-xs">
                                                  Stock
                                                </th>
                                              </tr>
                                            </thead>
                                            <tbody>
                                              {order.orders_products.map(
                                                (orderProduct, idx) => {
                                                  const stockDisponible = getStockForVariant(
                                                    orderProduct.producto_tipo,
                                                    orderProduct.manga,
                                                    orderProduct.genero,
                                                    orderProduct.color,
                                                    orderProduct.cuello,
                                                    orderProduct.talle
                                                  );
                                                  const cantidadPedida = orderProduct.quantity || 0;
                                                  const cantidadEntregada = orderProduct.quantity_delivered || 0;
                                                  const cantidadPendiente = Math.max(0, cantidadPedida - cantidadEntregada);
                                                  const estaCompleto = cantidadEntregada >= cantidadPedida;

                                                  return (
                                                    <tr
                                                      key={orderProduct.id || idx}
                                                      className={utils.cn(
                                                        "border-t border-slate-200",
                                                        idx % 2 === 0 && "bg-gray-50",
                                                        estaCompleto && "bg-green-50"
                                                      )}
                                                    >
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.codigo || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs font-medium">
                                                        {orderProduct.producto_tipo || orderProduct.products?.name || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.manga || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.genero || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.color || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.cuello || "-"}
                                                      </td>
                                                      <td className="p-2 text-slate-700 text-xs">
                                                        {orderProduct.talle || "-"}
                                                      </td>
                                                      <td className="p-2 text-center text-blue-700 font-semibold text-xs bg-blue-50">
                                                        {cantidadPedida}
                                                      </td>
                                                      <td className="p-2 text-center text-green-700 font-semibold text-xs bg-green-50">
                                                        {cantidadEntregada}
                                                      </td>
                                                      <td className="p-2 text-center font-semibold text-xs bg-orange-50">
                                                        {cantidadPendiente > 0 ? (
                                                          <span className="text-orange-700">{cantidadPendiente}</span>
                                                        ) : (
                                                          <span className="text-green-600">✓</span>
                                                        )}
                                                      </td>
                                                      <td className="p-2 text-center text-xs">
                                                        <span className={stockDisponible > 0 ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                                          {stockDisponible}
                                                        </span>
                                                      </td>
                                                    </tr>
                                                  );
                                                }
                                              )}
                                            </tbody>
                                          </table>
                                        </div>
                                      ) : (
                                        <div className="text-slate-500 text-center py-4 bg-white rounded border border-slate-200">
                                          No hay productos en este pedido
                                        </div>
                                      )}

                                      {/* Sección de Remitos/Entregas */}
                                      {order.delivery_notes && order.delivery_notes.length > 0 && (
                                        <div className="mt-4">
                                          <h4 className="font-semibold text-slate-700 mb-3">
                                            Entregas Realizadas ({order.delivery_notes.length})
                                          </h4>
                                          <div className="space-y-3">
                                            {order.delivery_notes.map((dn, dnIdx) => (
                                              <div key={dn.id} className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                                <div className="bg-slate-100 px-3 py-2 flex justify-between items-center">
                                                  <span className="text-sm font-medium text-slate-700">
                                                    Remito #{dn.remito_number || dnIdx + 1}
                                                  </span>
                                                  <span className="text-xs text-slate-500">
                                                    {dn.created_at ? new Date(dn.created_at).toLocaleDateString('es-AR') : ''}
                                                  </span>
                                                </div>
                                                {dn.deliverynotes_products && dn.deliverynotes_products.length > 0 && (
                                                  <table className="w-full text-xs">
                                                    <thead className="bg-gray-50">
                                                      <tr>
                                                        <th className="text-left p-2 text-slate-500 font-medium">Producto</th>
                                                        <th className="text-left p-2 text-slate-500 font-medium">Manga</th>
                                                        <th className="text-left p-2 text-slate-500 font-medium">Color</th>
                                                        <th className="text-left p-2 text-slate-500 font-medium">Talle</th>
                                                        <th className="text-center p-2 text-slate-500 font-medium">Cantidad</th>
                                                        <th className="text-left p-2 text-slate-500 font-medium">Origen</th>
                                                      </tr>
                                                    </thead>
                                                    <tbody>
                                                      {dn.deliverynotes_products.map((dnp, dnpIdx) => (
                                                        <tr key={dnp.id || dnpIdx} className="border-t border-slate-100">
                                                          <td className="p-2 text-slate-700">{dnp.producto_tipo || '-'}</td>
                                                          <td className="p-2 text-slate-700">{dnp.manga || '-'}</td>
                                                          <td className="p-2 text-slate-700">{dnp.color || '-'}</td>
                                                          <td className="p-2 text-slate-700">{dnp.talle || '-'}</td>
                                                          <td className="p-2 text-center text-green-700 font-semibold">{dnp.cantidad_por_talle || dnp.quantity || 0}</td>
                                                          <td className="p-2">
                                                            <span className={utils.cn(
                                                              "px-1.5 py-0.5 rounded text-xs",
                                                              dnp.origen === "STOCK" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                                                            )}>
                                                              {dnp.origen || '-'}
                                                            </span>
                                                          </td>
                                                        </tr>
                                                      ))}
                                                    </tbody>
                                                  </table>
                                                )}
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={9}
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
                        {/* Cliente */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Cliente:
                              </label>
                              <div className="flex flex-col gap-2 flex-1">
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
                                      type="button"
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

                        {/* Nro Pedido */}
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

                        {/* Fecha Pedido */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Fecha Pedido:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <span className="text-slate-700">
                                    {formatDate(selectedOrder?.order_date)}
                                  </span>
                                ) : (
                                  <input
                                    type="date"
                                    {...register("order_date")}
                                    className="rounded border border-slate-200 p-3 text-slate-700 w-full md:w-[300px]"
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Fecha Entrega */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Fecha Entrega:
                              </label>
                              <div className="flex flex-col gap-2">
                                {viewOnly ? (
                                  <span className="text-slate-700">
                                    {formatDate(selectedOrder?.delivery_date)}
                                  </span>
                                ) : (
                                  <input
                                    type="date"
                                    {...register("delivery_date")}
                                    className="rounded border border-slate-200 p-3 text-slate-700 w-full md:w-[300px]"
                                  />
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Tipo de Pedido */}
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
                                      {utils.getOrderTypes().map((type) => (
                                        <option key={type} value={type}>
                                          {type}
                                        </option>
                                      ))}
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

                        {/* Productos */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col gap-4">
                              <label className="text-slate-500 font-bold">
                                Productos:
                              </label>
                              
                              {/* Formulario para agregar producto */}
                              {!viewOnly && (
                                <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
                                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                    {/* Código */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Código (opcional)
                                      </label>
                                      <input
                                        type="text"
                                        value={newProductCodigo}
                                        onChange={(e) => setNewProductCodigo(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                        placeholder="Código"
                                      />
                                    </div>

                                    {/* Producto */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Producto *
                                      </label>
                                      <select
                                        value={newProductTipo}
                                        onChange={(e) => setNewProductTipo(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductTypes().map((tipo) => (
                                          <option key={tipo} value={tipo}>
                                            {tipo}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Manga */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Manga
                                      </label>
                                      <select
                                        value={newProductManga}
                                        onChange={(e) => setNewProductManga(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductSleeves().map((manga) => (
                                          <option key={manga} value={manga}>
                                            {manga}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Género */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Género
                                      </label>
                                      <select
                                        value={newProductGenero}
                                        onChange={(e) => setNewProductGenero(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductGenres().map((genero) => (
                                          <option key={genero} value={genero}>
                                            {genero}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Color */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Color
                                      </label>
                                      <select
                                        value={newProductColor}
                                        onChange={(e) => setNewProductColor(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductColors().map((color) => (
                                          <option key={color} value={color}>
                                            {color}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Cuello */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Cuello
                                      </label>
                                      <select
                                        value={newProductCuello}
                                        onChange={(e) => setNewProductCuello(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductNecks().map((cuello) => (
                                          <option key={cuello} value={cuello}>
                                            {cuello}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Talle */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Talle *
                                      </label>
                                      <select
                                        value={newProductTalle}
                                        onChange={(e) => setNewProductTalle(e.target.value)}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700"
                                      >
                                        <option value="">Seleccionar...</option>
                                        {utils.getProductTalles().map((talle) => (
                                          <option key={talle} value={talle}>
                                            {talle}
                                          </option>
                                        ))}
                                      </select>
                                    </div>

                                    {/* Cantidad */}
                                    <div>
                                      <label className="text-slate-600 text-sm font-medium mb-2 block">
                                        Cantidad *
                                      </label>
                                      <input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={newProductCantidad}
                                        onChange={(e) => {
                                          const value = e.target.value.replace(/\D/g, '');
                                          setNewProductCantidad(value ? parseInt(value) : 0);
                                        }}
                                        className="w-full rounded border border-slate-200 p-3 text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        placeholder="Cantidad"
                                      />
                                    </div>
                                  </div>

                                  {/* Stock Preview */}
                                  {newProductTipo && newProductTalle && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                                      <div className="text-sm">
                                        <span className="font-medium">Stock Existente: </span>
                                        {(() => {
                                          const stock = getStockForVariant(
                                            newProductTipo,
                                            newProductManga,
                                            newProductGenero,
                                            newProductColor,
                                            newProductCuello,
                                            newProductTalle
                                          );
                                          const cantidadSolicitada = newProductCantidad || 0;
                                          const aRetirar = Math.min(cantidadSolicitada, stock);
                                          const enDeposito = Math.max(0, stock - cantidadSolicitada);
                                          const faltantes = Math.max(0, cantidadSolicitada - stock);
                                          
                                          if (stock <= 0) {
                                            return (
                                              <span className="text-red-600">
                                                No hay stock disponible
                                                {cantidadSolicitada > 0 && ` (${cantidadSolicitada} faltantes)`}
                                              </span>
                                            );
                                          }
                                          
                                          return (
                                            <>
                                              <span className="text-green-600">
                                                {stock} en stock
                                              </span>
                                              {cantidadSolicitada > 0 && (
                                                <span className="text-slate-600">
                                                  {" - "}{aRetirar} a retirar, {enDeposito} quedan en depósito
                                                </span>
                                              )}
                                              {faltantes > 0 && (
                                                <span className="text-red-600 font-semibold">
                                                  {" - "}{faltantes} FALTANTES
                                                </span>
                                              )}
                                            </>
                                          );
                                        })()}
                                      </div>
                                    </div>
                                  )}

                                  <Button
                                    type="button"
                                    onClick={addProduct}
                                    disabled={!newProductTipo || !newProductTalle}
                                    className="w-full md:w-auto"
                                  >
                                    <Plus className="h-4 w-4 mr-2" />
                                    Agregar Producto
                                  </Button>
                                </div>
                              )}

                              {/* Lista de productos agregados */}
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
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Manga
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Género
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Color
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Cuello
                                          </th>
                                          <th className="text-left p-3 text-slate-600 font-medium">
                                            Talle
                                          </th>
                                          <th className="text-center p-3 text-slate-600 font-medium">
                                            Cantidad
                                          </th>
                                          <th className="text-center p-3 text-slate-600 font-medium">
                                            Stock
                                          </th>
                                          {!viewOnly && (
                                            <th className="text-center p-3 text-slate-600 font-medium">
                                              Acciones
                                            </th>
                                          )}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {fields?.map((field, index) => {
                                          const stockInfo = getStockInfo(field);
                                          return (
                                            <tr key={field.id} className="border-t border-slate-200">
                                              <td className="p-3 text-slate-700 text-sm">
                                                {field.codigo || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.producto_tipo || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.manga || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.genero || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.color || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.cuello || "-"}
                                              </td>
                                              <td className="p-3 text-slate-700">
                                                {field.talle || "-"}
                                              </td>
                                              <td className="p-3 text-center">
                                                {viewOnly ? (
                                                  <span className="text-slate-700">
                                                    {field.cantidad}
                                                  </span>
                                                ) : (
                                                  <input
                                                    type="text"
                                                    inputMode="numeric"
                                                    pattern="[0-9]*"
                                                    value={field.cantidad}
                                                    onChange={(e) => {
                                                      const value = e.target.value.replace(/\D/g, '');
                                                      updateProductQuantity(
                                                        index,
                                                        value ? parseInt(value) : 1
                                                      );
                                                    }}
                                                    className="w-20 rounded border border-slate-200 p-2 text-center text-slate-700 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                                  />
                                                )}
                                              </td>
                                              <td className="p-3 text-center">
                                                <div className="flex flex-col text-xs">
                                                  <span className={stockInfo.hayStock ? "text-green-600 font-medium" : "text-red-600 font-medium"}>
                                                    {stockInfo.hayStock ? "Sí" : "No"}
                                                  </span>
                                                  {stockInfo.hayStock && (
                                                    <span className="text-slate-500">
                                                      {stockInfo.stockDisponible} en stock
                                                    </span>
                                                  )}
                                                </div>
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
                                          );
                                        })}
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

                        {/* Descripción */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col gap-2 md:gap-4 md:items-start">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Descripción:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedOrder?.description || "-"}
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

                        {/* Botones */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-end">
                              {viewOnly ? (
                                <div className="flex gap-4">
                                  <Button
                                    variant="destructive"
                                    type="button"
                                    onClick={() => removeOrder(selectedOrder?.id)}
                                    className="w-full md:w-auto"
                                  >
                                    Eliminar Pedido
                                  </Button>
                                  <Button
                                    variant="alternative"
                                    type="button"
                                    onClick={() => onCancel()}
                                    className="w-full md:w-auto"
                                  >
                                    Volver
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                  <Button
                                    variant="destructive"
                                    type="button"
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
