import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  usePaychecksQuery,
  useCreatePaycheckMutation,
  useUpdatePaycheckMutation,
  useDeletePaycheckMutation,
} from "../apis/api.paychecks";
import { queryPaychecksKey } from "../apis/queryKeys";
export default function Paychecks() {
  const canManagePaychecks = sessionStorage.username === "lgedeon";
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [viewAllPaychecks, setViewAllPaychecks] = useState(false);

  const params = new URLSearchParams(window.location.search);
  const createParam = params.get("create");
  const paycheckParam = params.get("id");

  const [selectedPaycheck, setSelectedPaycheck] = useState(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const { data, isLoading, error } = useQuery({
    queryKey: queryPaychecksKey(),
    queryFn: usePaychecksQuery,
  });

  useEffect(() => {
    if (createParam && canManagePaychecks) {
      setStage("CREATE");
      setSelectedPaycheck(null);
      setViewOnly(false);
    } else {
      setStage("LIST");
      setSelectedPaycheck(null);
      setViewOnly(false);
    }
  }, [createParam, canManagePaychecks]);

  useEffect(() => {
    if (stage === "CREATE" && selectedPaycheck && canManagePaychecks) {
      reset({
        number: selectedPaycheck.number ?? "",
        bank: selectedPaycheck.bank ?? "",
        amount: selectedPaycheck.amount ?? "",
        due_date: selectedPaycheck.due_date
          ? DateTime.fromISO(selectedPaycheck.due_date).toFormat("yyyy-MM-dd")
          : "",
        type: selectedPaycheck.type ?? "OUT",
      });
    }
    if (stage === "CREATE" && !selectedPaycheck && createParam && canManagePaychecks) {
      reset({
        number: "",
        bank: "",
        amount: "",
        due_date: DateTime.now().toFormat("yyyy-MM-dd"),
        type: "OUT",
      });
    }
  }, [stage, selectedPaycheck, createParam, reset, canManagePaychecks]);

  const applySearch = (list) => {
    if (!list || !search) return list || [];
    const term = search.toLowerCase();
    return list.filter((d) =>
      (d.number && d.number.toLowerCase().includes(term)) ||
      (d.bank && d.bank.toLowerCase().includes(term))
    );
  };

  const dataToShow = data?.filter(
    (paycheck) =>
      paycheck.due_date &&
      DateTime.fromISO(paycheck.due_date) > DateTime.now().startOf("day")
  ) || [];

  const dataFiltered = applySearch(viewAllPaychecks ? data : dataToShow);

  if (error) console.log(error);

  const createMutation = useMutation({
    mutationFn: useCreatePaycheckMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
      console.log("Cheque creado:", data);
    },
    onError: (error) => {
      console.error("Error creando cheque:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdatePaycheckMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
      console.log("Cheque creado:", data);
    },
    onError: (error) => {
      console.error("Error creando cheque:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeletePaycheckMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaychecksKey() });
      console.log("Cheque eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando cheque:", error);
    },
  });

  const removeUser = async (paycheckId) => {
    if (!canManagePaychecks) return;
    if (window.confirm("Seguro desea eliminar este Cheque?")) {
      try {
        await deleteMutation.mutateAsync(paycheckId);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onSubmit = async (data) => {
    if (!canManagePaychecks) return;
    try {
      setIsLoadingSubmit(true);

      if (selectedPaycheck) {
        await updateMutation.mutateAsync({
          id: selectedPaycheck.id,
          number: data.number,
          bank: data.bank,
          amount: Number(data.amount),
          due_date: data.due_date,
          type: data.type,
          client_id: selectedPaycheck.client_id,
          movement_id: selectedPaycheck.movement_id,
        });
      } else {
        await createMutation.mutateAsync({
          number: data.number,
          bank: data.bank,
          amount: Number(data.amount),
          due_date: data.due_date,
          type: data.type,
          client_id: data.client_id || null,
          movement_id: data.movement_id || null,
        });
      }

      setIsLoadingSubmit(false);
      setStage("LIST");

      if (createParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete("create");
        window.history.pushState({}, "", url);
      }
      reset();
      setSelectedPaycheck(null);
    } catch (e) {
      setIsLoadingSubmit(false);
      console.log(e);
    }
  };

  const onEdit = (paycheckId) => {
    if (!canManagePaychecks) return;
    reset();
    const paycheck =
      data.find((row) => row.id === paycheckId) || null;
    setSelectedPaycheck(paycheck);
    setStage("CREATE");
  };

  const onView = (user_id) => {
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedPaycheck(user);
    setViewOnly(true);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedPaycheck(null);
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedPaycheck(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    reset();
    setStage("LIST");
    const url = new URL(window.location.href);
    if (url.searchParams.has("create")) {
      url.searchParams.delete("create");
      window.history.pushState({}, "", url);
    }
  };

  const fantasyNameValidation = (username) => {
    return data.length
      ? !data.find((user) => user.username === username)
      : true;
  };

  const emailValidation = (email) => {
    if (selectedPaycheck && selectedPaycheck.email === email) {
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
      onCancel();
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
            <div>Cheques</div>
          </div>
          {/* {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size={"sm"}
              onClick={() => onCreate()}
            >
              Crear
            </Button>
          )} */}
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
        {stage === "CREATE" && canManagePaychecks && (
          <div className="my-4 mb-28 not-prose relative bg-slate-50 rounded-xl overflow-hidden ">
            <div
              className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] "
              style={{ backgroundPosition: "10px 10px" }}
            ></div>
            <div className="relative rounded-xl overflow-auto px-4 py-8">
              <form
                onSubmit={handleSubmit(onSubmit)}
                className="max-w-xl flex flex-col gap-4 bg-white p-6 rounded-lg shadow-sm border border-slate-100"
              >
                <div className="text-lg font-semibold text-slate-700 pb-2">
                  {selectedPaycheck ? "Editar cheque" : "Nuevo cheque"}
                </div>
                <Input
                  label="Número"
                  {...register("number", { required: true })}
                  id="number"
                  placeholder="Ej. 12345678"
                />
                {errors.number && (
                  <p className="text-xs text-red-500">Requerido</p>
                )}
                <Input
                  label="Banco"
                  {...register("bank", { required: true })}
                  id="bank"
                />
                {errors.bank && (
                  <p className="text-xs text-red-500">Requerido</p>
                )}
                <Input
                  label="Importe"
                  type="number"
                  step="0.01"
                  {...register("amount", { required: true })}
                  id="amount"
                />
                {errors.amount && (
                  <p className="text-xs text-red-500">Requerido</p>
                )}
                <Input
                  label="Fecha de pago"
                  type="date"
                  {...register("due_date", { required: true })}
                  id="due_date"
                />
                {errors.due_date && (
                  <p className="text-xs text-red-500">Requerido</p>
                )}
                <div className="w-full">
                  <label
                    htmlFor="type"
                    className="text-xs-special font-sans text-gray-900 mb-2 block"
                  >
                    Movimiento
                  </label>
                  <select
                    id="type"
                    className="w-full px-2 block text-sm-special font-sans border box-border rounded h-12 border-gray-100"
                    {...register("type")}
                  >
                    <option value="IN">Ingreso</option>
                    <option value="OUT">Egreso</option>
                  </select>
                </div>
                <div className="flex gap-3 pt-2">
                  <Button type="submit" disabled={isLoadingSubmit}>
                    {isLoadingSubmit ? "Guardando..." : "Guardar"}
                  </Button>
                  <Button
                    type="button"
                    variant="alternative"
                    onClick={onCancel}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}
        {stage === "LIST" && data && (
          <div className="my-4 mb-28">
            <div className="pl-1 pb-1 text-slate-500 flex justify-between items-center">
              <div>
                Total de cheques{" "}
                {dataFiltered.length}
              </div>
              <div>
                <Button
                  variant="alternative"
                  className="ml-auto"
                  size={"sm"}
                  onClick={() => setViewAllPaychecks(!viewAllPaychecks)}
                >
                  {viewAllPaychecks
                    ? "Ver próximos cheques"
                    : "Ver todos los cheques"}
                </Button>
              </div>
            </div>
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
                          Cheque
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Movimiento
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Proveedor
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Banco
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Importe
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha de Pago
                        </th>
                        <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Estado
                        </th>
                        {canManagePaychecks && (
                          <th className="border-b  font-medium p-4 pt-0 pb-3 text-slate-400 text-left whitespace-nowrap">
                            Acciones
                          </th>
                        )}
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((paycheck, index) => (
                          <tr
                            key={paycheck.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50",
                              paycheckParam &&
                                paycheckParam === paycheck.id.toString()
                                ? "bg-orange-200"
                                : ""
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {paycheck.id}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {paycheck.number}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {paycheck.type === "IN" ? "Ingreso" : "Egreso"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {paycheck.supplier_name ? (
                                <div className="flex flex-col">
                                  <span>{paycheck.supplier_name}</span>
                                  {paycheck.order_number && (
                                    <span className="text-[10px] text-slate-400">
                                      {paycheck.order_number}
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 pr-8 text-slate-500 ">
                              {paycheck.bank}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {utils.formatAmount(paycheck.amount)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              {DateTime.fromISO(paycheck.due_date).toFormat(
                                "dd/MM/yyyy"
                              )}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4 text-slate-500 ">
                              <span
                                className={utils.cn(
                                  "px-2 py-1 text-xs font-medium text-white rounded",
                                  DateTime.fromISO(paycheck.due_date) >
                                    DateTime.now().startOf("day")
                                    ? "bg-red-500"
                                    : "bg-green-500"
                                )}
                              >
                                {paycheck.type === "IN" && (
                                  <>
                                    {DateTime.fromISO(paycheck.due_date) >
                                    DateTime.now().startOf("day")
                                      ? "Pendiente"
                                      : "Acreditado"}
                                  </>
                                )}
                                {paycheck.type === "OUT" && (
                                  <>
                                    {DateTime.fromISO(paycheck.due_date) >
                                    DateTime.now().startOf("day")
                                      ? "Pendiente"
                                      : "Pagado"}
                                  </>
                                )}
                              </span>
                            </td>
                            {canManagePaychecks && (
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 whitespace-nowrap">
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    className="flex items-center justify-center w-8 h-8"
                                    title="Editar cheque"
                                    onClick={() => onEdit(paycheck.id)}
                                  >
                                    <EditIcon />
                                  </button>
                                  <button
                                    type="button"
                                    className="flex items-center justify-center w-8 h-8"
                                    title="Eliminar cheque"
                                    onClick={() => removeUser(paycheck.id)}
                                  >
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            )}
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={canManagePaychecks ? 9 : 8}
                            className="border-b border-slate-100  p-4  text-slate-500 "
                          >
                            No hay próximos cheques para mostrar. Si desea ver cheques anteriores puede hacer click en {" "}
                            <span className="text-blue-500 underline cursor-pointer" onClick={() => setViewAllPaychecks(true)}>Ver todos los cheques</span>.
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
      </div>
    </>
  );
}
