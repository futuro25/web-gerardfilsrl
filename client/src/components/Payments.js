import { useNavigate } from "react-router-dom";
import React, { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { queryPaymentsKey } from "../apis/queryKeys";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { CopyIcon, EditIcon, TrashIcon, EyeIcon, CloseIcon } from "./icons";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import { Input } from "./common/Input";
import {
  usePaymentsQuery,
  useCreatePaymentMutation,
  useDeletePaymentMutation,
  useUpdatePaymentMutation,
} from "../apis/api.payments";
import { use } from "react";

export default function Payments() {
  const [selectedPayment, setSelectedPayment] = useState();
  const [selectedPaymentToEdit, setSelectedPaymentToEdit] = useState();

  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const [search, setSearch] = useState("");

  const [invoiceAmount, setInvoiceAmount] = useState(0);
  const [IVA, setIVA] = useState(0);
  const [condition, setCondition] = useState("Inscripto");

  const navigate = useNavigate();

  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm();

  const {
    data: payments,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryPaymentsKey(),
    queryFn: usePaymentsQuery,
  });

  const createMutation = useMutation({
    mutationFn: useCreatePaymentMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaymentsKey() });
      console.log("Payment creado:", data);
    },
    onError: (error) => {
      console.error("Error creando Payment:", error);
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdatePaymentMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaymentsKey() });
      console.log("Payment creado:", data);
    },
    onError: (error) => {
      console.error("Error creando Payment:", error);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeletePaymentMutation,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryPaymentsKey() });
      console.log("Pago eliminado:", data);
    },
    onError: (error) => {
      console.error("Error eliminando Pago:", error);
    },
  });

  const dataFiltered =
    payments &&
    payments?.length > 0 &&
    payments?.filter((d) =>
      search
        ? d.supplier.toLowerCase().includes(search.toLowerCase()) ||
          d.cuit.toLowerCase().includes(search.toLowerCase())
        : d
    );

  const calcularNeto = ({ total, alicuotaIVA = 21 }) => {
    const factor = 1 + alicuotaIVA / 100;
    const neto = total / factor;
    return Math.round(neto * 100) / 100;
  };

  const calculateRetention = () => {
    let retention = 0;

    const netAmount = calcularNeto({
      total: invoiceAmount,
      alicuotaIVA: 21,
    });

    if (condition === "No inscripto") {
      retention = Math.round(netAmount * 0.28 * 100) / 100;
    }

    if (condition === "Inscripto") {
      const minimoNoImponible = 134186.89;
      const alicuota = 0.02;

      if (netAmount <= minimoNoImponible) return 0;

      const base = netAmount - minimoNoImponible;
      const retencion = base * alicuota;
      retention = Math.round(retencion * 100) / 100;
    }

    setSelectedPayment({
      ...selectedPayment,
      retention: retention,
      total_invoice: invoiceAmount,
      amount_to_pay: invoiceAmount - retention,
    });
  };

  const onEdit = (payment_id) => {
    reset();
    const payment =
      payments.find((payment) => payment.id === payment_id) || null;
    setSelectedPaymentToEdit(payment);
    setSelectedPayment(payment);
    setInvoiceAmount(payment?.net_amount || 0);
    setIVA(payment?.iva || 0);
    setCondition(payment?.condition || "Inscripto");
    setStage("CREATE");
  };

  const onView = (payment_id) => {
    const payment =
      payments.find((payment) => payment.id === payment_id) || null;
    setSelectedPayment(payment);
    setViewOnly(true);
    setInvoiceAmount(0);
    setIVA(0);
    setCondition("Inscripto");
    setStage("CREATE");
  };

  const removePayment = async (payment_id) => {
    if (window.confirm("Seguro desea eliminar este pago?")) {
      try {
        await deleteMutation.mutate(payment_id);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
    }
  };

  const onCancel = () => {
    setStage("LIST");
    setSelectedPayment(null);
    setViewOnly(false);
    setIVA(0);
    setInvoiceAmount(0);
    setCondition("Inscripto");
    setStage("LIST");
  };

  const onSubmit = async (body) => {
    if (selectedPaymentToEdit.id) {
      updateMutation.mutate({
        id: selectedPaymentToEdit.id,
        supplier: body.name,
        cuit: body.cuit,
        netAmount: body.net_amount,
        iva: body.iva,
        condition: body.condition,
        retention: selectedPayment?.retention || 0,
        totalInvoice: selectedPayment?.total_invoice || 0,
        amountToPay: selectedPayment?.amount_to_pay || 0,
      });
    } else {
      createMutation.mutate({
        supplier: body.name,
        cuit: body.cuit,
        netAmount: body.net_amount,
        iva: body.iva,
        condition: body.condition,
        retention: selectedPayment?.retention || 0,
        totalInvoice: selectedPayment?.total_invoice || 0,
        amountToPay: selectedPayment?.amount_to_pay || 0,
      });
    }

    if (!error) {
      setIVA(0);
      setInvoiceAmount(0);
      setCondition("Inscripto");
      setStage("LIST");
    }
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

  useEffect(() => {
    calculateRetention();
  }, [invoiceAmount, IVA, condition]);

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Pagos</div>
          </div>
          {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size={"sm"}
              onClick={() => {
                reset();
                setStage("CREATE");
              }}
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
        {stage === "LIST" && payments && (
          <div className="my-4 mb-28">
            <div className="pl-1 pb-1 text-slate-500 flex items-center gap-2 text-sm">
              <div>Total de pagos: {payments.length}</div>

              <div>
                Importe:{" "}
                {utils.formatAmount(
                  payments.reduce(
                    (acc, pago) => acc + (pago.amount_to_pay || 0),
                    0
                  )
                )}
              </div>
              {/* <div>
                Retenciones:{" "}
                {utils.formatAmount(
                  payments.reduce((acc, pago) => acc + (pago.retention || 0), 0)
                )}
              </div> */}
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
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Proveedor
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          CUIT
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Importe Factura
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          IVA
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Retención
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Total
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Monto a pagar
                        </th>
                        <th className="border-b  font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white ">
                      {dataFiltered.length ? (
                        dataFiltered.map((pago, index) => (
                          <tr
                            key={pago.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {new Date(pago.created_at).toLocaleDateString()}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {pago.supplier}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              {pago.cuit}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              ${pago.net_amount?.toFixed(2)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              ${pago.iva?.toFixed(2)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              ${pago.retention?.toFixed(2)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              ${pago.total_invoice?.toFixed(2)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  p-4  text-slate-500 ">
                              ${pago.amount_to_pay?.toFixed(2)}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100  text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(pago.id)}
                                >
                                  <EyeIcon />
                                </button>

                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(pago.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removePayment(pago.id)}
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
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="w-full flex flex-col"
          >
            <div className="p-4 bg-white shadow-md rounded-xl mb-6">
              <div className="mb-3">
                <label className="block">Proveedor</label>
                {viewOnly ? (
                  <label className="text-slate-500 w-20">
                    {selectedPayment?.supplier}
                  </label>
                ) : (
                  <input
                    type="text"
                    defaultValue={selectedPayment?.supplier || ""}
                    {...register("name", { required: true })}
                    className="w-full rounded border border-slate-200 p-4 text-slate-500 "
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="block">CUIT</label>
                {viewOnly ? (
                  <label className="text-slate-500 w-20">
                    {selectedPayment?.cuit}
                  </label>
                ) : (
                  <input
                    type="text"
                    defaultValue={selectedPayment?.cuit || ""}
                    {...register("cuit", { required: true })}
                    className="w-full rounded border border-slate-200 p-4 text-slate-500 "
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="block">Importe Factura</label>
                {viewOnly ? (
                  <label className="text-slate-500 w-20">
                    {selectedPayment?.net_amount}
                  </label>
                ) : (
                  <input
                    type="number"
                    defaultValue={selectedPayment?.net_amount || ""}
                    {...register("net_amount", { required: true })}
                    className="w-full rounded border border-slate-200 p-4 text-slate-500 "
                    onChange={(e) => {
                      setInvoiceAmount(parseFloat(e.target.value || "0"));
                    }}
                  />
                )}
              </div>

              <div className="mb-3">
                <label className="block">IVA</label>
                {viewOnly ? (
                  <label className="text-slate-500 w-20">
                    {selectedPayment?.iva}
                  </label>
                ) : (
                  <select
                    value={condition}
                    defaultValue={selectedPayment?.iva || ""}
                    {...register("iva", { required: true })}
                    className="w-full rounded border border-slate-200 p-4 text-slate-500"
                    onChange={(e) => {
                      setIVA(parseFloat(e.target.value || "0"));
                    }}
                  >
                    <option value="21">21%</option>
                  </select>
                )}
              </div>

              <div className="mb-3">
                <label className="block">Condición frente a Ganancias</label>
                {viewOnly ? (
                  <label className="text-slate-500 w-20">
                    {selectedPayment?.condition}
                  </label>
                ) : (
                  <select
                    value={condition}
                    defaultValue={selectedPayment?.condition || ""}
                    className="w-full rounded border border-slate-200 p-4 text-slate-500"
                    {...register("condition", { required: true })}
                    onChange={(e) => {
                      setCondition(e.target.value);
                    }}
                  >
                    <option value="Inscripto">Inscripto</option>
                    <option value="No inscripto">No inscripto</option>
                  </select>
                )}
              </div>

              <div className="mt-4 space-y-1">
                <p>
                  <strong>Retención:</strong> $
                  {selectedPayment?.retention.toFixed(2) || 0}
                </p>
                <p>
                  <strong>Total Factura:</strong> $
                  {selectedPayment?.total_invoice.toFixed(2) || 0}
                </p>
                <p>
                  <strong>Monto a pagar al proveedor:</strong> $
                  {selectedPayment?.amount_to_pay.toFixed(2) || 0}
                </p>
              </div>

              <div className="mt-4 flex gap-2 items-center justify-end">
                <Button variant="destructive" onClick={() => onCancel()}>
                  Cancelar
                </Button>

                <Button type="submit">Guardar</Button>
              </div>
            </div>
          </form>
        )}
      </div>
    </>
  );
}
