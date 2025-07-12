import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
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
  const [viewOnly, setViewOnly] = useState(false);

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
        ? d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.last_name.toLowerCase().includes(search.toLowerCase())
        : d
    );
  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreateProductMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Producto creado:", data);
    },
    onError: (error) => {
      console.error("Error creando producto:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateProductMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryProductsKey() });
      console.log("Producto creado:", data);
    },
    onError: (error) => {
      console.error("Error creando producto:", error);
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
    }
  };

  const onEdit = (user_id) => {
    reset();
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedProduct(user);
    setStage("CREATE");
  };

  const onView = (user_id) => {
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedProduct(user);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedProduct(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedProduct(null);
    setViewOnly(false);
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
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left w-4">
                          #
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Producto
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Talle
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Color
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Stock
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Precio
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((product, index) => (
                          <tr
                            key={product.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {product.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {product.name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {product.size}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {product.color}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {product.stock}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {product.price}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(product.id)}
                                >
                                  <EyeIcon />
                                </button>
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
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={7}
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
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Nombre:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedProduct?.name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedProduct?.name || ""}
                                  {...register("name", { required: true })}
                                  className="rounded border border-slate-200  p-4  text-slate-500 "
                                />
                              )}
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
                                Precio:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedProduct?.price}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedProduct?.price || ""}
                                  {...register("price", { required: true })}
                                  className="rounded border border-slate-200  p-4  text-slate-500 "
                                />
                              )}
                              {errors.price && (
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
                                Stock:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedProduct?.stock}
                                </label>
                              ) : (
                                <input
                                  type="number"
                                  id="stock"
                                  name="stock"
                                  defaultValue={selectedProduct?.stock || ""}
                                  {...register("stock", {
                                    required: true,
                                  })}
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                />
                              )}
                              {errors.stock?.type === "required" && (
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
                                Talle:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedProduct?.size}
                                </label>
                              ) : (
                                <select
                                  defaultValue={selectedProduct?.size || ""}
                                  {...register("size", { required: true })}
                                  className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
                                >
                                  <option value="">Seleccionar Talle</option>
                                  <option value="XS">XS</option>
                                  <option value="S">S</option>
                                  <option value="L">L</option>
                                  <option value="M">M</option>
                                  <option value="XL">XL</option>
                                  <option value="2XL">2XL</option>
                                  <option value="3XL">3XL</option>
                                  <option value="OTROS">OTROS</option>
                                  {/* Agregá tus opciones acá */}
                                </select>
                              )}
                              {errors.size && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Color:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedProduct?.color}
                                </label>
                              ) : (
                                <select
                                  defaultValue={selectedProduct?.color || ""}
                                  {...register("color", {
                                    required: true,
                                  })}
                                  className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
                                >
                                  <option value="">Seleccionar Color</option>
                                  {/* Agregá tus opciones acá */}
                                  <option value="MARRON">MARRON</option>
                                  <option value="BEIGE">BEIGE</option>
                                  <option value="VERDE">VERDE</option>
                                  <option value="CELESTE">CELESTE</option>
                                  <option value="BLANCO">BLANCO</option>
                                </select>
                              )}
                              {errors.service && (
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
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedProduct?.description}
                                </label>
                              ) : (
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
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                />
                              )}
                              {errors.description?.type === "required" && (
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
                            <div className="p-4 gap-4 flex items-center justify-end">
                              {viewOnly ? (
                                <div>
                                  <Button
                                    variant="destructive"
                                    onClick={() => onCancel()}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
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
