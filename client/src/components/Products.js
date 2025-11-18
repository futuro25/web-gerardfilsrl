import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useProductsQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,
} from "../apis/api.products";
import { queryProductsKey } from "../apis/queryKeys";

export default function Products() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [filters, setFilters] = useState({
    color: "",
    genre: "",
    sleeve: "",
    neck: "",
    fuerza: "",
    talle: "",
  });

  const [selectedProduct, setSelectedProduct] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: queryProductsKey(),
    queryFn: useProductsQuery,
  });

  // Check if any filters are active
  const hasActiveFilters = Object.values(filters).some((value) => value !== "");

  // Helper function to normalize strings for comparison
  const normalizeString = (str) => {
    if (!str) return "";
    return String(str).trim().toLowerCase();
  };

  // Helper function to check if a variant matches the filters
  const variantMatchesFilters = (variant) => {
    const matchesColor = !filters.color || normalizeString(variant.color) === normalizeString(filters.color);
    const matchesGenre = !filters.genre || normalizeString(variant.genre) === normalizeString(filters.genre);
    const matchesSleeve = !filters.sleeve || normalizeString(variant.sleeve) === normalizeString(filters.sleeve);
    const matchesNeck = !filters.neck || normalizeString(variant.neck) === normalizeString(filters.neck);
    const matchesFuerza = !filters.fuerza || normalizeString(variant.fuerza) === normalizeString(filters.fuerza);
    const matchesTalle = !filters.talle || normalizeString(variant.talle) === normalizeString(filters.talle);

    return (
      matchesColor &&
      matchesGenre &&
      matchesSleeve &&
      matchesNeck &&
      matchesFuerza &&
      matchesTalle
    );
  };

  // Helper function to check if a variant matches the search
  const variantMatchesSearch = (variant, searchLower) => {
    if (!searchLower) return true;
    return (
      variant.color?.toLowerCase().includes(searchLower) ||
      variant.genre?.toLowerCase().includes(searchLower) ||
      variant.sleeve?.toLowerCase().includes(searchLower) ||
      variant.neck?.toLowerCase().includes(searchLower) ||
      variant.fuerza?.toLowerCase().includes(searchLower) ||
      variant.talle?.toLowerCase().includes(searchLower)
    );
  };

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.map((d) => {
      // Filter by search - includes name, code, and all variant fields
      const searchLower = search ? search.toLowerCase().trim() : "";
      const matchesSearch = !search
        ? true
        : d.name?.toLowerCase().includes(searchLower) ||
          d.code?.toLowerCase().includes(searchLower) ||
          (d.stock_variants &&
            d.stock_variants.some((variant) => variantMatchesSearch(variant, searchLower)));

      // Filter by variants
      const hasVariants =
        d.stock_variants && d.stock_variants.length > 0;

      if (hasVariants) {
        // Filter variants that match both search and filters
        const filteredVariants = d.stock_variants.filter((variant) => {
          const matchesFilters = variantMatchesFilters(variant);
          const matchesSearchInVariant = variantMatchesSearch(variant, searchLower);
          return matchesFilters && matchesSearchInVariant;
        });

        // Only include product if it has matching variants
        if (filteredVariants.length > 0) {
          return {
            ...d,
            stock_variants: filteredVariants,
          };
        }
        return null;
      } else {
        // Products without variants
        // If filters are active, don't show products without variants
        if (hasActiveFilters) {
          return null;
        }
        // Only filter by search if no filters are active
        if (matchesSearch) {
          return d;
        }
        return null;
      }
    }).filter(Boolean); // Remove null entries
  if (error) console.log(error);

  const handleFilterChange = (filterName, value) => {
    setFilters((prev) => ({
      ...prev,
      [filterName]: value,
    }));
  };

  const clearFilters = () => {
    setFilters({
      color: "",
      genre: "",
      sleeve: "",
      neck: "",
      fuerza: "",
      talle: "",
    });
  };

  // Calculate total variants count for filtered data
  const getFilteredVariantsCount = () => {
    if (!dataFiltered || dataFiltered.length === 0) return 0;
    let count = 0;
    dataFiltered.forEach((product) => {
      if (product.stock_variants && product.stock_variants.length > 0) {
        count += product.stock_variants.length;
      } else {
        count += 1;
      }
    });
    return count;
  };

  const createMutation = useMutation({
    mutationFn: useCreateProductMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Producto creado:", data);
      setStage("LIST");
    },
    onError: (error) => {
      console.error("Error creando producto:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateProductMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Producto actualizado:", data);
      setStage("LIST");
    },
    onError: (error) => {
      console.error("Error actualizando producto:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteProductMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Producto eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando producto:", error);
    },
  });

  const removeUser = async (productId) => {
    if (window.confirm("Seguro desea eliminar este Producto?")) {
      try {
        await deleteMutation.mutate(productId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);
      let body = data;

      body = {
        ...data,
      };

      if (selectedProduct) {
        updateMutation.mutate({ ...body, id: selectedProduct.id });
      } else {
        createMutation.mutate(body);
      }
      setIsLoadingSubmit(false);
      setStage("LIST");
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
    }
  };

  const onEdit = (user_id) => {
    reset();
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedProduct(user);
    setStage("CREATE");
  };


  const onCreate = () => {
    setSelectedProduct(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedProduct(null);
    setIsLoadingSubmit(false);
    reset();
    setStage("LIST");
  };

  const fantasyNameValidation = (username) => {
    return data.length
      ? !data.find((user) => user.username === username)
      : true;
  };

  const emailValidation = (email) => {
    if (selectedProduct && selectedProduct.email === email) {
      return true; // If the email is the same as the selected user, allow it
    }
    // Check if the email already exists in the data
    if (!email) return false; // If email is empty, return false

    return data.length ? !data.find((user) => user.email === email) : true;
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
            <div>Productos</div>
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
            {/* Filtros de variantes */}
            <div className="w-full mb-4 bg-white rounded-lg shadow-sm border border-slate-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-slate-700">
                  Filtros por Variantes
                </h3>
                {hasActiveFilters && (
                  <button
                    onClick={clearFilters}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                  >
                    Limpiar filtros
                  </button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {/* Filtro Color */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Color
                  </label>
                  <select
                    value={filters.color}
                    onChange={(e) => handleFilterChange("color", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductColors().map((color) => (
                      <option key={color} value={color}>
                        {color}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filtro Género */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Género
                  </label>
                  <select
                    value={filters.genre}
                    onChange={(e) => handleFilterChange("genre", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductGenres().map((genre) => (
                      <option key={genre} value={genre}>
                        {genre}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filtro Manga */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Manga
                  </label>
                  <select
                    value={filters.sleeve}
                    onChange={(e) => handleFilterChange("sleeve", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductSleeves().map((sleeve) => (
                      <option key={sleeve} value={sleeve}>
                        {sleeve}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filtro Cuello */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cuello
                  </label>
                  <select
                    value={filters.neck}
                    onChange={(e) => handleFilterChange("neck", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductNecks().map((neck) => (
                      <option key={neck} value={neck}>
                        {neck}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filtro Fuerza */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Fuerza
                  </label>
                  <select
                    value={filters.fuerza}
                    onChange={(e) => handleFilterChange("fuerza", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductFuerzas().map((fuerza) => (
                      <option key={fuerza} value={fuerza}>
                        {fuerza}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Filtro Talle */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Talle
                  </label>
                  <select
                    value={filters.talle}
                    onChange={(e) => handleFilterChange("talle", e.target.value)}
                    className="w-full rounded border border-slate-200 p-2 text-xs text-slate-700 bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Todos</option>
                    {utils.getProductTalles().map((talle) => (
                      <option key={talle} value={talle}>
                        {talle}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </>
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
              {hasActiveFilters || search
                ? `Mostrando ${getFilteredVariantsCount()} variante${
                    getFilteredVariantsCount() !== 1 ? "s" : ""
                  } de ${data.length} producto${data.length !== 1 ? "s" : ""}`
                : `Total de productos ${data.length}`}
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
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Codigo
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Producto
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Color
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Género
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Manga
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Cuello
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fuerza
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Talle
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Cantidad Total
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        (() => {
                          let rowIndex = 0;
                          return dataFiltered.flatMap((product) => {
                            const hasVariants =
                              product.stock_variants &&
                              product.stock_variants.length > 0;

                            if (hasVariants) {
                              // stock_variants are already filtered at this point
                              return product.stock_variants.map(
                                (variant, vIndex) => {
                                  const currentIndex = rowIndex++;
                                  return (
                                    <tr
                                      key={`${product.id}-${vIndex}`}
                                      className={utils.cn(
                                        "border-b last:border-b-0 hover:bg-gray-100",
                                        currentIndex % 2 === 0 && "bg-gray-50"
                                      )}
                                    >
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {product.id}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                        {product.code}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                        {product.name}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.color || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.genre || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.sleeve || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.neck || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.fuerza || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                        {variant.talle || "-"}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 font-bold">
                                        {variant.total_quantity || 0}
                                      </td>
                                      <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                        <div className="flex gap-2">
                                          <button
                                            className="flex items-center justify-center w-8 h-8"
                                            title="Editar"
                                            onClick={() => onEdit(product.id)}
                                          >
                                            <EditIcon />
                                          </button>
                                          <button
                                            className="flex items-center justify-center w-8 h-8"
                                            title="Eliminar"
                                            onClick={() =>
                                              removeUser(product.id)
                                            }
                                          >
                                            <TrashIcon />
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  );
                                }
                              );
                            } else {
                              const currentIndex = rowIndex++;
                              return (
                                <tr
                                  key={product.id}
                                  className={utils.cn(
                                    "border-b last:border-b-0 hover:bg-gray-100",
                                    currentIndex % 2 === 0 && "bg-gray-50"
                                  )}
                                >
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    {product.id}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                    {product.code}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                    {product.name}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                    <span className="text-slate-400">-</span>
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 font-bold">
                                    {product.stock || 0}
                                  </td>
                                  <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                    <div className="flex gap-2">
                                      <button
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Editar"
                                        onClick={() => onEdit(product.id)}
                                      >
                                        <EditIcon />
                                      </button>
                                      <button
                                        className="flex items-center justify-center w-8 h-8"
                                        title="Eliminar"
                                        onClick={() => removeUser(product.id)}
                                      >
                                        <TrashIcon />
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            }
                          });
                        })()
                      ) : (
                        <tr>
                          <td
                            colSpan={11}
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
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Codigo:
                              </label>
                              <input
                                type="text"
                                defaultValue={selectedProduct?.code || ""}
                                {...register("code", { required: true })}
                                className="rounded border border-slate-200 p-4 text-slate-500"
                              />
                              {errors.code && (
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
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Nombre:
                              </label>
                              <input
                                type="text"
                                defaultValue={selectedProduct?.name || ""}
                                {...register("name", { required: true })}
                                className="rounded border border-slate-200 p-4 text-slate-500"
                              />
                              {errors.name && (
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
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Descripcion:
                              </label>
                              <textarea
                                rows={3}
                                cols={50}
                                placeholder="Descripcion del producto"
                                autoComplete="off"
                                autoCorrect="off"
                                spellCheck="false"
                                autoCapitalize="off"
                                id="description"
                                name="description"
                                defaultValue={
                                  selectedProduct?.description || ""
                                }
                                {...register("description", {})}
                                className="rounded border border-slate-200 p-4 text-slate-500"
                              />
                              {errors.description?.type === "required" && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Información de Stock - Solo lectura */}
                        {selectedProduct?.stock_variants &&
                          selectedProduct.stock_variants.length > 0 && (
                            <tr>
                              <td>
                                <div className="p-4">
                                  <label className="text-slate-500 font-bold mb-4 block">
                                    Información de Stock (solo lectura):
                                  </label>
                                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                    <p className="text-sm text-slate-700 mb-2">
                                      <span className="font-bold">
                                        Stock Total:{" "}
                                        {selectedProduct.total_stock_variants ||
                                          0}
                                      </span>{" "}
                                      unidades distribuidas en{" "}
                                      <span className="font-bold">
                                        {selectedProduct.stock_variants.length}
                                      </span>{" "}
                                      variante
                                      {selectedProduct.stock_variants.length !==
                                      1
                                        ? "s"
                                        : ""}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      El stock se gestiona a través del módulo
                                      de Ingreso de Mercadería. Las variantes
                                      (color, género, manga, cuello) se
                                      especifican al ingresar productos al
                                      stock.
                                    </p>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center justify-end">
                              <div className="gap-4 flex">
                                <Button
                                  variant="destructive"
                                  onClick={() => onCancel()}
                                >
                                  Cancelar
                                </Button>
                                <Button
                                  type="submit"
                                  disabled={isLoadingSubmit}
                                >
                                  {isLoadingSubmit
                                    ? "Guardando..."
                                    : "Guardar"}
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
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl "></div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
