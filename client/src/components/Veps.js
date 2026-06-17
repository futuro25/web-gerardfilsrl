import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { DateTime } from "luxon";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "./common/Input";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import * as utils from "../utils/utils";
import {
  fetchVeps,
  createVep,
  updateVep,
  deleteVep,
} from "../apis/api.veps";
import { queryVepsKey, queryUpcomingVepsKey } from "../apis/queryKeys";

export const VEP_CATEGORIES = [
  "IIBB",
  "Seguridad e Higiene",
  "Cargas Sociales",
  "IVA",
  "Sindicato",
  "Impuesto a las ganancias",
  "Bienes Personales",
  "Otros",
];

function categoryLabel(row) {
  if (!row) return "—";
  return row.display_category || row.category || "—";
}

function isVepPaid(vep) {
  return Boolean(vep?.paid_at) || vep?.status === "pagado";
}

function dueStatusLabel(dueDate, vep) {
  if (isVepPaid(vep)) return null;
  if (!dueDate) return null;
  const due = DateTime.fromISO(dueDate);
  if (!due.isValid) return null;
  const today = DateTime.now().startOf("day");
  if (due < today) return { text: "Vencido", className: "text-red-600" };
  if (due <= today.plus({ days: 15 }))
    return { text: "Por vencer", className: "text-amber-700" };
  return null;
}

export default function Veps() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [stage, setStage] = useState("LIST");
  const [search, setSearch] = useState("");
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [selectedVep, setSelectedVep] = useState(null);
  const [watchCategory, setWatchCategory] = useState("IVA");

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      amount: "",
      due_date: DateTime.now().toFormat("yyyy-MM-dd"),
      category: "IVA",
      custom_category: "",
    },
  });

  const categoryValue = watch("category");

  useEffect(() => {
    setWatchCategory(categoryValue || "IVA");
  }, [categoryValue]);

  const { data: res, isLoading, error } = useQuery({
    queryKey: queryVepsKey(),
    queryFn: fetchVeps,
  });

  const list = res?.data || [];

  const dataFiltered =
    list?.length > 0 &&
    list?.filter((row) => {
      if (!search) return true;
      const term = search.toLowerCase();
      return (
        String(row.id).includes(term) ||
        categoryLabel(row).toLowerCase().includes(term) ||
        String(row.amount).includes(term) ||
        (row.due_date && row.due_date.includes(term))
      );
    });

  if (error) console.log(error);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryVepsKey() });
    queryClient.invalidateQueries({ queryKey: queryUpcomingVepsKey() });
  };

  const createMutation = useMutation({
    mutationFn: createVep,
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => {
      console.error("Error creando VEP:", err);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateVep,
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => {
      console.error("Error actualizando VEP:", err);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteVep,
    onSuccess: () => {
      invalidate();
    },
    onError: (err) => {
      console.error("Error eliminando VEP:", err);
    },
  });

  const removeVep = async (vepId) => {
    if (window.confirm("¿Seguro desea eliminar este VEP?")) {
      try {
        await deleteMutation.mutateAsync(vepId);
        setStage("LIST");
        setSelectedVep(null);
        setViewOnly(false);
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);

      const body = {
        amount: parseFloat(data.amount),
        due_date: data.due_date,
        category: data.category,
        custom_category:
          data.category === "Otros" ? data.custom_category?.trim() : null,
      };

      if (selectedVep) {
        await updateMutation.mutateAsync({ ...body, id: selectedVep.id });
      } else {
        await createMutation.mutateAsync(body);
      }

      setIsLoadingSubmit(false);
      setStage("LIST");
      setSelectedVep(null);
      setViewOnly(false);
      reset({
        amount: "",
        due_date: DateTime.now().toFormat("yyyy-MM-dd"),
        category: "IVA",
        custom_category: "",
      });
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
      window.alert(e.message || "No se pudo guardar el VEP");
    }
  };

  const loadVepIntoForm = (vep) => {
    reset({
      amount: vep?.amount != null ? String(vep.amount) : "",
      due_date: vep?.due_date
        ? DateTime.fromISO(vep.due_date).toFormat("yyyy-MM-dd")
        : DateTime.now().toFormat("yyyy-MM-dd"),
      category: vep?.category || "IVA",
      custom_category: vep?.custom_category || "",
    });
    setWatchCategory(vep?.category || "IVA");
  };

  const onEdit = (vepId) => {
    const vep = list.find((v) => v.id === vepId) || null;
    setSelectedVep(vep);
    setViewOnly(false);
    loadVepIntoForm(vep);
    setStage("CREATE");
  };

  const onView = (vepId) => {
    const vep = list.find((v) => v.id === vepId) || null;
    setSelectedVep(vep);
    setViewOnly(true);
    loadVepIntoForm(vep);
    setStage("CREATE");
  };

  const onCreate = () => {
    setSelectedVep(null);
    setViewOnly(false);
    reset({
      amount: "",
      due_date: DateTime.now().toFormat("yyyy-MM-dd"),
      category: "IVA",
      custom_category: "",
    });
    setWatchCategory("IVA");
    setStage("CREATE");
  };

  const onCancel = () => {
    setSelectedVep(null);
    setViewOnly(false);
    setIsLoadingSubmit(false);
    reset({
      amount: "",
      due_date: DateTime.now().toFormat("yyyy-MM-dd"),
      category: "IVA",
      custom_category: "",
    });
    setWatchCategory("IVA");
    setStage("LIST");
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
            <div>VEPs</div>
          </div>
          {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size="sm"
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

        {stage === "LIST" && list && (
          <div className="my-4 mb-28">
            <p className="pl-1 pb-1 text-slate-500">
              Total de VEPs {list.length}
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
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Vencimiento
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Clasificación
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Importe
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Estado
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered?.length ? (
                        dataFiltered.map((vep, index) => {
                          const paid = isVepPaid(vep);
                          const status = dueStatusLabel(vep.due_date, vep);
                          return (
                            <tr
                              key={vep.id}
                              className={utils.cn(
                                "border-b last:border-b-0 hover:bg-gray-100",
                                index % 2 === 0 && "bg-gray-50",
                                paid && "opacity-70"
                              )}
                            >
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 ">
                                {vep.id}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 ">
                                {vep.due_date
                                  ? utils.formatDate(vep.due_date)
                                  : "—"}
                                {status && (
                                  <span
                                    className={utils.cn(
                                      "ml-2 text-[10px] uppercase font-medium",
                                      status.className
                                    )}
                                  >
                                    {status.text}
                                  </span>
                                )}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 ">
                                {categoryLabel(vep)}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 pr-8 text-slate-500 ">
                                {utils.formatAmount(vep.amount)}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500 ">
                                {paid ? (
                                  <span className="text-[10px] uppercase font-medium text-emerald-700">
                                    Pagado
                                  </span>
                                ) : (
                                  <span className="text-[10px] uppercase font-medium text-amber-700">
                                    Pendiente
                                  </span>
                                )}
                              </td>
                              <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                                <div className="flex gap-2">
                                  <button
                                    className="flex items-center justify-center w-8 h-8"
                                    title="Ver detalle"
                                    onClick={() => onView(vep.id)}
                                  >
                                    <EyeIcon />
                                  </button>
                                  <button
                                    className="flex items-center justify-center w-8 h-8"
                                    title="Editar"
                                    onClick={() => onEdit(vep.id)}
                                  >
                                    <EditIcon />
                                  </button>
                                  <button
                                    className="flex items-center justify-center w-8 h-8"
                                    title="Eliminar"
                                    onClick={() => removeVep(vep.id)}
                                  >
                                    <TrashIcon />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td
                            colSpan={6}
                            className="border-b border-slate-100 p-4 text-slate-500 "
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
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Clasificación:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {categoryLabel(selectedVep)}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <select
                                    {...register("category", {
                                      required: true,
                                      onChange: (e) => {
                                        const val = e.target.value;
                                        setWatchCategory(val);
                                        if (val !== "Otros") {
                                          setValue("custom_category", "");
                                        }
                                      },
                                    })}
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-auto min-w-[240px]"
                                  >
                                    {VEP_CATEGORIES.map((cat) => (
                                      <option key={cat} value={cat}>
                                        {cat}
                                      </option>
                                    ))}
                                  </select>
                                  {errors.category && (
                                    <span className="text-red-500 text-sm">
                                      * Obligatorio
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {(viewOnly
                          ? selectedVep?.category === "Otros"
                          : watchCategory === "Otros") && (
                          <tr>
                            <td>
                              <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                                <label className="text-slate-500 md:w-32 font-bold">
                                  Tipo de VEP:
                                </label>
                                {viewOnly ? (
                                  <label className="text-slate-500">
                                    {selectedVep?.custom_category || "—"}
                                  </label>
                                ) : (
                                  <div className="flex flex-col gap-2">
                                    <input
                                      type="text"
                                      placeholder="Especifique el tipo de VEP"
                                      {...register("custom_category", {
                                        required:
                                          watchCategory === "Otros"
                                            ? "Indique el tipo de VEP"
                                            : false,
                                      })}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-[400px]"
                                    />
                                    {errors.custom_category && (
                                      <span className="text-red-500 text-sm">
                                        * Obligatorio
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Importe:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {utils.formatAmount(selectedVep?.amount)}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="number"
                                    step="0.01"
                                    id="amount"
                                    name="amount"
                                    {...register("amount", {
                                      required: true,
                                      min: {
                                        value: 0.01,
                                        message: "El importe debe ser mayor a 0",
                                      },
                                    })}
                                    placeholder="Ingrese el importe"
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-auto"
                                  />
                                  {errors.amount && (
                                    <span className="text-red-500 text-sm">
                                      * Obligatorio
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Vencimiento:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedVep?.due_date
                                    ? utils.formatDate(selectedVep.due_date)
                                    : "—"}
                                  {(() => {
                                    const status = dueStatusLabel(
                                      selectedVep?.due_date,
                                      selectedVep
                                    );
                                    if (!status) return null;
                                    return (
                                      <span
                                        className={utils.cn(
                                          "ml-2 text-xs uppercase font-medium",
                                          status.className
                                        )}
                                      >
                                        {status.text}
                                      </span>
                                    );
                                  })()}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <input
                                    type="date"
                                    id="due_date"
                                    name="due_date"
                                    {...register("due_date", {
                                      required: true,
                                    })}
                                    className="rounded border border-slate-200 p-4 text-slate-500 w-full md:w-auto"
                                  />
                                  {errors.due_date && (
                                    <span className="text-red-500 text-sm">
                                      * Obligatorio
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>

                        {viewOnly && (
                          <tr>
                            <td>
                              <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                                <label className="text-slate-500 md:w-32 font-bold">
                                  Estado:
                                </label>
                                <label className="text-slate-500">
                                  {isVepPaid(selectedVep) ? "Pagado" : "Pendiente"}
                                </label>
                              </div>
                            </td>
                          </tr>
                        )}

                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-4 md:items-center md:justify-end">
                              {viewOnly ? (
                                <div>
                                  <Button
                                    variant="destructive"
                                    type="button"
                                    onClick={() => onCancel()}
                                    className="w-full md:w-auto"
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              ) : (
                                <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
                                  <Button
                                    variant="destructive"
                                    type="button"
                                    onClick={() => onCancel()}
                                    className="w-full md:w-auto"
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    type="submit"
                                    disabled={isLoadingSubmit}
                                    className="w-full md:w-auto"
                                  >
                                    {isLoadingSubmit ? "Guardando..." : "Guardar"}
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
