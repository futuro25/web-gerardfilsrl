import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import React from "react";
import { saveAs } from "file-saver";

import { useQueryClient, useQuery } from "@tanstack/react-query";
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

const MONTH_NAMES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const generatePeriodOptions = (startYear = 2025) => {
  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const periods = [];

  for (let year = startYear; year <= endYear; year += 1) {
    const monthLimit = year === endYear ? endMonth : 11;
    for (let month = 0; month <= monthLimit; month += 1) {
      const value = `${year}-${String(month + 1).padStart(2, "0")}`;
      const label = `${MONTH_NAMES[month]} ${year}`;
      periods.push({ value, label });
    }
  }

  return periods;
};

const REPORT_OPTIONS = [
  { value: "ventasCbte", label: "Ventas Cbte" },
  { value: "comprasCbte", label: "Compras Cbte" },
  { value: "ventasAlicuotas", label: "Ventas Alícuotas" },
  { value: "comprasAlicuotas", label: "Compras Alícuotas" },
];

const LibroIVAExport = () => {
  const navigate = useNavigate();
  const [fromDate, setFromDate] = React.useState("");
  const [toDate, setToDate] = React.useState("");
  const [selectedPeriod, setSelectedPeriod] = React.useState("");
  const [selectedReportType, setSelectedReportType] = React.useState("");

  const queryClient = useQueryClient();

  const periodOptions = React.useMemo(() => generatePeriodOptions(), []);
  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
      }),
    []
  );

  const updateDateRange = React.useCallback((period) => {
    if (!period) {
      setFromDate("");
      setToDate("");
      return;
    }

    const [year, month] = period.split("-");
    const monthIndex = Number(month) - 1;
    const yearNumber = Number(year);

    const startDate = new Date(yearNumber, monthIndex, 1);
    const endDate = new Date(yearNumber, monthIndex + 1, 0);

    const formattedStart = startDate.toISOString().slice(0, 10);
    const formattedEnd = endDate.toISOString().slice(0, 10);

    setFromDate(formattedStart);
    setToDate(formattedEnd);
  }, []);

  React.useEffect(() => {
    updateDateRange(selectedPeriod);
  }, [selectedPeriod, updateDateRange]);

  const fetchVentas = React.useCallback(
    () => useBooksIVAVentasComprobantesQuery(fromDate, toDate),
    [fromDate, toDate]
  );
  const fetchCompras = React.useCallback(
    () => useBooksIVAComprasComprobantesQuery(fromDate, toDate),
    [fromDate, toDate]
  );

  const reportConfigs = React.useMemo(
    () => ({
      ventasCbte: {
        label: "Ventas Cbte",
        queryKey: queryBooksVentasCbteKey,
        fetchFn: fetchVentas,
        isAlicuota: false,
      },
      comprasCbte: {
        label: "Compras Cbte",
        queryKey: queryBooksComprasCbteKey,
        fetchFn: fetchCompras,
        isAlicuota: false,
      },
      ventasAlicuotas: {
        label: "Ventas Alícuotas",
        queryKey: queryBooksVentasAlicuotaKey,
        fetchFn: fetchVentas,
        isAlicuota: true,
      },
      comprasAlicuotas: {
        label: "Compras Alícuotas",
        queryKey: queryBooksComprasAlicuotaKey,
        fetchFn: fetchCompras,
        isAlicuota: true,
      },
    }),
    [fetchCompras, fetchVentas]
  );

  const selectedReportConfig = selectedReportType
    ? reportConfigs[selectedReportType]
    : null;

  const {
    data: reportData = [],
    isLoading: isLoadingReport,
    error: errorReport,
  } = useQuery({
    queryKey: selectedReportConfig
      ? [...selectedReportConfig.queryKey(), fromDate, toDate]
      : ["BooksReport", "idle"],
    queryFn: () =>
      selectedReportConfig ? selectedReportConfig.fetchFn() : Promise.resolve([]),
    enabled: Boolean(selectedReportConfig && fromDate && toDate),
  });

  const ensureDataFor = React.useCallback(
    async (type) => {
      const config = reportConfigs[type];
      if (!config) {
        return [];
      }

      return await queryClient.ensureQueryData({
        queryKey: [...config.queryKey(), fromDate, toDate],
        queryFn: config.fetchFn,
      });
    },
    [fromDate, toDate, queryClient, reportConfigs]
  );

  const isAlicuotaView = selectedReportConfig?.isAlicuota;

  const comprobanteRows = React.useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || isAlicuotaView) {
      return [];
    }

    return reportData.map((item, index) => {
      const counterparty = item?.supplier || item?.customer || {};
      const identifier =
        item?.id ||
        item?.reference ||
        `${counterparty?.id || counterparty?.cuit || "row"}-${index}`;

      return {
        id: identifier,
        date: item?.date,
        reference: item?.reference || "-",
        counterpartyName: counterparty?.name || "-",
        amount: item?.amount ?? 0,
        taxes: Array.isArray(item?.taxes) ? item.taxes : [],
      };
    });
  }, [reportData, isAlicuotaView]);

  const alicuotaRows = React.useMemo(() => {
    if (!reportData || !Array.isArray(reportData) || !isAlicuotaView) {
      return [];
    }

    return reportData.map((item, index) => {
      const counterparty = item?.supplier || item?.customer || {};
      const taxesArray = Array.isArray(item?.taxes) ? item.taxes : [];

      const taxes = taxesArray.reduce((acc, tax) => {
        const label = tax?.name || "Impuesto";
        const amount = Number(tax?.amount) || 0;
        acc[label] = (acc[label] || 0) + amount;
        return acc;
      }, {});

      return {
        id:
          item?.id ||
          item?.reference ||
          `${counterparty?.id || counterparty?.cuit || "row"}-${index}`,
        date: item?.date,
        reference: item?.reference || "-",
        counterpartyName: counterparty?.name || "-",
        baseAmount: Number(item?.amount) || 0,
        taxes,
      };
    });
  }, [reportData, isAlicuotaView]);

  const alicuotaTaxLabels = React.useMemo(() => {
    if (!isAlicuotaView) {
      return [];
    }

    const labels = new Set();
    alicuotaRows.forEach((row) => {
      Object.keys(row.taxes || {}).forEach((label) => labels.add(label));
    });

    return Array.from(labels);
  }, [alicuotaRows, isAlicuotaView]);

  const formatDisplayDate = React.useCallback((value) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString("es-AR");
  }, []);

  const taxColumnLabels = React.useMemo(() => {
    if (isAlicuotaView) {
      return [];
    }

    const labels = new Set();
    comprobanteRows.forEach((row) => {
      row.taxes.forEach((tax) => {
        const label = tax?.name || "Impuesto";
        labels.add(label);
      });
    });

    return Array.from(labels);
  }, [comprobanteRows, isAlicuotaView]);

  const comprobanteTotals = React.useMemo(() => {
    if (isAlicuotaView || !comprobanteRows.length) {
      return null;
    }

    const taxTotals = Object.fromEntries(
      taxColumnLabels.map((label) => [label, 0])
    );

    const amountTotal = comprobanteRows.reduce((sum, row) => {
      const amount = Number(row.amount) || 0;

      row.taxes.forEach((tax) => {
        const label = tax?.name || "Impuesto";
        const taxAmount = Number(tax?.amount) || 0;
        if (Object.prototype.hasOwnProperty.call(taxTotals, label)) {
          taxTotals[label] += taxAmount;
        } else {
          taxTotals[label] = taxAmount;
        }
      });

      return sum + amount;
    }, 0);

    return { amountTotal, taxTotals };
  }, [comprobanteRows, isAlicuotaView, taxColumnLabels]);

  const alicuotaTotals = React.useMemo(() => {
    if (!isAlicuotaView || !alicuotaRows.length) {
      return null;
    }

    const taxTotals = Object.fromEntries(
      alicuotaTaxLabels.map((label) => [label, 0])
    );

    const baseTotal = alicuotaRows.reduce((sum, row) => {
      const base = Number(row.baseAmount) || 0;
      Object.entries(row.taxes || {}).forEach(([label, amount]) => {
        const numericAmount = Number(amount) || 0;
        if (Object.prototype.hasOwnProperty.call(taxTotals, label)) {
          taxTotals[label] += numericAmount;
        } else {
          taxTotals[label] = numericAmount;
        }
      });
      return sum + base;
    }, 0);

    return { baseTotal, taxTotals };
  }, [alicuotaRows, isAlicuotaView, alicuotaTaxLabels]);

  const Loader = () => (
    <div className="flex items-center gap-3 text-sm text-gray-500">
      <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-gray-600" />
      Cargando resultados...
    </div>
  );


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
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_CBTE.txt descargado");
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
    alert("Archivo LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS.txt descargado");
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
        <div className="bg-white space-y-6 flex flex-col justify-start items-start w-full">
          <div className="flex flex-col gap-4 w-full">
            <div className="flex flex-col gap-4 w-full lg:flex-row lg:items-center lg:justify-between">
              <h2 className="flex items-center pt-2 font-semibold text-gray-800 lg:w-[250px]">
                Seleccionar Mes y Año
              </h2>
              <div className="flex flex-col gap-4 w-full lg:flex-row lg:items-center lg:justify-between">
                <form className="flex flex-wrap gap-3">
                  <div className="flex w-[250px]">
                    <select
                      id="period"
                      name="period"
                      value={selectedPeriod}
                      onChange={(e) => {
                        setSelectedPeriod(e.target.value);
                        setSelectedReportType("");
                      }}
                      className="mt-1 block w-full h-12 border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                      <option value="">Seleccionar periodo</option>
                      {periodOptions.map((period) => (
                        <option key={period.value} value={period.value}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex w-[250px]">
                    <select
                      id="reportType"
                      name="reportType"
                      value={selectedReportType}
                      onChange={(e) => setSelectedReportType(e.target.value)}
                      className="mt-1 block w-full h-12 border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      disabled={!selectedPeriod}
                    >
                      <option value="">Seleccionar tipo</option>
                      {REPORT_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </form>

                <div className="flex items-center gap-2 ml-auto">
                  <button
                    onClick={() => alert("Proximamente")}
                    className="border text-xs font-medium text-gray-600 px-3 py-2 rounded-md hover:bg-gray-900 hover:text-white transition shadow-sm bg-white"
                  >
                    Exportar IVA Ventas Cbte
                  </button>
                  <button
                    onClick={async () => {
                      if (!fromDate || !toDate) {
                        alert("Por favor, selecciona un mes y año.");
                        return;
                      }

                      try {
                        const compras = await ensureDataFor("comprasCbte");
                        exportComprasTxt(compras);
                      } catch (error) {
                        alert("Error al obtener los comprobantes de compras");
                        console.error(error);
                      }
                    }}
                    className="border text-xs font-medium text-gray-600 px-3 py-2 rounded-md hover:bg-gray-900 hover:text-white transition shadow-sm bg-white"
                  >
                    Exportar IVA Compras Cbte
                  </button>
                  <button
                    onClick={() => alert("Proximamente")}
                    className="border text-xs font-medium text-gray-600 px-3 py-2 rounded-md hover:bg-gray-900 hover:text-white transition shadow-sm bg-white"
                  >
                    Exportar IVA Ventas Alícuotas
                  </button>
                  <button
                    onClick={async () => {
                      if (!fromDate || !toDate) {
                        alert("Por favor, selecciona un mes y año.");
                        return;
                      }

                      try {
                        const compras = await ensureDataFor("comprasAlicuotas");
                        exportComprasAlicuotasTxt(compras);
                      } catch (error) {
                        alert("Error al obtener las alícuotas de compras");
                        console.error(error);
                      }
                    }}
                    className="border text-xs font-medium text-gray-600 px-3 py-2 rounded-md hover:bg-gray-900 hover:text-white transition shadow-sm bg-white"
                  >
                    Exportar IVA Compras Alícuotas
                  </button>
                </div>
              </div>
            </div>
            {fromDate && toDate ? (
              <div className="text-xs text-gray-500">
                Periodo seleccionado: {fromDate} al {toDate}
              </div>
            ) : null}
          </div>
        <div className="w-full space-y-4">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <h3 className="text-lg font-semibold text-gray-700">
              {selectedReportConfig?.label || "Resultados"}
            </h3>
            {selectedReportType ? (
              <span className="text-xs text-gray-500">
                Mostrando datos para {selectedReportConfig?.label || "-"}
              </span>
            ) : null}
          </div>
          {!selectedPeriod ? (
            <p className="text-sm text-gray-500">
              Seleccioná un mes y año para ver los resultados.
            </p>
          ) : !selectedReportType ? (
            <p className="text-sm text-gray-500">
              Seleccioná un tipo de reporte para ver los resultados.
            </p>
          ) : isLoadingReport ? (
            <Loader />
          ) : errorReport ? (
            <p className="text-sm text-red-600">
              Ocurrió un error al cargar los datos del reporte.
            </p>
          ) : isAlicuotaView ? (
            alicuotaRows.length === 0 ? (
              <p className="text-sm text-gray-500">
                No se encontraron resultados para el periodo seleccionado.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Fecha
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Comprobante
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Contraparte
                      </th>
                      <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Base
                      </th>
                      {alicuotaTaxLabels.length ? (
                        alicuotaTaxLabels.map((label) => (
                          <th
                            key={`alicuota-header-${label}`}
                            className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider"
                          >
                            {label}
                          </th>
                        ))
                      ) : (
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                          Taxes
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200 text-sm">
                    {alicuotaRows.map((row) => (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-gray-700">
                          {formatDisplayDate(row.date)}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.reference}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.counterpartyName}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {currencyFormatter.format(row.baseAmount || 0)}
                        </td>
                        {alicuotaTaxLabels.length ? (
                          alicuotaTaxLabels.map((label) => (
                            <td
                              key={`${row.id}-alicuota-${label}`}
                              className="px-4 py-2 text-right text-gray-700"
                            >
                              {Object.prototype.hasOwnProperty.call(
                                row.taxes || {},
                                label
                              )
                                ? currencyFormatter.format(
                                    row.taxes?.[label] || 0
                                  )
                                : "-"}
                            </td>
                          ))
                        ) : (
                          <td className="px-4 py-2 text-gray-700">
                            <span className="text-gray-400">Sin impuestos</span>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {alicuotaTotals ? (
                    <tfoot className="bg-gray-100">
                      <tr>
                        <td
                          colSpan={3}
                          className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600"
                        >
                          Totales
                        </td>
                        <td className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                          {currencyFormatter.format(alicuotaTotals.baseTotal)}
                        </td>
                        {alicuotaTaxLabels.length ? (
                          alicuotaTaxLabels.map((label) => (
                            <td
                              key={`alicuota-total-${label}`}
                              className="px-4 py-2 text-right text-sm font-semibold text-gray-700"
                            >
                              {currencyFormatter.format(
                                alicuotaTotals.taxTotals[label] || 0
                              )}
                            </td>
                          ))
                        ) : (
                          <td className="px-4 py-2 text-center text-sm text-gray-500">
                            -
                          </td>
                        )}
                      </tr>
                    </tfoot>
                  ) : null}
                </table>
              </div>
            )
          ) : comprobanteRows.length === 0 ? (
            <p className="text-sm text-gray-500">
              No se encontraron resultados para el periodo seleccionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Fecha
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Comprobante
                    </th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Contraparte
                    </th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider">
                      Importe
                    </th>
                    {taxColumnLabels.length ? (
                      taxColumnLabels.map((label) => (
                        <th
                          key={`header-${label}`}
                          className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase tracking-wider"
                        >
                          {label}
                        </th>
                      ))
                    ) : (
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">
                        Taxes
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200 text-sm">
                  {comprobanteRows.map((row) => {
                    const taxMap = new Map(
                      row.taxes.map((tax) => [
                        tax?.name || "Impuesto",
                        tax?.amount ?? 0,
                      ])
                    );

                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-2 text-gray-700">
                          {formatDisplayDate(row.date)}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.reference}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {row.counterpartyName}
                        </td>
                        <td className="px-4 py-2 text-right text-gray-700">
                          {currencyFormatter.format(row.amount || 0)}
                        </td>
                        {taxColumnLabels.length ? (
                          taxColumnLabels.map((label) => (
                            <td
                              key={`${row.id}-tax-${label}`}
                              className="px-4 py-2 text-right text-gray-700"
                            >
                              {taxMap.has(label)
                                ? currencyFormatter.format(
                                    taxMap.get(label) || 0
                                  )
                                : "-"}
                            </td>
                          ))
                        ) : (
                          <td className="px-4 py-2 text-gray-700">
                            <span className="text-gray-400">Sin impuestos</span>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
                {comprobanteTotals ? (
                  <tfoot className="bg-gray-100">
                    <tr>
                      <td
                        colSpan={3}
                        className="px-4 py-2 text-right text-xs font-semibold uppercase text-gray-600"
                      >
                        Totales
                      </td>
                      <td className="px-4 py-2 text-right text-sm font-semibold text-gray-700">
                        {currencyFormatter.format(comprobanteTotals.amountTotal)}
                      </td>
                      {taxColumnLabels.length ? (
                        taxColumnLabels.map((label) => (
                          <td
                            key={`total-${label}`}
                            className="px-4 py-2 text-right text-sm font-semibold text-gray-700"
                          >
                            {currencyFormatter.format(
                              comprobanteTotals.taxTotals[label] || 0
                            )}
                          </td>
                        ))
                      ) : (
                        <td className="px-4 py-2 text-center text-sm text-gray-500">
                          -
                        </td>
                      )}
                    </tr>
                  </tfoot>
                ) : null}
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};

export default LibroIVAExport;
