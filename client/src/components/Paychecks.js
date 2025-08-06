import { useNavigate } from "react-router-dom";
import React, { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
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
import config from "../config";

export default function Paychecks() {
  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);

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
    if (createParam) {
      setStage("CREATE");
      setSelectedPaycheck(null);
      setViewOnly(false);
    } else {
      setStage("LIST");
      setSelectedPaycheck(null);
      setViewOnly(false);
    }
  }, [createParam]);

  const dataFiltered =
    data &&
    data?.length > 0 &&
    data?.filter((d) =>
      search ? d.name.toLowerCase().includes(search.toLowerCase()) : d
    );
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
    if (window.confirm("Seguro desea eliminar este Cheque?")) {
      try {
        await deleteMutation.mutate(paycheckId);
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

      if (selectedPaycheck) {
        updateMutation.mutate({ ...body, id: selectedPaycheck.id });
      } else {
        createMutation.mutate(body);
      }
      setIsLoadingSubmit(false);
      setStage("LIST");

      if (createParam) {
        const url = new URL(window.location.href);
        url.searchParams.delete("create");
        window.history.pushState({}, "", url);
      }
      reset();
    } catch (e) {
      console.log(e);
    }
  };

  const onEdit = (user_id) => {
    reset();
    const user = data.find((user) => user.id === user_id) || null;
    setSelectedPaycheck(user);
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
        {stage === "LIST" && data && (
          <div className="my-4 mb-28">
            <p className="pl-1 pb-1 text-slate-500">
              Total de cheques {data.length}
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
                          Cheque
                        </th>
                        <th className="border-b  font-medium p-4  pt-0 pb-3 text-slate-400 text-left">
                          Movimiento
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
                                  DateTime.fromISO(paycheck.due_date) > DateTime.now().startOf("day") ? "bg-red-500" : "bg-green-500"
                                )}
                              >
                              {
                                DateTime.fromISO(paycheck.due_date) > DateTime.now().startOf("day") ? "Pendiente" : "Pagado"
                              }
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
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
      </div>
    </>
  );
}
