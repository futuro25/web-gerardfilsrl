import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import React from "react";
import { saveAs } from "file-saver";

import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import {
  useBooksIVAComprasComprobantesQuery,
  useBooksIVAVentasComprobantesQuery,
} from "../apis/api.books";
import {
  queryBooksVentasCbteKey,
  queryBooksComprasCbteKey,
  queryBooksVentasAlicuotaKey,
  queryBooksComprasAlicuotaKey,
} from "../apis/queryKeys";

const LibroIVAExport = () => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");

  const queryClient = useQueryClient();

  const fetchCompras = async () => {
    return await useBooksIVAComprasComprobantesQuery(fromDate, toDate);
  };

  const fetchVentas = async () => {
    return await useBooksIVAVentasComprobantesQuery(fromDate, toDate);
  };
  // console.log("fromDate:", fromDate);

  // console.log("toDate:", toDate);
  // const {
  //   data: compras,
  //   isLoadingCompras,
  //   errorCompras,
  // } = useQuery({
  //   queryKey: queryBooksComprasCbteKey(),
  //   queryFn: () => useBooksIVAComprasComprobantesQuery(fromDate, toDate),
  // });

  // const {
  //   data: ventas,
  //   isLoadingVentas,
  //   errorVentas,
  // } = useQuery({
  //   queryKey: queryBooksVentasCbteKey(),
  //   queryFn: () => useBooksIVAVentasComprobantesQuery(fromDate, toDate),
  // });

  const formatNumber = (value, length = 15) => {
    const num = Math.round(Math.abs(value) * 100).toString();
    return num.padStart(length, "0");
  };

  const formatDate = (isoDate) => {
    const date = new Date(isoDate);
    return date.toISOString().slice(0, 10).replace(/-/g, "");
  };

  const pad = (value, length, type = "text") => {
    const str = value?.toString() || "";
    return type === "text"
      ? str.padEnd(length, " ")
      : str.padStart(length, "0");
  };

  const getTipoComprobante = (ref) => {
    const letra = ref?.charAt(0);
    if (letra === "A") return "001";
    if (letra === "B") return "006";
    if (letra === "C") return "011";
    if (letra === "M") return "112";
    if (letra === "X") return "099";
    if (letra === "T") return "081";
    return "000";
  };

  const getAlicuotaCode = (valor) => {
    // Puedes adaptar si tenés más tasas diferenciadas
    if (valor === 0.105) return "0005";
    if (valor === 0.27) return "0003";
    return "0004"; // 21% (por defecto)
  };

  const exportComprasTxt = (data) => {
    if (fromDate === "" || toDate === "") {
      alert("Por favor, selecciona un rango de fechas.");
      return;
    }
    const lines = data.map((item) => {
      const { reference, date, supplier, amount, taxes } = item;

      const tipoComprobante = getTipoComprobante(reference);
      const puntoVenta = reference?.slice(1, 5) || "0000";
      const numeroComprobante = reference?.slice(6) || "0";

      const cuit = pad(supplier?.id?.toString(), 11, "number");
      const nombre = pad(supplier?.name || "", 30);

      const total = formatNumber(amount);
      const noGravado = formatNumber(0);
      const exento = formatNumber(0);

      const iva = taxes.find((t) => t.name === "IVA")?.amount || 0;
      const percIVA = taxes.find((t) => t.name === "PERC IVA")?.amount || 0;
      const percIIBB = taxes.find((t) => t.name === "PERC IIBB")?.amount || 0;

      const otrosImpNac = formatNumber(0);
      const iibb = formatNumber(percIIBB);
      const muni = formatNumber(0);
      const internos = formatNumber(0);

      const moneda = "PES";
      const tipoCambio = "0000100000";

      const cantAlicuotas = "1";
      const codOperacion = "0";
      const creditoFiscal = formatNumber(iva);
      const otrosTributos = formatNumber(percIVA);

      const cuitCorredor = pad("", 11, "number");
      const nombreCorredor = pad("", 30);
      const ivaComision = formatNumber(0);

      return [
        formatDate(date), // 1 Fecha comprobante
        tipoComprobante, // 2 Tipo de comprobante
        pad(puntoVenta, 5, "number"), // 3 Punto de venta
        pad(numeroComprobante, 20, "number"), // 4 Nro comprobante
        "".padEnd(16), // 5 Despacho de importación
        "80", // 6 Código doc vendedor (80 = CUIT)
        pad(cuit, 20, "number"), // 7 CUIT vendedor
        nombre, // 8 Nombre vendedor
        total, // 9 Total operación
        noGravado, // 10 No gravado
        exento, // 11 Exento
        formatNumber(iva), // 12 Perc IVA
        otrosImpNac, // 13 Otros imp. nac.
        iibb, // 14 Perc IIBB
        muni, // 15 Imp. municipales
        internos, // 16 Imp. internos
        moneda, // 17 Moneda
        tipoCambio, // 18 Tipo de cambio
        cantAlicuotas, // 19 Cantidad de alícuotas
        codOperacion, // 20 Código operación
        creditoFiscal, // 21 Crédito fiscal
        otrosTributos, // 22 Otros tributos
        cuitCorredor, // 23 CUIT corredor
        nombreCorredor, // 24 Nombre corredor
        ivaComision, // 25 IVA comisión
      ].join("");
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });

    saveAs(blob, "LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt");
<<<<<<< Updated upstream
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt descargado")
=======
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt descargado");
>>>>>>> Stashed changes
  };

  const exportComprasAlicuotasTxt = (data) => {
    if (fromDate === "" || toDate === "") {
      alert("Por favor, selecciona un rango de fechas.");
      return;
    }
    const lines = data.flatMap((item) => {
      const { reference, taxes, supplier } = item;

      const tipoComprobante = getTipoComprobante(reference);
      const puntoVenta = reference?.slice(1, 5) || "0000";
      const numeroComprobante = reference?.slice(6) || "0";

      const tipoDoc = "80"; // CUIT
      const cuit = pad(supplier?.id?.toString(), 11, "number");

      const iva = taxes.find((t) => t.name === "IVA");
      if (!iva) return [];

      const impuestoLiquidado = iva.amount;
      const netoGravado = item.amount + impuestoLiquidado;
      const alicuota = getAlicuotaCode(impuestoLiquidado / netoGravado);

      return [
        tipoComprobante.padStart(3, "0"), // 1 Tipo comprobante
        pad(puntoVenta, 5, "number"), // 2 Punto de venta
        pad(numeroComprobante, 20, "number"), // 3 Número comprobante
        tipoDoc.padStart(2, "0"), // 4 Código documento vendedor
        pad(cuit, 20, "number"), // 5 CUIT vendedor
        formatNumber(netoGravado), // 6 Neto gravado
        alicuota, // 7 Alícuota
        formatNumber(impuestoLiquidado), // 8 Impuesto liquidado
      ].join("");
    });

    const blob = new Blob([lines.join("\n")], {
      type: "text/plain;charset=utf-8",
    });

    saveAs(blob, "LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt");
<<<<<<< Updated upstream
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt descargado")
=======
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt descargado");
>>>>>>> Stashed changes
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Libros</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center gap-4 p-4 bg-white shadow rounded-md">
        <div className="max-w-xl mx-auto p-6 bg-white space-y-6">
          <h2 className="text-xl font-semibold text-gray-800 text-center">
            Seleccionar Rango de Fechas
          </h2>

          <form className="space-y-4">
            <div>
              <label
                htmlFor="fromDate"
                className="block text-sm font-medium text-gray-700"
              >
                Desde
              </label>
              <input
                type="date"
                id="fromDate"
                name="fromDate"
                className="mt-1 block w-full h-12 border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>

            <div>
              <label
                htmlFor="toDate"
                className="block text-sm font-medium text-gray-700"
              >
                Hasta
              </label>
              <input
                type="date"
                id="toDate"
                name="toDate"
                className="mt-1 block w-full h-12 border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </form>
        </div>
        <button
          onClick={() => alert("Proximamente")}
          className="border text-gray-600 px-4 py-2 rounded-md hover:bg-gray-900 hover:text-white transition min-w-[300px] shadow-lg bg-white"
        >
          Exportar IVA Ventas Cbte
        </button>
        <button
<<<<<<< Updated upstream
          onClick={() => exportComprasTxt(compras)}
=======
          onClick={async () => {
            if (!fromDate || !toDate) {
              alert("Por favor, selecciona un rango de fechas.");
              return;
            }

            try {
              const compras = await queryClient.fetchQuery({
                queryKey: queryBooksComprasCbteKey(),
                queryFn: fetchCompras,
              });
              exportComprasTxt(compras);
            } catch (error) {
              alert("Error al obtener los comprobantes de compras");
              console.error(error);
            }
          }}
>>>>>>> Stashed changes
          className="border text-gray-600 px-4 py-2 rounded-md hover:bg-gray-900 hover:text-white transition min-w-[300px] shadow-lg bg-white"
        >
          Exportar IVA Compras Cbte
        </button>
        <button
          onClick={() => alert("Proximamente")}
          className="border text-gray-600 px-4 py-2 rounded-md hover:bg-gray-900 hover:text-white transition min-w-[300px] shadow-lg bg-white"
        >
          Exportar IVA Ventas Alícuotas
        </button>
        <button
<<<<<<< Updated upstream
          onClick={() => exportComprasAlicuotasTxt(compras)}
=======
          onClick={async () => {
            if (!fromDate || !toDate) {
              alert("Por favor, selecciona un rango de fechas.");
              return;
            }

            try {
              const compras = await queryClient.fetchQuery({
                queryKey: queryBooksComprasCbteKey(),
                queryFn: fetchCompras,
              });
              exportComprasAlicuotasTxt(compras);
            } catch (error) {
              alert("Error al obtener las alícuotas de compras");
              console.error(error);
            }
          }}
>>>>>>> Stashed changes
          className="border text-gray-600 px-4 py-2 rounded-md hover:bg-gray-900 hover:text-white transition min-w-[300px] shadow-lg bg-white"
        >
          Exportar IVA Compras Alícuotas
        </button>
      </div>
    </div>
  );
};

export default LibroIVAExport;
