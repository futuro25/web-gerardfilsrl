import { useNavigate } from "react-router-dom";
import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { CopyIcon, EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import { Dialog, DialogContent } from "./common/Dialog";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useUsersQuery,
  useCreateUserMutation,
  useUpdateUserMutation,
  useDeleteUserMutation,
} from "../apis/api.users";
import { queryUsersKey } from "../apis/queryKeys";
import config from "../config";

var moment = require("moment");

export default function Users() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [copy, setCopy] = useState(false);
  const [copyId, setCopyId] = useState(null);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pictureLink, setPictureLink] = useState();
  const [selectedUser, setSelectedUser] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: queryUsersKey(),
    queryFn: useUsersQuery,
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
    mutationFn: useCreateUserMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryUsersKey() });
      console.log("Usuario creado:", data);
    },
    onError: (error) => {
      console.error("Error creando usuario:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateUserMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryUsersKey() });
      console.log("Usuario creado:", data);
    },
    onError: (error) => {
      console.error("Error creando usuario:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteUserMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryUsersKey() });
      console.log("Usuario eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando usuario:", error);
    },
  });

  const removeUser = async (user_id) => {
    if (window.confirm("Seguro desea eliminar este usuario?")) {
      try {
        await deleteMutation.mutate(user_id);
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

      if (data.file?.length) {
        const resource = await utils.uploadResource(data);
        body = {
          ...data,
          // picture: resource.secure_url,
          picture: config.defaultUserImage,
        };
      } else {
        body = {
          ...data,
          picture: config.defaultUserImage,
        };
      }

      if (selectedUser) {
        updateMutation.mutate({ ...body, id: selectedUser.id });
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
    setSelectedUser(user);
    setStage("CREATE");
  };

  const onView = (user_id) => {
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedUser(user);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCopy = async (user_id) => {
    console.log(user_id);
    setCopy(true);
    setCopyId(user_id);
    const inviteLink = `${window.location.protocol}//${window.location.host}/invite?inviteId=${user_id}`;
    navigator.clipboard.writeText(inviteLink);
    await utils.delay(2000);
    setCopy(false);
    setCopyId(null);
  };

  const renderCopyAction = (user_id) => {
    return copy && copyId === user_id ? (
      <p className="text-green-500">Copiado!</p>
    ) : (
      <CopyIcon />
    );
  };

  const onCreate = () => {
    setSelectedUser(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedUser(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    reset();
    setStage("LIST");
  };

  const onCloseModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(false);
  };

  const onOpenModal = (link) => {
    setPictureLink(link);
    setIsModalOpen(true);
  };

  const usernameValidation = (username) => {
    return !data.find((user) => user.username === username);
  };

  const emailValidation = (email) => {
    return !data.find((user) => user.email === email);
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
            <div>Usuarios</div>
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
              Total de usuarios {data.length}
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
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Nombre
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Apellido
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Usuario
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Profile
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Ultima Sesion
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((user, index) => (
                          <tr
                            key={user.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {user.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {user.name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {user.last_name}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {user.username}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {user.type}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {user.last_login
                                ? moment(user.last_login).format(
                                    "DD/MM/YYYY HH:mm:ss"
                                  )
                                : "-"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(user.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Copiar Invitacion"
                                  onClick={() => onCopy(user.id)}
                                >
                                  {renderCopyAction(user.id)}
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(user.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removeUser(user.id)}
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
                                  {selectedUser?.name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedUser?.name || ""}
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
                                  {selectedUser?.last_name}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedUser?.last_name || ""}
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
                                Usuario:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedUser?.username}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  id="username"
                                  name="username"
                                  defaultValue={selectedUser?.username || ""}
                                  {...register("username", {
                                    required: true,
                                    validate: usernameValidation,
                                  })}
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                />
                              )}
                              {errors.username?.type === "required" && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                              {errors.username?.type === "validate" && (
                                <span className="px-2 text-red-500">
                                  * Nombre de usuario existente
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
                                  {selectedUser?.email}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  id="email"
                                  name="email"
                                  defaultValue={selectedUser?.email || ""}
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
                        {/* <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Imagen:
                              </label>
                              {viewOnly ? (
                                <Button
                                  variant="secondary"
                                  size="sm"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onOpenModal(selectedUser?.picture);
                                  }}
                                >
                                  Ver imagen
                                </Button>
                              ) : (
                                <div className="flex gap-2 items-end">
                                  <input
                                    type="file"
                                    {...register("file", { required: false })}
                                    className="rounded border border-slate-200  p-4  text-slate-500 "
                                  />
                                  {selectedUser?.picture !== "" &&
                                    selectedUser?.picture !== undefined && (
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          onOpenModal(selectedUser?.picture);
                                        }}
                                      >
                                        Ver imagen
                                      </Button>
                                    )}
                                </div>
                              )}
                              {errors.file && (
                                <span className="px-2 text-red-500">
                                  * Obligatorio
                                </span>
                              )}
                            </div>
                          </td>
                        </tr> */}
                        {/* ================ */}
                        <tr>
                          <td>
                            <div className="p-4 gap-4 flex items-center">
                              <label className="text-slate-500 w-20 font-bold">
                                Perfil:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500 w-20">
                                  {selectedUser?.type}
                                </label>
                              ) : (
                                <select
                                  defaultValue={selectedUser?.type || ""}
                                  {...register("type", {
                                    required: true,
                                  })}
                                  className="rounded border border-slate-200  p-4 text-slate-500 "
                                >
                                  <option value="" disabled>
                                    Select
                                  </option>
                                  <option key="ADMIN" value="ADMIN">
                                    ADMINISTRADOR
                                  </option>
                                  <option key="USER" value="STAFF">
                                    USER
                                  </option>
                                </select>
                              )}
                              {errors.type && (
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

            <Dialog open={isModalOpen}>
              <DialogContent>
                <div className="w-[500px] h-[400px] max-w-[500px] max-h-[400px]">
                  <div className="flex justify-end items-center text-gray-500">
                    <button onClick={onCloseModal}>
                      <CloseIcon />
                    </button>
                  </div>
                  <div className="flex justify-center items-center w-full">
                    <img
                      src={pictureLink}
                      className="border border-gray-200 max-w-[370px]"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-center items-center">
                  <Button onClick={onCloseModal}>Close</Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>
    </>
  );
}
