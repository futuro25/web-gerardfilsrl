import { useNavigate } from "react-router-dom";
import { HouseIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import React, { useState, useEffect } from "react";
import { Dialog, DialogContent } from "./common/Dialog";
import { CloseIcon } from "./icons";
import Button from "./common/Button";
import * as utils from "../utils/utils";
import { capitalize } from "lodash";
import { DateTime } from "luxon";
import { Input } from "./common/Input";
import { Badge } from "./common/Badge";
import { X } from "lucide-react";
import { Card, CardContent } from "./common/Card";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { useCashflowsQuery } from "../apis/api.cashflow";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { useClientsQuery } from "../apis/api.clients";
import {
  queryCashflowKey,
  queryPaychecksKey,
  querySuppliersKey,
  queryClientsKey,
} from "../apis/queryKeys";
import Spinner from "./common/Spinner";
import { usePaychecksQuery } from "../apis/api.paychecks";

export default function Cashflow() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isModalPaychecksOpen, setIsModalPaychecksOpen] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState();

  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: queryCashflowKey(),
    queryFn: useCashflowsQuery,
  });

  const {
    data: suppliers,
    isLoadingSuppliers,
    errorSuppliers,
  } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const {
    data: clients,
    isLoadingClients,
    errorClients,
  } = useQuery({
    queryKey: queryClientsKey(),
    queryFn: useClientsQuery,
  });

  const {
    data: paychecks,
    isLoadingPaychecks,
    errorPaychecks,
  } = useQuery({
    queryKey: queryPaychecksKey(),
    queryFn: usePaychecksQuery,
  });

  const hoy = DateTime.now().startOf("day");
  const limite = hoy.plus({ days: 7 });

  const proximos7dias =
    paychecks?.filter((item) => {
      const dueDate = DateTime.fromISO(item.due_date);
      return dueDate >= hoy && dueDate <= limite;
    }) || [];

  const proximos7diasTypeIn = proximos7dias.filter(
    (item) => item.type === "IN"
  );
  const proximos7diasTypeOut = proximos7dias.filter(
    (item) => item.type === "OUT"
  );

  const filteredMovements = data?.filter((movement) => {
    const matchesSearch =
      movement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.provider_name
        ?.toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      movement.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "all" || movement.type.toLowerCase() === selectedType;

    return matchesSearch && matchesType;
  });

  const totalIngresos =
    data
      ?.filter((m) => m.type.toLowerCase() === "ingreso")
      .reduce((sum, m) => sum + m.amount, 0) || 0;

  const totalEgresos =
    data
      ?.filter((m) => m.type.toLowerCase() === "egreso")
      .reduce((sum, m) => sum + Math.abs(m.amount), 0) || 0;

  const totalCashflow = filteredMovements?.reduce((sum, m) => {
    let amount = m.amount;

    if (m.payment_method === utils.getPaycheckString()) {
      const today = DateTime.now().startOf("day");
      const dueDate = DateTime.fromISO(m.chequeDueDate).startOf("day");

      if (dueDate > today) {
        amount = 0;
      }
    }

    return (
      sum + (m.type.toLowerCase() === "ingreso" ? amount : -Math.abs(amount))
    );
  }, 0);

  const getPaymentInfo = (movementId, payment) => {
    if (payment === utils.getPaycheckString()) {
      const paycheckData = paychecks?.find((p) => p.movement_id === movementId);

      return (
        <div
          className="text-xs text-gray-500 cursor-pointer"
          onClick={() => navigate(`/cheques?id=${paycheckData.id}`)}
        >{`CHEQUE # ${paycheckData?.number} ${paycheckData?.bank}`}</div>
      );
    } else {
      return <p className="text-xs text-gray-500">{payment.toUpperCase()}</p>;
    }
  };

  const getSupplierName = (id) => {
    const supplier = suppliers?.find((s) => {
      if (s.id === +id) {
        return s;
      }
    });
    return supplier ? supplier.fantasy_name : "Proveedor no encontrado";
  };

  const getClientName = (id) => {
    const client = clients?.find((s) => {
      if (s.id === +id) {
        return s;
      }
    });
    return client ? client.fantasy_name : "Cliente no encontrado";
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency: "ARS",
      minimumFractionDigits: 0,
    }).format(Math.abs(amount));
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

  const onCreate = () => {
    navigate("/cashflow-selector");
  };

  const onCloseModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsModalOpen(false);
  };

  const onClick = (movementId) => {
    const movement = filteredMovements.find((m) => m.id === movementId);
    const supplierName =
      movement.type === "EGRESO"
        ? getSupplierName(movement.provider)
        : getClientName(movement.provider);
    setSelectedMovement({ ...movement, supplierName: supplierName });
    setIsModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Cashflow</div>
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

      <div className="p-4 space-y-6 w-full flex flex-col items-center justify-center">
        {/* Summary Cards */}
        <div className="flex items-center justify-center gap-4 max-w-[350px]">
          <div
            className={`flex items-center justify-center p-4 bg-white rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 ${
              selectedType === "ingreso"
                ? "ring-2 ring-green-500 bg-green-50"
                : "hover:shadow-md"
            }`}
            onClick={() =>
              setSelectedType(selectedType === "ingreso" ? "all" : "ingreso")
            }
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <HouseIcon className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Ingresos</h3>
              <p className="text-sm text-green-600 font-semibold">
                {formatCurrency(totalIngresos)}
              </p>
            </div>
          </div>

          <div
            className={`flex items-center justify-center p-4 bg-white rounded-lg cursor-pointer border h-32 shadow-lg transition-colors duration-200 w-40 ${
              selectedType === "egreso"
                ? "ring-2 ring-red-500 bg-red-50"
                : "hover:shadow-md"
            }`}
            onClick={() =>
              setSelectedType(
                selectedType.toLowerCase() === "egreso" ? "all" : "egreso"
              )
            }
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <HouseIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Egresos</h3>
              <p className="text-sm text-red-600 font-semibold">
                {formatCurrency(totalEgresos)}
              </p>
            </div>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="space-y-3 w-full">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar movimientos..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>

          {isLoading && (
            <div>
              <Spinner />
            </div>
          )}

          {!!proximos7dias.length && !!proximos7diasTypeIn.length && (
            <div className="flex items-center justify-between">
              <div class="flex items-start gap-3 p-4 w-full bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 rounded-md">
                <svg
                  class="w-5 h-5 mt-1 text-yellow-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.054 0 1.658-1.14 1.105-2.01L13.105 4.99c-.527-.88-1.684-.88-2.21 0L3.977 16.99c-.553.87.051 2.01 1.105 2.01z"
                  />
                </svg>
                <div>
                  <p class="font-semibold">Atención</p>
                  <div className="flex gap-2">
                    <p class="text-sm">
                      Existen cheques próximos a acreditarse
                    </p>
                    <p
                      class="text-sm cursor-pointer font-bold"
                      onClick={() => setIsModalPaychecksOpen(true)}
                    >
                      Ver cheques
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!!proximos7dias.length && !!proximos7diasTypeOut.length && (
            <div className="flex items-center justify-between">
              <div class="flex items-start gap-3 p-4 w-full bg-yellow-100 text-yellow-800 border-l-4 border-yellow-500 rounded-md">
                <svg
                  class="w-5 h-5 mt-1 text-yellow-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.054 0 1.658-1.14 1.105-2.01L13.105 4.99c-.527-.88-1.684-.88-2.21 0L3.977 16.99c-.553.87.051 2.01 1.105 2.01z"
                  />
                </svg>
                <div>
                  <p class="font-semibold">Atención</p>
                  <div className="flex gap-2">
                    <p class="text-sm">Existen cheques próximos a vencer</p>
                    <p
                      class="text-sm cursor-pointer font-bold"
                      onClick={() => setIsModalPaychecksOpen(true)}
                    >
                      Ver cheques
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Total de movimientos: {filteredMovements?.length}
            </p>
            {selectedType !== "all" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedType("all")}
              >
                Ver todos
              </Button>
            )}
          </div>
        </div>

        {/* Movements List */}
        <div className="space-y-3 w-full">
          {Array.isArray(filteredMovements) && filteredMovements.length > 0 && (
            <Card className="!mt-10 mb-8">
              <CardContent className="!p-2 text-center flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Total</h3>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      totalCashflow > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalCashflow > 0 ? "+" : "-"}
                    {formatCurrency(totalCashflow)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {Array.isArray(filteredMovements) &&
          filteredMovements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center pt-10">
                <p className="text-gray-500">No se encontraron movimientos</p>
              </CardContent>
            </Card>
          ) : (
            Array.isArray(filteredMovements) &&
            filteredMovements.map((movement) => (
              <Card
                key={movement.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => onClick(movement.id)}
              >
                <CardContent className="!p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {movement.provider && (
                            <div className="flex gap-2 items-end justify-end">
                              <p className="text-xs text-gray-400">
                                {movement.id}
                              </p>
                              <p className="text-sm text-gray-900">
                                {movement.provider_name}
                              </p>
                            </div>
                          )}
                        </h3>
                        <Badge
                          variant={
                            movement.type.toLowerCase() === "ingreso"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            movement.type.toLowerCase() === "ingreso"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {capitalize(movement.type)}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>
                            {DateTime.fromISO(movement.date)
                              .plus({ hours: 3 })
                              .toFormat("dd/MM/yyyy")}
                          </span>

                          <span className="text-xs">{movement.category}</span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {movement.description}
                        </p>
                        {movement.payment_method &&
                          getPaymentInfo(movement.id, movement.payment_method)}

                        {movement.reference && (
                          <p className="text-xs text-gray-500">
                            Ref: {movement.reference}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="text-right">
                      <p
                        className={`font-semibold ${
                          movement.type.toLowerCase() === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {movement.type.toLowerCase() === "ingreso" ? "+" : "-"}
                        {formatCurrency(movement.amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {Array.isArray(filteredMovements) && filteredMovements.length > 0 && (
            <Card className="!mt-10">
              <CardContent className="!p-2 text-center flex items-center justify-between">
                <h3 className="font-bold text-gray-900">Total</h3>
                <div className="text-right">
                  <p
                    className={`font-semibold ${
                      totalCashflow > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {totalCashflow > 0 ? "+" : "-"}
                    {formatCurrency(totalCashflow)}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {selectedMovement && (
          <Dialog open={isModalOpen}>
            <DialogContent className="w-[95vw] max-w-md mx-auto max-h-[90vh] overflow-y-auto">
              {/* Header with close button */}
              <div className="flex justify-between items-start mb-4 sticky top-0 bg-white pb-2">
                <h2 className="text-lg sm:text-xl font-semibold text-gray-800 pr-4">
                  Detalle del Movimiento
                </h2>
                <div className="flex items-center gap-3">
                  <span
                    className={utils.cn(
                      "px-2 py-1 text-xs font-medium text-white rounded whitespace-nowrap",
                      selectedMovement.type === "EGRESO"
                        ? "bg-red-500"
                        : "bg-green-500"
                    )}
                  >
                    {selectedMovement.type}
                  </span>
                  <button
                    onClick={onCloseModal}
                    className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                  >
                    <CloseIcon />
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="space-y-4">
                {/* Category */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Categoría:
                  </span>
                  <p className="text-sm text-gray-900 break-words">
                    {selectedMovement.category}
                  </p>
                </div>

                {/* Description */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Descripción:
                  </span>
                  <p className="text-sm text-gray-900 break-words">
                    {selectedMovement.description}
                  </p>
                </div>

                {/* Amount */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Monto:
                  </span>
                  <p
                    className={utils.cn(
                      "text-base font-semibold break-words",
                      selectedMovement.amount < 0
                        ? "text-red-600"
                        : "text-green-600"
                    )}
                  >
                    {formatCurrency(selectedMovement.amount)}
                  </p>
                </div>

                {/* Date */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Fecha:
                  </span>
                  <p className="text-sm text-gray-900">
                    {DateTime.fromISO(selectedMovement.date)
                      .plus({ hours: 3 })
                      .toFormat("dd/MM/yyyy")}
                  </p>
                </div>

                {/* Payment Method */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Método de pago:
                  </span>
                  <p className="text-sm text-gray-900 break-words">
                    {selectedMovement.payment_method}
                  </p>
                </div>

                {/* Supplier */}
                <div className="space-y-1">
                  <span className="text-sm font-medium text-gray-600">
                    Proveedor:
                  </span>
                  <p className="text-sm text-gray-900 break-words">
                    {selectedMovement.supplierName}
                  </p>
                </div>
              </div>

              {/* Footer */}
              <div className="flex justify-center pt-4 mt-6 border-t border-gray-100">
                <Button onClick={onCloseModal}>Cerrar</Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {proximos7dias && (
          <Dialog
            open={isModalPaychecksOpen}
            onOpenChange={setIsModalPaychecksOpen}
          >
            <DialogContent className="w-[95vw] max-w-2xl max-h-[90vh] p-0 gap-0">
              <div className="flex flex-col h-full">
                <div className="sticky top-0 bg-white px-4 sm:px-6 py-4 flex items-center justify-between">
                  <h2 className="text-lg sm:text-xl font-semibold text-gray-800">
                    Detalle de Cheque
                  </h2>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsModalPaychecksOpen(false)}
                    className="h-8 w-8 p-0 hover:bg-gray-100"
                  >
                    <X className="h-4 w-4" />
                    <span className="sr-only">Cerrar</span>
                  </Button>
                </div>

                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
                  {proximos7dias.length === 0 ? (
                    <div className="text-center text-gray-500 py-8">
                      No hay cheques para mostrar.
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {proximos7dias.map((cheque, index) => (
                        <div
                          key={cheque.id || index}
                          className="border rounded-lg p-4 shadow-sm bg-white hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
                            <span className="text-sm text-gray-500 font-medium">
                              #{cheque.number}
                            </span>
                            <span
                              className={utils.cn(
                                "px-3 py-1 text-xs font-medium text-white rounded-full w-fit",
                                cheque.type === "OUT"
                                  ? "bg-red-500"
                                  : "bg-green-500"
                              )}
                            >
                              {cheque.type === "OUT" ? "Emitido" : "Recibido"}
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                            <div className="space-y-1">
                              <p className="font-medium text-gray-600">Banco</p>
                              <p className="text-gray-900 break-words">
                                {cheque.bank}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-medium text-gray-600">Monto</p>
                              <p className="font-semibold text-green-700 text-base">
                                {formatCurrency(cheque.amount)}
                              </p>
                            </div>

                            <div className="space-y-1">
                              {cheque.type === "OUT" ? (
                                <p className="font-medium text-gray-600">
                                  Vencimiento
                                </p>
                              ) : (
                                <p className="font-medium text-gray-600">
                                  Acreditacion
                                </p>
                              )}
                              <p className="text-gray-900">
                                {DateTime.fromISO(cheque.due_date).toFormat(
                                  "dd/MM/yyyy"
                                )}
                              </p>
                            </div>

                            <div className="space-y-1">
                              <p className="font-medium text-gray-600">
                                Movimiento ID
                              </p>
                              <p className="text-gray-900 break-all">
                                {cheque.movement_id}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="sticky bottom-0 bg-white px-4 sm:px-6 py-4">
                  <Button
                    onClick={() => setIsModalPaychecksOpen(false)}
                    className="w-full sm:w-auto sm:mx-auto sm:block"
                  >
                    Cerrar
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  );
}
