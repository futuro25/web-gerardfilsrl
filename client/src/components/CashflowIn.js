import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeft, Home } from "lucide-react";
import Button from "./common/Button";

export default function CashflowIn({ onCancel, onSubmit, isLoading = false }) {
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);
  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const handleFormSubmit = async (data) => {
    try {
      setIsLoadingSubmit(true);
      const body = {
        ...data,
        amount: Number(data.amount),
        type: "ingreso",
      };
      await onSubmit(body);
      setIsLoadingSubmit(false);
      reset();
    } catch (e) {
      console.log(e);
      setIsLoadingSubmit(false);
    }
  };

  const handleCancel = () => {
    reset();
    setIsLoadingSubmit(false);
    onCancel();
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/cashflow-selector");
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
            <ArrowLeft className="h-5 w-5 cursor-pointer" />
            <div>Ingreso</div>
          </div>
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        <div className="my-4">
          <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
            <div
              className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))]"
              style={{ backgroundPosition: "10px 10px" }}
            ></div>
            <div className="relative rounded-xl overflow-auto">
              <div className="shadow-sm overflow-hidden my-8">
                <form
                  onSubmit={handleSubmit(handleFormSubmit)}
                  className="w-full flex flex-col"
                >
                  <table className="border-collapse table-fixed w-full text-sm bg-white">
                    <tbody>
                      {/* Descripción */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Descripción:
                            </label>
                            <input
                              type="text"
                              {...register("description", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="Ej: Venta de productos"
                            />
                            {errors.description && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Monto */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Monto:
                            </label>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              {...register("amount", {
                                required: true,
                                min: 0.01,
                              })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="0.00"
                            />
                            {errors.amount?.type === "required" && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                            {errors.amount?.type === "min" && (
                              <span className="px-2 text-red-500">
                                * Debe ser mayor a 0
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Categoría */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Categoría:
                            </label>
                            <select
                              {...register("category", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                            >
                              <option value="">Seleccionar categoría</option>
                              <option value="Ventas">Ventas</option>
                              <option value="Servicios profesionales">
                                Servicios profesionales
                              </option>
                              <option value="Honorarios">Honorarios</option>
                              <option value="Consultoría">Consultoría</option>
                              <option value="Comisiones">Comisiones</option>
                              <option value="Otros ingresos">
                                Otros ingresos
                              </option>
                            </select>
                            {errors.category && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Proveedor/Cliente */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Cliente:
                            </label>
                            <input
                              type="text"
                              {...register("provider", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="Nombre del cliente"
                            />
                            {errors.provider && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Referencia */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Referencia:
                            </label>
                            <input
                              type="text"
                              {...register("reference")}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              placeholder="Ej: FAC-001, REC-002"
                            />
                          </div>
                        </td>
                      </tr>

                      {/* Fecha */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center">
                            <label className="text-slate-500 w-24 font-bold">
                              Fecha:
                            </label>
                            <input
                              type="date"
                              {...register("date", { required: true })}
                              className="flex-1 rounded border border-slate-200 p-4 text-slate-500"
                              defaultValue={
                                new Date().toISOString().split("T")[0]
                              }
                            />
                            {errors.date && (
                              <span className="px-2 text-red-500">
                                * Obligatorio
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>

                      {/* Botones */}
                      <tr>
                        <td>
                          <div className="p-4 gap-4 flex items-center justify-end">
                            <div className="gap-4 flex">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={handleCancel}
                                className="bg-red-500 text-white hover:bg-red-600"
                              >
                                Cancelar
                              </Button>
                              <Button
                                type="submit"
                                disabled={isLoadingSubmit}
                                className="bg-green-500 hover:bg-green-600"
                              >
                                {isLoadingSubmit
                                  ? "Guardando..."
                                  : "Guardar Ingreso"}
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
            <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
          </div>
        </div>
      </div>
    </>
  );
}
