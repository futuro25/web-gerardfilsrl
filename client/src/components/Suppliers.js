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
  useSuppliersQuery,
  useCreateSupplierMutation,
  useUpdateSupplierMutation,
  useDeleteSupplierMutation,
} from "../apis/api.suppliers";
import { querySuppliersKey } from "../apis/queryKeys";
import config from "../config";

var moment = require("moment");

export default function Suppliers() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search
        ? d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.last_name.toLowerCase().includes(search.toLowerCase()) ||
          d.username.toLowerCase().includes(search.toLowerCase())
        : d
    );
  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreateSupplierMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: querySuppliersKey() });
      console.log("Proveedor creado:", data);
    },
    onError: (error) => {
      console.error("Error creando proveedor:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateSupplierMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: querySuppliersKey() });
      console.log("Proveedor creado:", data);
    },
    onError: (error) => {
      console.error("Error creando proveedor:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteSupplierMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: querySuppliersKey() });
      console.log("Proveedor eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando proveedor:", error);
    },
  });

  const removeUser = async (supplierId) => {
    if (window.confirm("Seguro desea eliminar este Proveedor?")) {
      try {
        await deleteMutation.mutate(supplierId);
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

      if (selectedSupplier) {
        updateMutation.mutate({ ...body, id: selectedSupplier.id });
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
    setSelectedSupplier(user);
    setStage("CREATE");
  };

  const onView = (user_id) => {
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedSupplier(user);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedSupplier(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedSupplier(null);
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
    if (selectedSupplier && selectedSupplier.email === email) {
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
            <div>Proveedores</div>
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
              Total de proveedores {data.length}
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
                          Proveedor
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Nombre
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Apellido
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((supplier, index) => (
                          <tr
                            key={supplier.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {supplier.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {supplier.fantasy_name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {supplier.name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {supplier.last_name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(supplier.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(supplier.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removeUser(supplier.id)}
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
                            colSpan={4}
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
                                  {selectedSupplier?.name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedSupplier?.name || ""}
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
                                Apellido:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedSupplier?.last_name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={
                                    selectedSupplier?.last_name || ""
                                  }
                                  {...register("last_name", { required: true })}
                                  className="rounded border border-slate-200  p-4  text-slate-500 "
                                />
                              )}
                              {errors.last_name && (
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
                                Fantasia:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedSupplier?.fantasy_name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  id="fantasy_name"
                                  name="fantasy_name"
                                  defaultValue={
                                    selectedSupplier?.fantasy_name || ""
                                  }
                                  {...register("fantasy_name", {
                                    required: true,
                                    validate: fantasyNameValidation,
                                  })}
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                />
                              )}
                              {errors.fantasy_name?.type === "required" && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                              {errors.fantasy_name?.type === "validate" && (
                                <span className="px-2 text-red-500">
                                  * Proveedor existente
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
                                Email:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedSupplier?.email}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  id="email"
                                  name="email"
                                  defaultValue={selectedSupplier?.email || ""}
                                  {...register("email", {
                                    required: true,
                                    validate: emailValidation,
                                  })}
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                />
                              )}
                              {errors.email?.type === "required" && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                              {errors.email?.type === "validate" && (
                                <span className="px-2 text-red-500">
                                  * Email existente
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
                                Telefono:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedSupplier?.phone}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedSupplier?.phone || ""}
                                  {...register("phone", { required: true })}
                                  className="rounded border border-slate-200  p-4  text-slate-500 "
                                />
                              )}
                              {errors.phone && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* ================ */}
                        {/* Service */}
                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Servicio:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedSupplier?.service}
                                </label>
                              ) : (
                                <select
                                  defaultValue={selectedSupplier?.service || ""}
                                  {...register("service", { required: true })}
                                  className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
                                >
                                  <option value="">Seleccionar</option>
                                  {/* Agregá tus opciones acá */}
                                  <option value="BIENES">BIENES</option>
                                  <option value="SERVICIOS">SERVICIOS</option>
                                  <option value="MANTENIMIENTO">
                                    MANTENIMIENTO
                                  </option>
                                  <option value="PROFESIONALES">
                                    PROFESIONALES
                                  </option>
                                  <option value="LOGISTICA">LOGISTICA</option>
                                  <option value="OTROS">OTROS</option>
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

                        {/* Industry */}
                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Industria:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedSupplier?.industry}
                                </label>
                              ) : (
                                <select
                                  defaultValue={
                                    selectedSupplier?.industry || ""
                                  }
                                  {...register("industry", { required: true })}
                                  className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
                                >
                                  <option value="">Seleccionar</option>
                                  <option value="TECNOLOGÍA">TECNOLOGÍA</option>
                                  <option value="ALIMENTACION">
                                    ALIMENTACION
                                  </option>
                                  <option value="LIMPIEZA">LIMPIEZA</option>
                                  <option value="TRANSPORTE">TRANSPORTE</option>
                                  <option value="CONSTRUCCIÓN">
                                    CONSTRUCCIÓN
                                  </option>
                                  <option value="TEXTIL">TEXTIL</option>
                                  <option value="OTROS">OTROS</option>
                                  {/* Agregá tus opciones acá */}
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

                        {/* Tax Regime */}
                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Régimen:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedSupplier?.tax_regime}
                                </label>
                              ) : (
                                <select
                                  defaultValue={
                                    selectedSupplier?.tax_regime || ""
                                  }
                                  {...register("tax_regime", {
                                    required: true,
                                  })}
                                  className="rounded border text-xs border-slate-200 p-4 text-slate-500 w-[180px]"
                                >
                                  <option value="">Seleccionar</option>
                                  {/* Agregá tus opciones acá */}
                                  <option value="RESPONSABLE INSCRIPTO">
                                    RESPONSABLE INSCRIPTO
                                  </option>
                                  <option value="MONOTRIBUTISTA">
                                    MONOTRIBUTISTA
                                  </option>
                                  <option value="EXENTO">EXENTO</option>
                                  <option value="CONSUMIDOR FINAL">
                                    CONSUMIDOR FINAL
                                  </option>
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
