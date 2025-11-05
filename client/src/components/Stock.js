import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm, Controller, useFieldArray } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { PlusIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
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
import { useProductsQuery } from "../apis/api.products";
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
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      products: Array.from({ length: 5 }, () => ({
        product_id: null,
        quantity: "",
        color: "",
        genre: "",
        sleeve: "",
        neck: "",
      })),
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

  const { data: products, isLoading: isLoadingProducts } = useQuery({
    queryKey: queryProductsKey(),
    queryFn: useProductsQuery,
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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryStockEntriesKey() });
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Ingreso de mercadería creado:", data);
      reset();
      setSupplier(null);
      // Reset to default 5 rows
      reset({
        supplier_id: null,
        remito_number: "",
        entry_date: new Date().toISOString().split("T")[0],
        description: "",
        products: Array.from({ length: 5 }, () => ({
          product_id: null,
          quantity: "",
          color: "",
          genre: "",
          sleeve: "",
          neck: "",
        })),
      });
      setStage("LIST");
      alert("Ingreso de mercadería registrado exitosamente");
    },
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
        "¿Seguro desea eliminar este remito de ingreso? Esto restaurará el stock de los productos."
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

      // Filter out empty product rows
      const validProducts = data.products.filter(
        (product) =>
          product.product_id &&
          product.quantity &&
          product.quantity > 0 &&
          product.color &&
          product.genre &&
          product.sleeve &&
          product.neck
      );

      if (validProducts.length === 0) {
        alert("Debe agregar al menos un producto válido");
        setIsLoadingSubmit(false);
        return;
      }

      if (!data.supplier_id || !data.supplier_id.id) {
        alert("Debe seleccionar un proveedor");
        setIsLoadingSubmit(false);
        return;
      }

      if (!data.remito_number) {
        alert("Debe ingresar el número de remito");
        setIsLoadingSubmit(false);
        return;
      }

      if (!data.entry_date) {
        alert("Debe ingresar la fecha de ingreso");
        setIsLoadingSubmit(false);
        return;
      }

      const body = {
        supplier_id: data.supplier_id.id,
        remito_number: data.remito_number,
        entry_date: data.entry_date,
        description: data.description || "",
        products: validProducts.map((product) => ({
          product_id: product.product_id.id,
          quantity: parseInt(product.quantity),
          color: product.color,
          genre: product.genre,
          sleeve: product.sleeve,
          neck: product.neck,
        })),
      };

      await createMutation.mutateAsync(body);
      setIsLoadingSubmit(false);
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
    }
  };

  const onCreate = () => {
    setSupplier(null);
    reset({
      supplier_id: null,
      remito_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      products: Array.from({ length: 5 }, () => ({
        product_id: null,
        quantity: "",
        color: "",
        genre: "",
        sleeve: "",
        neck: "",
      })),
    });
    setStage("CREATE");
  };

  const onCancel = () => {
    setSupplier(null);
    reset({
      supplier_id: null,
      remito_number: "",
      entry_date: new Date().toISOString().split("T")[0],
      description: "",
      products: Array.from({ length: 5 }, () => ({
        product_id: null,
        quantity: "",
        color: "",
        genre: "",
        sleeve: "",
        neck: "",
      })),
    });
    setStage("LIST");
  };

  const addRow = () => {
    append({
      product_id: null,
      quantity: "",
      color: "",
      genre: "",
      sleeve: "",
      neck: "",
    });
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

  const getSupplierName = (stockEntry) => {
    if (stockEntry.suppliers) {
      return stockEntry.suppliers.fantasy_name || "-";
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

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Ingreso de Mercadería</div>
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
                  Total de remitos {stockEntries.length}
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
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left w-4">
                              #
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Fecha
                            </th>
                            <th className="border-b font-medium text-sm p-4 pt-0 pb-3 text-slate-400 text-left">
                              Proveedor
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
                              <tr
                                key={entry.id}
                                className={utils.cn(
                                  "border-b last:border-b-0 hover:bg-gray-100",
                                  index % 2 === 0 && "bg-gray-50"
                                )}
                              >
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
                                  {getTotalProducts(entry)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {getTotalQuantity(entry)}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                  <div className="flex gap-2">
                                    <button
                                      className="flex items-center justify-center w-8 h-8"
                                      title="Eliminar"
                                      onClick={() =>
                                        removeStockEntry(entry.id)
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
                                colSpan={7}
                                className="border-b border-slate-100 p-4 text-slate-500"
                              >
                                No hay remitos registrados
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
                      {/* Proveedor */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-20 font-bold text-sm">
                          Proveedor:
                        </label>
                        <div className="flex-1">
                          <Controller
                            name="supplier_id"
                            control={control}
                            rules={{ required: true }}
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
                          {errors.supplier_id && (
                            <span className="px-2 text-red-500 text-sm">
                              * Obligatorio
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Fecha de ingreso */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-20 font-bold text-sm">
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

                      {/* Número de remito */}
                      <div className="p-4 gap-4 flex items-center">
                        <label className="text-slate-500 w-20 font-bold text-sm">
                          Nro. de remito:
                        </label>
                        <input
                          type="text"
                          {...register("remito_number", { required: true })}
                          className="rounded border border-slate-200 p-2 text-slate-500 text-sm max-w-xs"
                          placeholder="Ej: 0001-00000001"
                        />
                        {errors.remito_number && (
                          <span className="px-2 text-red-500 text-sm">
                            * Obligatorio
                          </span>
                        )}
                      </div>

                      {/* Descripción */}
                      <div className="p-4 gap-4 flex items-start">
                        <label className="text-slate-500 w-20 font-bold text-sm pt-4">
                          Descripción:
                        </label>
                        <textarea
                          rows={3}
                          cols={50}
                          placeholder="Descripción de la mercadería"
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
                                  Producto
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Color
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Género
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Manga
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Cuello
                                </th>
                                <th className="border border-slate-200 p-2 text-left text-xs text-slate-600">
                                  Cantidad
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
                                    <Controller
                                      name={`products.${index}.product_id`}
                                      control={control}
                                      render={({ field }) => (
                                        <SelectComboBox
                                          options={sortBy(
                                            products || [],
                                            "name"
                                          ).map((product) => ({
                                            id: product.id,
                                            name: product.name,
                                            label: `${product.code} - ${product.name}`,
                                          }))}
                                          value={field.value}
                                          onChange={(option) => {
                                            field.onChange(option);
                                          }}
                                        />
                                      )}
                                    />
                                  </td>
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.color`, {
                                        required: false,
                                      })}
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
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.genre`, {
                                        required: false,
                                      })}
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
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.sleeve`, {
                                        required: false,
                                      })}
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
                                  <td className="border border-slate-200 p-2">
                                    <select
                                      {...register(`products.${index}.neck`, {
                                        required: false,
                                      })}
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
                                  <td className="border border-slate-200 p-2">
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      {...register(`products.${index}.quantity`, {
                                        required: false,
                                        min: 1,
                                      })}
                                      className="w-full rounded border border-slate-200 p-2 text-xs text-slate-500"
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
