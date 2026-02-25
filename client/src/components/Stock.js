import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { ArrowLeftIcon, PlusIcon, ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
import { TrashIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import { Input } from "./common/Input";
import SelectComboBox from "./common/SelectComboBox";
import { sortBy } from "lodash";

import { useQueryClient, useMutation, useQuery } from "@tanstack/react-query";
import {
  useCreateStockEntryMutation,
  useStockEntriesQuery,
  useDeleteStockEntryMutation,
} from "../apis/api.stock";
import { useSuppliersQuery } from "../apis/api.suppliers";
import {
  queryStockEntriesKey,
  querySuppliersKey,
  queryProductsKey,
} from "../apis/queryKeys";

export default function Stock({}) {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [supplier, setSupplier] = useState(null);
  const [isConfeccionPropia, setIsConfeccionPropia] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const defaultProductRow = {
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

  const { fields, append, remove } = useFieldArray({
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

  const removeStockEntry = async (stockEntryId) => {
    if (
      window.confirm(
        "¿Seguro desea eliminar este ingreso? Esto restaurará el stock de los productos."
      )
    ) {
      try {
        await deleteMutation.mutate(stockEntryId);
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
          quantity: parseInt(product.quantity),
          fuerza: product.fuerza,
          producto_tipo: product.producto_tipo,
          color: product.color || null,
          genre: product.genero || null,
          sleeve: product.manga || null,
          neck: product.cuello || null,
          talle: product.talle,
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

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

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
                                  <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                    <div className="flex gap-2">
                                      <button
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
                                        {entry.stock_entries_products?.length > 0 ? (
                                          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
                                            <table className="w-full text-sm">
                                              <thead className="bg-slate-100">
                                                <tr>
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
                                                    <td className="p-2 text-slate-700 text-xs">{product.fuerza || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs font-medium">{product.producto_tipo || product.products?.name || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.sleeve || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.genre || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">
                                                      {product.color ? (
                                                        <span className="inline-flex items-center gap-1">
                                                          <span 
                                                            className="w-3 h-3 rounded-full border border-slate-300"
                                                            style={{ 
                                                              backgroundColor: 
                                                                product.color === "BLANCO" ? "#ffffff" :
                                                                product.color === "NEGRO" ? "#1a1a1a" :
                                                                product.color === "GRIS" ? "#6b7280" :
                                                                product.color === "CELESTE" ? "#7dd3fc" :
                                                                product.color === "ARENA" ? "#d4a574" :
                                                                "#e5e7eb"
                                                            }}
                                                          />
                                                          {product.color}
                                                        </span>
                                                      ) : "-"}
                                                    </td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.neck || product.cuello || "-"}</td>
                                                    <td className="p-2 text-slate-700 text-xs">{product.talle || "-"}</td>
                                                    <td className="p-2 text-center text-slate-700 text-xs font-semibold">{product.quantity || 0}</td>
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
                                  {/* Manga */}
                                  <td className="border border-slate-200 p-2">
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
                                  {/* Cuello */}
                                  <td className="border border-slate-200 p-2">
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
    </>
  );
}
