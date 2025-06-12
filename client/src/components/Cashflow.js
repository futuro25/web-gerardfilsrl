import { useNavigate } from "react-router-dom";
import { HouseIcon, PlusIcon, SearchIcon, UsersIcon } from "lucide-react";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import React, { useState, useEffect } from "react";
import Button from "./common/Button";
import { Input } from "./common/Input";
import { Badge } from "./common/Badge";
import { Card, CardContent } from "./common/Card";

const mockMovements = [
  {
    id: "1",
    date: "5/18/2025",
    description: "Venta de productos",
    category: "Ventas",
    amount: 150000,
    type: "ingreso",
    provider: "Cliente ABC",
    reference: "FAC-001",
  },
  {
    id: "2",
    date: "6/2/2025",
    description: "Pago de servicios",
    category: "Servicios",
    amount: -45000,
    type: "egreso",
    provider: "Empresa XYZ",
    reference: "REC-002",
  },
  {
    id: "3",
    date: "6/9/2025",
    description: "Consultoría",
    category: "Servicios profesionales",
    amount: 280000,
    type: "ingreso",
    provider: "Consultora DEF",
    reference: "FAC-003",
  },
  {
    id: "4",
    date: "6/15/2025",
    description: "Compra de materiales",
    category: "Materiales",
    amount: -75000,
    type: "egreso",
    provider: "Proveedor GHI",
    reference: "FAC-004",
  },
  {
    id: "5",
    date: "6/20/2025",
    description: "Honorarios",
    category: "Servicios profesionales",
    amount: 320000,
    type: "ingreso",
    provider: "Cliente JKL",
    reference: "FAC-005",
  },
];

export default function Cashflow() {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedType, setSelectedType] = useState("all");

  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const navigate = useNavigate();

  const filteredMovements = mockMovements.filter((movement) => {
    const matchesSearch =
      movement.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.provider?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      movement.category.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType =
      selectedType === "all" || movement.type === selectedType;

    return matchesSearch && matchesType;
  });

  const totalIngresos = mockMovements
    .filter((m) => m.type === "ingreso")
    .reduce((sum, m) => sum + m.amount, 0);

  const totalEgresos = mockMovements
    .filter((m) => m.type === "egreso")
    .reduce((sum, m) => sum + Math.abs(m.amount), 0);

  const totalCashflow = filteredMovements.reduce((sum, m) => {
    return sum + (m.type === "ingreso" ? m.amount : -Math.abs(m.amount));
  }, 0);

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
              setSelectedType(selectedType === "egreso" ? "all" : "egreso")
            }
          >
            <div className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 mx-auto bg-red-100 rounded-full flex items-center justify-center">
                <HouseIcon className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="font-medium text-gray-900 mb-1">Ingresos</h3>
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

          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              Total de movimientos: {filteredMovements.length}
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
          {filteredMovements.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <p className="text-gray-500">No se encontraron movimientos</p>
              </CardContent>
            </Card>
          ) : (
            filteredMovements.map((movement) => (
              <Card
                key={movement.id}
                className="hover:shadow-md transition-shadow"
              >
                <CardContent className="!p-2">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-medium text-gray-900">
                          {movement.description}
                        </h3>
                        <Badge
                          variant={
                            movement.type === "ingreso"
                              ? "default"
                              : "destructive"
                          }
                          className={
                            movement.type === "ingreso"
                              ? "bg-green-100 text-green-800 hover:bg-green-100"
                              : "bg-red-100 text-red-800 hover:bg-red-100"
                          }
                        >
                          {movement.type === "ingreso" ? "Ingreso" : "Egreso"}
                        </Badge>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center gap-4 text-sm text-gray-600">
                          <span>{movement.date}</span>
                          <span>{movement.category}</span>
                        </div>

                        {movement.provider && (
                          <p className="text-sm text-gray-600">
                            {movement.provider}
                          </p>
                        )}

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
                          movement.type === "ingreso"
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {movement.type === "ingreso" ? "+" : "-"}
                        {formatCurrency(movement.amount)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}

          {filteredMovements.length > 0 && (
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
      </div>
    </div>
  );
}
