import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { ChevronDownIcon, ChevronRightIcon } from "@heroicons/react/24/solid";
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
  const [expandedProducts, setExpandedProducts] = useState({});

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

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search
        ? d.name?.toLowerCase().includes(search.toLowerCase()) ||
          d.code?.toLowerCase().includes(search.toLowerCase())
        : d
    );
  if (error) console.log(error);

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

  const toggleExpand = (productId) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
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
              Total de productos {data.length}
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
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left w-8">
                          
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Codigo
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Producto
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Stock Total
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Variantes
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((product, index) => {
                          const isExpanded = expandedProducts[product.id];
                          const hasVariants =
                            product.stock_variants &&
                            product.stock_variants.length > 0;
                          return (
                            <React.Fragment key={product.id}>
                              <tr
                                className={utils.cn(
                                  "border-b last:border-b-0 hover:bg-gray-100",
                                  index % 2 === 0 && "bg-gray-50"
                                )}
                              >
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {product.id}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {hasVariants && (
                                    <button
                                      onClick={() => toggleExpand(product.id)}
                                      className="flex items-center justify-center w-6 h-6 hover:bg-gray-200 rounded"
                                    >
                                      {isExpanded ? (
                                        <ChevronDownIcon className="h-4 w-4" />
                                      ) : (
                                        <ChevronRightIcon className="h-4 w-4" />
                                      )}
                                    </button>
                                  )}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                  {product.code}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500">
                                  {product.name}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 font-bold">
                                  {product.total_stock_variants || product.stock || 0}
                                </td>
                                <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                                  {hasVariants ? (
                                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs">
                                      {product.stock_variants.length} variante
                                      {product.stock_variants.length !== 1
                                        ? "s"
                                        : ""}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
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
                              {isExpanded && hasVariants && (
                                <tr>
                                  <td colSpan={7} className="p-0">
                                    <div className="bg-gray-50 border-t border-gray-200 p-4">
                                      <div className="mb-3">
                                        <h4 className="font-bold text-slate-700 text-sm mb-2">
                                          Posiciones de Stock - {product.name}
                                        </h4>
                                        <p className="text-xs text-slate-500">
                                          Total de stock:{" "}
                                          <span className="font-bold">
                                            {product.total_stock_variants || 0}
                                          </span>{" "}
                                          unidades en{" "}
                                          <span className="font-bold">
                                            {product.stock_variants.length}
                                          </span>{" "}
                                          variante
                                          {product.stock_variants.length !== 1
                                            ? "s"
                                            : ""}
                                        </p>
                                      </div>
                                      <table className="w-full text-xs border border-gray-200 rounded-lg overflow-hidden">
                                        <thead>
                                          <tr className="bg-gray-100">
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Color
                                            </th>
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Género
                                            </th>
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Manga
                                            </th>
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Cuello
                                            </th>
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Cantidad Total
                                            </th>
                                            <th className="p-3 text-left text-slate-600 font-medium border-b border-gray-200">
                                              Entradas de Stock
                                            </th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {product.stock_variants.map(
                                            (variant, vIndex) => (
                                              <tr
                                                key={vIndex}
                                                className="border-b border-gray-200 hover:bg-gray-100 bg-white"
                                              >
                                                <td className="p-3 text-slate-600">
                                                  {variant.color || "-"}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                  {variant.genre || "-"}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                  {variant.sleeve || "-"}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                  {variant.neck || "-"}
                                                </td>
                                                <td className="p-3 text-slate-600 font-bold text-base">
                                                  {variant.total_quantity}
                                                </td>
                                                <td className="p-3 text-slate-600">
                                                  <div className="flex flex-col gap-2 max-h-48 overflow-y-auto">
                                                    {variant.entries?.length > 0 ? (
                                                      variant.entries.map(
                                                        (entry, eIndex) => (
                                                          <div
                                                            key={eIndex}
                                                            className="text-xs bg-white p-2 rounded border border-gray-200"
                                                          >
                                                            <div className="font-medium">
                                                              Remito:{" "}
                                                              {entry.remito_number ||
                                                                "-"}
                                                            </div>
                                                            <div className="text-slate-500">
                                                              Fecha:{" "}
                                                              {entry.entry_date
                                                                ? new Date(
                                                                    entry.entry_date
                                                                  ).toLocaleDateString(
                                                                    "es-AR"
                                                                  )
                                                                : "-"}
                                                            </div>
                                                            <div className="font-bold text-blue-600">
                                                              Cantidad:{" "}
                                                              {entry.quantity}
                                                            </div>
                                                          </div>
                                                        )
                                                      )
                                                    ) : (
                                                      <span className="text-slate-400 text-xs">
                                                        Sin entradas
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            )
                                          )}
                                        </tbody>
                                      </table>
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
                            colSpan={7}
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
