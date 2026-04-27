import { useNavigate } from "react-router-dom";
import React, { useState, useMemo } from "react";
import { Plus, Pencil } from "lucide-react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { ArrowLeftIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { TrashIcon, CloseIcon, EyeIcon } from "./icons";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import Spinner from "./common/Spinner";
import { Input } from "./common/Input";
import SelectComboBox from "./common/SelectComboBox";
import { sortBy } from "lodash";

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  useCreateStockEntryMutation,
  useStockEntriesQuery,
  useDeleteStockEntryMutation,
  useUpdateStockEntryMutation,
} from "../apis/api.stock";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { useDeliveryNotesQuery } from "../apis/api.deliverynotes";
import { useOrdersQuery } from "../apis/api.orders";
import {
  queryStockEntriesKey,
  querySuppliersKey,
  queryProductsKey,
  queryDeliveryNotesKey,
  queryOrdersKey,
} from "../apis/queryKeys";

const HISTORICAL_PRESETS_MAX = 30;

function normalizeRenglonDigits(value) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

function buildStockProductSuggestionKey(v) {
  const renglon = normalizeRenglonDigits(v.renglon);
  return `${renglon}-${v.codigo || ""}-${v.producto_tipo || ""}-${v.manga || ""}-${v.genero || ""}-${v.color || ""}-${v.cuello || ""}-${v.fuerza || ""}`;
}

function buildStockLineMergeKey(p) {
  return buildStockProductSuggestionKey(p) + "|" + (p.talle || "");
}

function formatStockProductSuggestionLabel(p) {
  const parts = [];
  const r = normalizeRenglonDigits(p.renglon);
  if (r) parts.push(`Renglón ${r}`);
  if (p.codigo) parts.push(p.codigo);
  if (p.fuerza) parts.push(p.fuerza);
  if (p.producto_tipo) parts.push(p.producto_tipo);
  if (p.manga) parts.push(p.manga);
  if (p.genero) parts.push(p.genero);
  if (p.color) parts.push(p.color);
  if (p.cuello) parts.push(p.cuello);
  return parts.length ? parts.join(" · ") : "Producto";
}

function emptyEditStockLine() {
  return {
    renglon: "",
    codigo: "",
    fuerza: "",
    producto_tipo: "",
    manga: "",
    genero: "",
    color: "",
    cuello: "",
    talle: "",
    quantity: "",
    product_id: null,
  };
}

export default function Stock({}) {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [isConfeccionPropia, setIsConfeccionPropia] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const [quickAddSelection, setQuickAddSelection] = useState(null);
  const [quickAddTalle, setQuickAddTalle] = useState("");
  const [quickAddQuantity, setQuickAddQuantity] = useState(1);
  const [showProductSuggestions, setShowProductSuggestions] = useState(true);
  const [selectedStockEntry, setSelectedStockEntry] = useState(null);
  const [editTarget, setEditTarget] = useState(null);

  const [editForm, setEditForm] = useState({
    remito_number: "",
    entry_date: "",
    description: "",
    isConfeccion: false,
    supplier: null,
    products: [],
  });
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const defaultProductRow = {
    renglon: "",
    codigo: "",
    fuerza: "",
    producto_tipo: "",
    manga: "",
    genero: "",
    color: "",
    cuello: "",
    talle: "",
    quantity: "",
  };

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    trigger,
    watch,
    formState: { errors },
  } = useForm({
    defaultValues: {
      supplier_id: null,
      remito_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      products: Array.from({ length: 5 }, () => ({ ...defaultProductRow })),
    },
  });

  const { fields, append, remove, update } = useFieldArray({
    control,
    name: "products",
  });

  const { data: stockEntries, isLoading, error } = useQuery({
    queryKey: queryStockEntriesKey(),
    queryFn: useStockEntriesQuery,
  });

  const { data: suppliers, isLoading: isLoadingSuppliers } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const { data: deliveryNotes } = useQuery({
    queryKey: queryDeliveryNotesKey(),
    queryFn: useDeliveryNotesQuery,
  });

  const { data: ordersData } = useQuery({
    queryKey: queryOrdersKey(),
    queryFn: useOrdersQuery,
  });

  const historicalProductSuggestions = useMemo(() => {
    if (!ordersData || !Array.isArray(ordersData)) return [];
    const map = new Map();
    for (const order of ordersData) {
      if (!order.orders_products?.length) continue;
      for (const op of order.orders_products) {
        const row = {
          renglon: normalizeRenglonDigits(op.renglon || ""),
          codigo: op.codigo || "",
          producto_tipo: op.producto_tipo || "",
          manga: op.manga || "",
          genero: op.genero || "",
          color: op.color || "",
          cuello: op.cuello || "",
          fuerza: op.fuerza || "",
          product_id: op.product_id ?? null,
          price: op.price ?? 0,
        };
        const suggestionKey = buildStockProductSuggestionKey(row);
        const prev = map.get(suggestionKey);
        if (prev) {
          prev.count += 1;
          if (prev.product_id == null && row.product_id != null) {
            prev.product_id = row.product_id;
          }
        } else {
          map.set(suggestionKey, {
            suggestionKey,
            count: 1,
            ...row,
          });
        }
      }
    }
    return Array.from(map.values())
      .filter((p) => p.producto_tipo)
      .sort((a, b) => {
        const ca = (a.codigo || "").trim().toLocaleLowerCase();
        const cb = (b.codigo || "").trim().toLocaleLowerCase();
        if (ca !== cb) {
          return ca.localeCompare(cb, "es", { numeric: true, sensitivity: "base" });
        }
        return (a.suggestionKey || "").localeCompare(b.suggestionKey || "", "es", {
          numeric: true,
          sensitivity: "base",
        });
      })
      .slice(0, HISTORICAL_PRESETS_MAX);
  }, [ordersData]);

  // Calcular resumen de stock actual
  const getStockSummary = () => {
    const stockMap = {};

    // Sumar entradas de stock
    if (stockEntries && Array.isArray(stockEntries)) {
      stockEntries.forEach((entry) => {
        if (entry.stock_entries_products) {
          entry.stock_entries_products.forEach((sep) => {
            const productoTipo = sep.producto_tipo || sep.products?.name || "SIN TIPO";
            const key = productoTipo.toUpperCase();
            if (!stockMap[key]) {
              stockMap[key] = { entradas: 0, salidas: 0 };
            }
            stockMap[key].entradas += sep.quantity || 0;
          });
        }
      });
    }

    // Restar salidas (delivery notes)
    if (deliveryNotes && Array.isArray(deliveryNotes)) {
      deliveryNotes.forEach((dn) => {
        if (dn.deliverynotes_products) {
          dn.deliverynotes_products.forEach((dnp) => {
            const productoTipo = dnp.producto_tipo || "SIN TIPO";
            const key = productoTipo.toUpperCase();
            if (!stockMap[key]) {
              stockMap[key] = { entradas: 0, salidas: 0 };
            }
            stockMap[key].salidas += dnp.cantidad_por_talle || dnp.quantity || 0;
          });
        }
      });
    }

    // Convertir a array con stock actual
    return Object.entries(stockMap).map(([producto, { entradas, salidas }]) => ({
      producto,
      entradas,
      salidas,
      actual: Math.max(0, entradas - salidas),
    })).sort((a, b) => a.producto.localeCompare(b.producto));
  };

  const stockSummary = getStockSummary();
  const totalStock = stockSummary.reduce((acc, item) => acc + item.actual, 0);

  const dataFiltered =
    stockEntries &&
    stockEntries?.length > 0 &&
    stockEntries?.filter((entry) =>
      search
        ? entry.remito_number?.toLowerCase().includes(search.toLowerCase()) ||
          entry.suppliers?.fantasy_name
            ?.toLowerCase()
            .includes(search.toLowerCase()) ||
          entry.description?.toLowerCase().includes(search.toLowerCase())
        : entry
    );

  const createMutation = useMutation({
    mutationFn: useCreateStockEntryMutation,
    onError: (error) => {
      console.error("Error creando ingreso de mercadería:", error);
      alert(error.message || "Error al registrar el ingreso de mercadería");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteStockEntryMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryStockEntriesKey() });
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Remito eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando remito:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateStockEntryMutation,
    onSuccess: (data) => {
      if (data?.error) {
        alert(data.error);
        return;
      }
      queryClient.invalidateQueries({ queryKey: queryStockEntriesKey() });
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      if (data && !data.error && data.id) {
        setSelectedStockEntry((prev) =>
          prev && prev.id === data.id
            ? {
                ...prev,
                ...data,
                suppliers: data.suppliers ?? prev.suppliers,
                stock_entries_products: data.stock_entries_products ?? prev.stock_entries_products,
              }
            : prev
        );
      }
      setEditTarget(null);
    },
    onError: (error) => {
      console.error("Error al actualizar ingreso:", error);
      alert(error.message || "Error al actualizar el ingreso");
    },
  });

  const openView = (entry) => {
    setSelectedStockEntry(entry);
    setStage("VIEW");
  };

  const openEditDialog = (entry) => {
    setEditTarget(entry);
    const lines =
      entry.stock_entries_products && entry.stock_entries_products.length > 0
        ? entry.stock_entries_products.map((p) => ({
            renglon: normalizeRenglonDigits(p.renglon || ""),
            codigo: p.codigo || "",
            fuerza: p.fuerza || "",
            producto_tipo: p.producto_tipo || "",
            manga: p.sleeve || "",
            genero: p.genre || "",
            color: p.color || "",
            cuello: p.neck || "",
            talle: p.talle || "",
            quantity: String(p.quantity ?? ""),
            product_id: p.product_id ?? null,
          }))
        : [emptyEditStockLine()];
    setEditForm({
      remito_number: entry.remito_number || "",
      entry_date: entry.entry_date ? String(entry.entry_date).split("T")[0] : "",
      description: entry.description || "",
      isConfeccion: !entry.supplier_id,
      supplier:
        entry.supplier_id && entry.suppliers
          ? {
              id: entry.supplier_id,
              name: entry.suppliers.fantasy_name,
              label: entry.suppliers.fantasy_name,
            }
          : null,
      products: lines,
    });
  };

  const setEditLine = (index, field, value) => {
    setEditForm((f) => {
      const next = [...(f.products || [])];
      next[index] = { ...next[index], [field]: value };
      return { ...f, products: next };
    });
  };

  const addEditProductLine = () => {
    setEditForm((f) => ({
      ...f,
      products: [...(f.products || []), emptyEditStockLine()],
    }));
  };

  const removeEditProductLine = (index) => {
    setEditForm((f) => {
      const next = (f.products || []).filter((_, i) => i !== index);
      return { ...f, products: next.length ? next : [emptyEditStockLine()] };
    });
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editForm.isConfeccion && !editForm.supplier?.id) {
      alert("Seleccioná un proveedor o marcá Confección propia");
      return;
    }
    if (!editForm.entry_date) {
      alert("Indicá la fecha de ingreso");
      return;
    }
    const validProducts = (editForm.products || []).filter(
      (p) =>
        p.producto_tipo &&
        p.quantity &&
        parseInt(String(p.quantity).replace(/\D/g, ""), 10) > 0 &&
        p.fuerza &&
        p.talle
    );
    if (validProducts.length === 0) {
      alert("Debe quedar al menos un producto válido con Fuerza, producto, talle y cantidad");
      return;
    }
    await updateMutation.mutateAsync({
      id: editTarget.id,
      supplier_id: editForm.isConfeccion ? null : editForm.supplier.id,
      remito_number: editForm.remito_number.trim() || null,
      entry_date: editForm.entry_date,
      description: editForm.description.trim() || null,
      products: validProducts.map((p) => ({
        product_id: p.product_id || null,
        quantity: parseInt(String(p.quantity).replace(/\D/g, ""), 10),
        fuerza: p.fuerza,
        producto_tipo: p.producto_tipo,
        color: p.color || null,
        genre: p.genero || null,
        sleeve: p.manga || null,
        neck: p.cuello || null,
        talle: p.talle,
        renglon: normalizeRenglonDigits(p.renglon) || null,
        codigo: (p.codigo && String(p.codigo).trim()) || null,
      })),
    });
  };

  const removeStockEntry = async (stockEntryId) => {
    if (
      window.confirm(
        "¿Seguro desea eliminar este ingreso? Esto restaurará el stock de los productos."
      )
    ) {
      try {
        await deleteMutation.mutate(stockEntryId);
        if (selectedStockEntry?.id === stockEntryId) setSelectedStockEntry(null);
        if (editTarget?.id === stockEntryId) setEditTarget(null);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);

      const validProducts = data.products.filter(
        (product) =>
          product.producto_tipo &&
          product.quantity &&
          parseInt(product.quantity) > 0 &&
          product.fuerza &&
          product.talle
      );

      if (validProducts.length === 0) {
        alert("Debe agregar al menos un producto válido con Fuerza, Producto, Talle y Cantidad");
        setIsLoadingSubmit(false);
        return;
      }

      if (!isConfeccionPropia && (!data.supplier_id || !data.supplier_id.id)) {
        alert("Debe seleccionar un proveedor o marcar Confección Propia");
        setIsLoadingSubmit(false);
        return;
      }

      if (!data.entry_date) {
        alert("Debe ingresar la fecha de ingreso");
        setIsLoadingSubmit(false);
        return;
      }

      const body = {
        supplier_id: isConfeccionPropia ? null : data.supplier_id.id,
        remito_number: data.remito_number || null,
        entry_date: data.entry_date,
        description: isConfeccionPropia ? "Confección Propia" + (data.description ? " - " + data.description : "") : (data.description || ""),
        is_confeccion_propia: isConfeccionPropia,
        products: validProducts.map((product) => ({
          product_id: null,
          quantity: parseInt(product.quantity, 10),
          fuerza: product.fuerza,
          producto_tipo: product.producto_tipo,
          color: product.color || null,
          genre: product.genero || null,
          sleeve: product.manga || null,
          neck: product.cuello || null,
          talle: product.talle,
          renglon: normalizeRenglonDigits(product.renglon) || null,
          codigo: (product.codigo && String(product.codigo).trim()) || null,
        })),
      };

      const result = await createMutation.mutateAsync(body);
      
      if (result.error) {
        alert(result.error);
        setIsLoadingSubmit(false);
        return;
      }

      queryClient.invalidateQueries({ queryKey: queryStockEntriesKey() });
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      setQuickAddSelection(null);
      setQuickAddTalle("");
      setQuickAddQuantity(1);

      reset({
        supplier_id: null,
        remito_number: "",
        entry_date: new Date().toISOString().split("T")[0],
        description: "",
        products: Array.from({ length: 5 }, () => ({ ...defaultProductRow })),
      });
      setSupplier(null);
      setIsConfeccionPropia(false);
      setIsLoadingSubmit(false);
      setStage("LIST");
      alert("Ingreso de mercadería registrado exitosamente");
    } catch (e) {
      console.log(e);
      alert("Error al guardar el ingreso de mercadería");
      setIsLoadingSubmit(false);
    }
  };

  const onCreate = () => {
    setSupplier(null);
    setIsConfeccionPropia(false);
    setQuickAddSelection(null);
    setQuickAddTalle("");
    setQuickAddQuantity(1);
    reset({
      supplier_id: null,
      remito_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      products: Array.from({ length: 5 }, () => ({ ...defaultProductRow })),
    });
    setStage("CREATE");
  };

  const onCancel = () => {
    setSupplier(null);
    setIsConfeccionPropia(false);
    setQuickAddSelection(null);
    setQuickAddTalle("");
    setQuickAddQuantity(1);
    reset({
      supplier_id: null,
      remito_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      products: Array.from({ length: 5 }, () => ({ ...defaultProductRow })),
    });
    setStage("LIST");
  };

  const addRow = () => {
    append({ ...defaultProductRow });
  };

  const addQuickPresetToStock = () => {
    if (!quickAddSelection) return;
    if (!quickAddTalle) {
      alert("Seleccioná el talle");
      return;
    }
    if (!quickAddQuantity || quickAddQuantity <= 0) {
      alert("Indicá una cantidad válida");
      return;
    }
    const renglonNorm = normalizeRenglonDigits(quickAddSelection.renglon || "");
    const newLine = {
      ...defaultProductRow,
      renglon: renglonNorm,
      codigo: quickAddSelection.codigo || "",
      producto_tipo: quickAddSelection.producto_tipo,
      manga: quickAddSelection.manga || "",
      genero: quickAddSelection.genero || "",
      color: quickAddSelection.color || "",
      cuello: quickAddSelection.cuello || "",
      talle: quickAddTalle,
      fuerza: quickAddSelection.fuerza || "",
      quantity: String(quickAddQuantity),
    };
    const mergeKey = buildStockLineMergeKey(newLine);
    const current = watch("products");
    const existingIndex = current.findIndex((row) => buildStockLineMergeKey(row) === mergeKey);
    if (existingIndex >= 0) {
      const prevQ = parseInt(String(current[existingIndex].quantity).replace(/\D/g, ""), 10) || 0;
      update(existingIndex, {
        ...current[existingIndex],
        quantity: String(prevQ + quickAddQuantity),
      });
    } else {
      append(newLine);
    }
    setQuickAddSelection(null);
    setQuickAddTalle("");
    setQuickAddQuantity(1);
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setSelectedStockEntry(null);
      setStage("LIST");
    }
  };

  const renderIngresoDetalleContent = (entry) => (
    <>
      {entry.stock_entries_products?.length > 0 ? (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-100">
              <tr>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Renglón</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Código</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Fuerza</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Producto</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Manga</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Género</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Color</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Cuello</th>
                <th className="text-left p-2 text-slate-600 font-medium text-xs">Talle</th>
                <th className="text-center p-2 text-slate-600 font-medium text-xs">Cantidad</th>
              </tr>
            </thead>
            <tbody>
              {entry.stock_entries_products.map((product, idx) => (
                <tr key={product.id || idx} className="border-t border-slate-200 hover:bg-slate-50">
                  <td className="p-2 text-slate-700 text-xs">{product.renglon || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs">{product.codigo || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs">{product.fuerza || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs font-medium">
                    {product.producto_tipo || product.products?.name || "-"}
                  </td>
                  <td className="p-2 text-slate-700 text-xs">{product.sleeve || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs">{product.genre || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs">
                    {product.color ? (
                      <span className="inline-flex items-center gap-1">
                        <span
                          className="w-3 h-3 rounded-full border border-slate-300"
                          style={{
                            backgroundColor:
                              product.color === "BLANCO"
                                ? "#ffffff"
                                : product.color === "NEGRO"
                                  ? "#1a1a1a"
                                  : product.color === "GRIS"
                                    ? "#6b7280"
                                    : product.color === "CELESTE"
                                      ? "#7dd3fc"
                                      : product.color === "ARENA"
                                        ? "#d4a574"
                                        : "#e5e7eb",
                          }}
                        />
                        {product.color}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="p-2 text-slate-700 text-xs">{product.neck || product.cuello || "-"}</td>
                  <td className="p-2 text-slate-700 text-xs">{product.talle || "-"}</td>
                  <td className="p-2 text-center text-slate-700 text-xs font-semibold">
                    {product.quantity || 0}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-slate-500 text-center py-4 bg-white rounded border border-slate-200">
          No hay productos en este ingreso
        </div>
      )}
      {entry.description && (
        <div className="mt-3 text-xs text-slate-600">
          <span className="font-medium">Descripción:</span> {entry.description}
        </div>
      )}
    </>
  );

  const getSupplierName = (stockEntry) => {
    if (stockEntry.description?.includes("Confección Propia")) {
      return "Confección Propia";
    }
    if (stockEntry.suppliers) {
      return stockEntry.suppliers.fantasy_name || "-";
    }
    if (!stockEntry.supplier_id) {
      return "Confección Propia";
    }
    return "-";
  };

  const getTotalProducts = (stockEntry) => {
    if (stockEntry.stock_entries_products) {
      return stockEntry.stock_entries_products.length;
    }
    return 0;
  };

  const getTotalQuantity = (stockEntry) => {
    if (stockEntry.stock_entries_products) {
      return stockEntry.stock_entries_products.reduce(
        (sum, product) => sum + (product.quantity || 0),
        0
      );
    }
    return 0;
  };

  const handleConfeccionPropiaChange = (checked) => {
    setIsConfeccionPropia(checked);
    if (checked) {
      setValue("supplier_id", null);
      setSupplier(null);
    }
  };

  const toggleRowExpansion = (id) => {
    setExpandedRows((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const getProductsSummary = (stockEntry) => {
    if (!stockEntry.stock_entries_products || stockEntry.stock_entries_products.length === 0) {
      return "-";
    }
    const productTypes = [...new Set(
      stockEntry.stock_entries_products
        .map((p) => p.producto_tipo || p.products?.name)
        .filter(Boolean)
    )];
    if (productTypes.length === 0) return "-";
    if (productTypes.length <= 2) return productTypes.join(", ");
    return `${productTypes.slice(0, 2).join(", ")} (+${productTypes.length - 2})`;
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
            <div>Stock</div>
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
                placeholder="Buscador..."
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            {isLoading && (
              <div>
                <Spinner />
              </div>
            )}
            {error && <div className="text-red-500">{/* ERROR... */}</div>}
            {stage === "LIST" && stockEntries && (
              <div className="my-4 mb-28">
                {/* Resumen de Stock Actual */}
                <div className="mb-5 bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">
                      Stock Actual
                    </span>
                    <span className="text-sm text-slate-500">
                      Total: <span className="font-semibold">{totalStock}</span> uds.
                    </span>
                  </div>
                  <div className="px-4 py-3">
                    {stockSummary.length > 0 ? (
                      <div className="flex flex-wrap gap-x-6 gap-y-2">
                        {stockSummary.map((item) => (
                          <div
                            key={item.producto}
                            className="flex items-center gap-2 text-sm"
                          >
                            <span className="text-slate-500">{item.producto}:</span>
                            <span className="font-semibold text-slate-700">{item.actual}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-400 text-sm text-center py-2">
                        Sin stock
                      </p>
                    )}
                  </div>
                </div>

                <p className="pl-1 pb-1 text-slate-500">
                  Total de ingresos {stockEntries.length}
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
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left w-8">
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left w-4">
                              #
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Fecha
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Origen
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Nro. Remito
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Productos
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Cant.
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Total
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
                                    "border-b last:border-b-0 hover:bg-gray-100 cursor-pointer",
                                    index % 2 === 0 && "bg-gray-50"
                                  )}
                                  onClick={() => toggleRowExpansion(entry.id)}
                                >
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <button
                                      className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        toggleRowExpansion(entry.id);
                                      }}
                                    >
                                      {expandedRows[entry.id] ? (
                                        <ChevronDownIcon className="h-4 w-4" />
                                      ) : (
                                        <ChevronRightIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {entry.id}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {new Date(entry.entry_date).toLocaleDateString(
                                      "es-AR"
                                    )}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {getSupplierName(entry)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {entry.remito_number || "-"}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="font-medium">{getProductsSummary(entry)}</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {getTotalProducts(entry)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 font-semibold">
                                    {getTotalQuantity(entry)}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 text-slate-500 min-w-[7rem]">
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Ver detalle"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openView(entry);
                                        }}
                                      >
                                        <EyeIcon />
                                      </button>
                                      <button
                                        type="button"
                                        className="flex items-center justify-center w-8 h-8 text-slate-600 hover:text-slate-900"
                                        title="Editar"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          openEditDialog(entry);
                                        }}
                                      >
                                        <Pencil className="h-4 w-4" strokeWidth={2} />
                                      </button>
                                      <button
                                        type="button"
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Eliminar"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeStockEntry(entry.id);
                                        }}
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                                {expandedRows[entry.id] && (
                                  <tr>
                                    <td colSpan={9} className="bg-gray-50 border-b border-slate-200">
                                      <div className="p-4">
                                        <h4 className="font-semibold text-slate-700 mb-3 text-sm">
                                          Detalle de Productos
                                        </h4>
                                        {renderIngresoDetalleContent(entry)}
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </React.Fragment>
                            ))
                          ) : (
                            <tr>
                              <td
                                colSpan={9}
                                className="border-b border-slate-100 p-4 text-slate-500"
                              >
                                No hay ingresos registrados
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

        {stage === "VIEW" && selectedStockEntry && (
          <div className="my-4 mb-28">
            <div className="bg-white rounded-lg p-6 shadow border border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h3 className="text-lg font-bold text-slate-800">Ingreso #{selectedStockEntry.id}</h3>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="alternative"
                    size="sm"
                    onClick={() => openEditDialog(selectedStockEntry)}
                  >
                    <Pencil className="h-4 w-4 mr-1.5" strokeWidth={2} />
                    Editar
                  </Button>
                  <Button
                    type="button"
                    variant="outlined"
                    size="sm"
                    onClick={() => {
                      setSelectedStockEntry(null);
                      setStage("LIST");
                    }}
                  >
                    Volver al listado
                  </Button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6 text-sm">
                <div>
                  <span className="text-slate-500 font-medium">Fecha: </span>
                  <span className="text-slate-800">
                    {new Date(selectedStockEntry.entry_date).toLocaleDateString("es-AR")}
                  </span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Origen: </span>
                  <span className="text-slate-800">{getSupplierName(selectedStockEntry)}</span>
                </div>
                <div>
                  <span className="text-slate-500 font-medium">Nro. remito: </span>
                  <span className="text-slate-800">{selectedStockEntry.remito_number || "—"}</span>
                </div>
              </div>
              <h4 className="font-semibold text-slate-700 mb-3">Productos</h4>
              {renderIngresoDetalleContent(selectedStockEntry)}
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
                      {/* Confección Propia */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-32 font-bold text-sm">
                          Confección Propia:
                        </label>
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={isConfeccionPropia}
                            onChange={(e) => handleConfeccionPropiaChange(e.target.checked)}
                            className="w-5 h-5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          />
                          <span className="ml-2 text-sm text-slate-600">
                            {isConfeccionPropia ? "Sí (no requiere proveedor)" : "No"}
                          </span>
                        </div>
                      </div>

                      {/* Proveedor - solo si no es confección propia */}
                      {!isConfeccionPropia && (
                        <div className="p-4 gap-4 flex items-center">
                          <label className="text-slate-500 w-32 font-bold text-sm">
                            Proveedor:
                          </label>
                          <div className="flex-1">
                            <Controller
                              name="supplier_id"
                              control={control}
                              rules={{ required: !isConfeccionPropia }}
                              render={({ field }) => (
                                <SelectComboBox
                                  options={sortBy(suppliers || [], "fantasy_name").map(
                                    (supplier) => ({
                                      id: supplier.id,
                                      name: supplier.fantasy_name,
                                      label: supplier.fantasy_name,
                                    })
                                  )}
                                  value={field.value}
                                  onChange={(option) => {
                                    field.onChange(option);
                                    setValue("supplier_id", option);
                                    setSupplier(option);
                                    trigger("supplier_id");
                                  }}
                                />
                              )}
                            />
                            {errors.supplier_id && !isConfeccionPropia && (
                              <span className="px-2 text-red-500 text-sm">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Fecha de ingreso */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-32 font-bold text-sm">
                          Fecha de ingreso:
                        </label>
                        <input
                          type="date"
                          {...register("entry_date", { required: true })}
                          className="rounded border border-slate-200 p-2 text-slate-500 text-sm max-w-xs"
                        />
                        {errors.entry_date && (
                          <span className="px-2 text-red-500 text-sm">
                            * Obligatorio
                          </span>
                        )}
                      </div>

                      {/* Número de remito (opcional) */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-32 font-bold text-sm">
                          Nro. de remito:
                        </label>
                        <input
                          type="text"
                          {...register("remito_number")}
                          className="rounded border border-slate-200 p-2 text-slate-500 text-sm max-w-xs"
                          placeholder="Opcional"
                        />
                        <span className="text-xs text-slate-400">(opcional)</span>
                      </div>

                      {/* Descripción */}
                      <div className="p-4 gap-4 flex items-start">
                        <label className="text-slate-500 w-32 font-bold text-sm pt-4">
                          Descripción:
                        </label>
                        <textarea
                          rows={3}
                          cols={50}
                          placeholder="Descripción de la mercadería (opcional)"
                          autoComplete="off"
                          autoCorrect="off"
                          spellCheck="false"
                          autoCapitalize="off"
                          {...register("description")}
                          className="rounded border border-slate-200 p-2 text-slate-500 text-sm"
                        />
                      </div>

                      {historicalProductSuggestions.length > 0 && (
                        <div className="p-4">
                          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 p-4">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                              <p className="text-sm font-semibold text-slate-800">
                                Productos frecuentes
                              </p>
                              <button
                                type="button"
                                onClick={() => setShowProductSuggestions((v) => !v)}
                                className="shrink-0 text-xs font-medium text-indigo-700 underline decoration-indigo-300 hover:text-indigo-900 sm:text-sm"
                              >
                                {showProductSuggestions
                                  ? "Ocultar sugerencias"
                                  : "Mostrar sugerencias"}
                              </button>
                            </div>
                            {showProductSuggestions && (
                              <>
                                <p className="mt-1 text-xs text-slate-600">
                                  Combinaciones que ya aparecieron en pedidos (incluye renglón, fuerza y código si
                                  existían). Elegí una, luego talle y cantidad.
                                </p>
                                <div className="mt-3 flex flex-wrap gap-2">
                                  {historicalProductSuggestions.map((preset) => {
                                    const isSelected =
                                      quickAddSelection?.suggestionKey === preset.suggestionKey;
                                    return (
                                      <button
                                        key={preset.suggestionKey}
                                        type="button"
                                        onClick={() => {
                                          setQuickAddSelection(preset);
                                          setQuickAddTalle("");
                                          setQuickAddQuantity(1);
                                        }}
                                        className={`inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-left text-xs transition-colors ${
                                          isSelected
                                            ? "border-indigo-600 bg-indigo-100 text-indigo-900"
                                            : "border-slate-200 bg-white text-slate-700 hover:border-indigo-300 hover:bg-white"
                                        }`}
                                        title={formatStockProductSuggestionLabel(preset)}
                                      >
                                        <span className="truncate">
                                          {formatStockProductSuggestionLabel(preset)}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                {quickAddSelection && (
                                  <div className="mt-4 flex flex-col gap-3 rounded-md border border-indigo-200 bg-white p-3">
                                    <div className="min-w-0">
                                      <p className="text-xs font-medium text-slate-500">Producto</p>
                                      <p className="mt-1 text-sm font-medium text-slate-800">
                                        {formatStockProductSuggestionLabel(quickAddSelection)}
                                      </p>
                                    </div>
                                    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                                      <div>
                                        <label
                                          htmlFor="stock-quick-add-talle"
                                          className="mb-1 block text-xs font-medium text-slate-600"
                                        >
                                          Talle *
                                        </label>
                                        <select
                                          id="stock-quick-add-talle"
                                          value={quickAddTalle}
                                          onChange={(e) => setQuickAddTalle(e.target.value)}
                                          className="w-full min-w-[140px] rounded border border-slate-200 p-2 text-slate-700 sm:w-auto"
                                        >
                                          <option value="">Seleccionar...</option>
                                          {utils.getProductTalles().map((talle) => (
                                            <option key={talle} value={talle}>
                                              {talle}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                      <div>
                                        <label
                                          htmlFor="stock-quick-add-cantidad"
                                          className="mb-1 block text-xs font-medium text-slate-600"
                                        >
                                          Cantidad *
                                        </label>
                                        <input
                                          id="stock-quick-add-cantidad"
                                          type="text"
                                          inputMode="numeric"
                                          pattern="[0-9]*"
                                          value={quickAddQuantity}
                                          onChange={(e) => {
                                            const value = e.target.value.replace(/\D/g, "");
                                            setQuickAddQuantity(value ? parseInt(value, 10) : 0);
                                          }}
                                          className="w-full rounded border border-slate-200 p-2 text-center text-slate-700 [appearance:textfield] sm:w-24 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                          aria-label="Cantidad"
                                        />
                                      </div>
                                      <div className="flex flex-wrap items-center gap-2 pt-1 sm:pt-0">
                                        <Button
                                          type="button"
                                          onClick={addQuickPresetToStock}
                                          disabled={
                                            !quickAddTalle ||
                                            !quickAddQuantity ||
                                            quickAddQuantity <= 0
                                          }
                                        >
                                          <Plus className="mr-2 h-4 w-4" />
                                          Agregar
                                        </Button>
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setQuickAddSelection(null);
                                            setQuickAddTalle("");
                                            setQuickAddQuantity(1);
                                          }}
                                          className="text-sm text-slate-600 underline hover:text-slate-900"
                                        >
                                          Cancelar
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        </div>
                      )}

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
                            <PlusIcon className="h-5 w-5" />
                            Agregar fila
                          </button>
                        </div>

                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse">
                            <thead>
                              <tr className="bg-gray-100">
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Renglón
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Fuerza *
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Producto *
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Manga
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Género
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Color
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Cuello
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Talle *
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Cantidad *
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600 w-20">
                                  Acción
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {fields.map((field, index) => (
                                <tr key={field.id}>
                                  <td className="border border-slate-200 p-2">
                                    <input type="hidden" {...register(`products.${index}.codigo`)} />
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      maxLength={5}
                                      className="w-full min-w-[3.25rem] max-w-[4.5rem] rounded border border-slate-200 p-1.5 text-xs text-slate-500"
                                      title="Hasta 5 dígitos (opcional)"
                                      placeholder="—"
                                      {...register(`products.${index}.renglon`, {
                                        setValueAs: (v) => normalizeRenglonDigits(v ?? ""),
                                      })}
                                    />
                                  </td>
                                  {/* Fuerza */}
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.fuerza`)}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                    >
                                      <option value="">Seleccionar</option>
                                      {utils.getProductFuerzas().map((fuerza) => (
                                        <option key={fuerza} value={fuerza}>
                                          {fuerza}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Producto */}
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.producto_tipo`)}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                    >
                                      <option value="">Seleccionar</option>
                                      {utils.getProductTypes().map((tipo) => (
                                        <option key={tipo} value={tipo}>
                                          {tipo}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Manga - solo para CAMISA */}
                                  <td className="border border-slate-200 p-2">
                                    {watch(`products.${index}.producto_tipo`) === "CAMISA" ? (
                                      <select
                                        {...register(`products.${index}.manga`)}
                                        className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                      >
                                        <option value="">Seleccionar</option>
                                        {utils.getProductSleeves().map((sleeve) => (
                                          <option key={sleeve} value={sleeve}>
                                            {sleeve}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs text-slate-400 p-2">N/A</span>
                                    )}
                                  </td>
                                  {/* Género */}
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.genero`)}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                    >
                                      <option value="">Seleccionar</option>
                                      {utils.getProductGenres().map((genre) => (
                                        <option key={genre} value={genre}>
                                          {genre}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Color */}
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.color`)}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                    >
                                      <option value="">Seleccionar</option>
                                      {utils.getProductColors().map((color) => (
                                        <option key={color} value={color}>
                                          {color}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Cuello - solo para CAMISA */}
                                  <td className="border border-slate-200 p-2">
                                    {watch(`products.${index}.producto_tipo`) === "CAMISA" ? (
                                      <select
                                        {...register(`products.${index}.cuello`)}
                                        className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                      >
                                        <option value="">Seleccionar</option>
                                        {utils.getProductNecks().map((neck) => (
                                          <option key={neck} value={neck}>
                                            {neck}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span className="text-xs text-slate-400 p-2">N/A</span>
                                    )}
                                  </td>
                                  {/* Talle */}
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.talle`)}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
                                    >
                                      <option value="">Seleccionar</option>
                                      {utils.getProductTalles().map((talle) => (
                                        <option key={talle} value={talle}>
                                          {talle}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  {/* Cantidad */}
                                  <td className="border border-slate-200 p-2">
                                    <input
                                      type="text"
                                      inputMode="numeric"
                                      pattern="[0-9]*"
                                      {...register(`products.${index}.quantity`)}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, '');
                                        e.target.value = value;
                                      }}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                      placeholder="0"
                                    />
                                  </td>
                                  <td className="border border-slate-200 p-2 text-center">
                                    {fields.length > 1 && (
                                      <button
                                        type="button"
                                        onClick={() => remove(index)}
                                        className="text-red-500 hover:text-red-700 font-bold text-lg"
                                      >
                                        ×
                                      </button>
                                    )}
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

      <Dialog open={Boolean(editTarget)} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="w-[95vw] max-w-6xl p-4 sm:p-6 flex flex-col gap-4 max-h-[92vh] overflow-y-auto">
          <DialogTitle className="text-lg font-semibold text-slate-800 pr-6">
            Editar ingreso de stock
            {editTarget ? ` #${editTarget.id}` : ""}
          </DialogTitle>
          <form onSubmit={submitEdit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="flex items-center gap-2 sm:col-span-2">
                <input
                  id="edit-stock-confeccion"
                  type="checkbox"
                  checked={editForm.isConfeccion}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setEditForm((f) => ({
                      ...f,
                      isConfeccion: checked,
                      supplier: checked ? null : f.supplier,
                    }));
                  }}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600"
                />
                <label htmlFor="edit-stock-confeccion" className="text-sm text-slate-700">
                  Confección propia (sin proveedor)
                </label>
              </div>
              {!editForm.isConfeccion && (
                <div className="sm:col-span-2">
                  <label className="text-xs font-medium text-slate-600 block mb-1">Proveedor *</label>
                  <SelectComboBox
                    options={sortBy(suppliers || [], "fantasy_name").map((s) => ({
                      id: s.id,
                      name: s.fantasy_name,
                      label: s.fantasy_name,
                    }))}
                    value={editForm.supplier}
                    onChange={(opt) => setEditForm((f) => ({ ...f, supplier: opt || null }))}
                    placeholder="Buscar proveedor…"
                  />
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Fecha de ingreso *</label>
                <input
                  type="date"
                  required
                  className="w-full rounded border border-slate-200 p-2 text-sm text-slate-700"
                  value={editForm.entry_date}
                  onChange={(e) => setEditForm((f) => ({ ...f, entry_date: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-slate-600 block mb-1">Nro. de remito</label>
                <input
                  type="text"
                  className="w-full rounded border border-slate-200 p-2 text-sm text-slate-700"
                  value={editForm.remito_number}
                  onChange={(e) => setEditForm((f) => ({ ...f, remito_number: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-slate-600 block mb-1">Descripción</label>
                <textarea
                  rows={2}
                  className="w-full rounded border border-slate-200 p-2 text-sm text-slate-700"
                  value={editForm.description}
                  onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Opcional"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-sm font-bold text-slate-700">Productos *</span>
                <button
                  type="button"
                  onClick={addEditProductLine}
                  className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  <Plus className="h-4 w-4" />
                  Agregar fila
                </button>
              </div>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full border-collapse min-w-[880px]">
                  <thead>
                    <tr className="bg-slate-100 text-left text-xs text-slate-600">
                      <th className="border-b border-slate-200 p-2 font-medium">Renglón</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Fuerza *</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Producto *</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Manga</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Género</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Color</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Cuello</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Talle *</th>
                      <th className="border-b border-slate-200 p-2 font-medium">Cant. *</th>
                      <th className="border-b border-slate-200 p-2 font-medium w-12" />
                    </tr>
                  </thead>
                  <tbody>
                    {(editForm.products || []).map((line, index) => (
                      <tr key={`edit-line-${index}`}>
                        <td className="border-b border-slate-100 p-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            className="w-14 min-w-0 rounded border border-slate-200 p-1.5 text-xs"
                            value={line.renglon}
                            onChange={(e) =>
                              setEditLine(index, "renglon", normalizeRenglonDigits(e.target.value))
                            }
                            title="Hasta 5 dígitos"
                            placeholder="—"
                          />
                          <input
                            type="text"
                            className="mt-1 w-full max-w-[6rem] rounded border border-slate-100 p-1 text-xs text-slate-500"
                            value={line.codigo || ""}
                            onChange={(e) => setEditLine(index, "codigo", e.target.value)}
                            placeholder="Código"
                          />
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <select
                            className="w-full min-w-[6rem] rounded border border-slate-200 p-1.5 text-xs"
                            value={line.fuerza}
                            onChange={(e) => setEditLine(index, "fuerza", e.target.value)}
                          >
                            <option value="">—</option>
                            {utils.getProductFuerzas().map((f) => (
                              <option key={f} value={f}>
                                {f}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <select
                            className="w-full min-w-[5rem] rounded border border-slate-200 p-1.5 text-xs"
                            value={line.producto_tipo}
                            onChange={(e) => setEditLine(index, "producto_tipo", e.target.value)}
                          >
                            <option value="">—</option>
                            {utils.getProductTypes().map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          {line.producto_tipo === "CAMISA" ? (
                            <select
                              className="w-full rounded border border-slate-200 p-1.5 text-xs"
                              value={line.manga}
                              onChange={(e) => setEditLine(index, "manga", e.target.value)}
                            >
                              <option value="">—</option>
                              {utils.getProductSleeves().map((s) => (
                                <option key={s} value={s}>
                                  {s}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400 px-1">N/A</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <select
                            className="w-full rounded border border-slate-200 p-1.5 text-xs"
                            value={line.genero}
                            onChange={(e) => setEditLine(index, "genero", e.target.value)}
                          >
                            <option value="">—</option>
                            {utils.getProductGenres().map((g) => (
                              <option key={g} value={g}>
                                {g}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <select
                            className="w-full min-w-[5.5rem] rounded border border-slate-200 p-1.5 text-xs"
                            value={line.color}
                            onChange={(e) => setEditLine(index, "color", e.target.value)}
                          >
                            <option value="">—</option>
                            {utils.getProductColors().map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          {line.producto_tipo === "CAMISA" ? (
                            <select
                              className="w-full min-w-[5.5rem] rounded border border-slate-200 p-1.5 text-xs"
                              value={line.cuello}
                              onChange={(e) => setEditLine(index, "cuello", e.target.value)}
                            >
                              <option value="">—</option>
                              {utils.getProductNecks().map((n) => (
                                <option key={n} value={n}>
                                  {n}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-xs text-slate-400 px-1">N/A</span>
                          )}
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <select
                            className="w-full min-w-[3.5rem] rounded border border-slate-200 p-1.5 text-xs"
                            value={line.talle}
                            onChange={(e) => setEditLine(index, "talle", e.target.value)}
                          >
                            <option value="">—</option>
                            {utils.getProductTalles().map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-slate-100 p-1.5">
                          <input
                            type="text"
                            inputMode="numeric"
                            className="w-16 rounded border border-slate-200 p-1.5 text-xs text-center"
                            value={line.quantity}
                            onChange={(e) => {
                              const v = e.target.value.replace(/\D/g, "");
                              setEditLine(index, "quantity", v);
                            }}
                          />
                        </td>
                        <td className="border-b border-slate-100 p-1 text-center">
                          {(editForm.products || []).length > 1 && (
                            <button
                              type="button"
                              className="text-red-500 hover:text-red-700 text-lg font-bold"
                              onClick={() => removeEditProductLine(index)}
                              title="Quitar fila"
                            >
                              ×
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Podés modificar o agregar líneas. Los cambios reemplazan todo el detalle de productos del
                ingreso.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <Button
                type="submit"
                variant="default"
                className="min-w-[7rem]"
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending ? "Guardando…" : "Guardar"}
              </Button>
              <Button
                type="button"
                variant="outlined"
                onClick={() => setEditTarget(null)}
                disabled={updateMutation.isPending}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
