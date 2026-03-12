import { useNavigate } from "react-router-dom";
import { ArrowLeftIcon, DocumentArrowDownIcon } from "@heroicons/react/24/solid";
import React from "react";
import { saveAs } from "file-saver";

const START_YEAR = 2025;

const generateYearOptions = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = START_YEAR; year <= currentYear; year++) {
    years.push(year);
  }
  return years;
};

const FiscalExports = () => {
  const navigate = useNavigate();
  const [selectedYear, setSelectedYear] = React.useState(new Date().getFullYear());
  const yearOptions = React.useMemo(() => generateYearOptions(), []);
  const [loading, setLoading] = React.useState({
    comprasCbte: false,
    comprasAlicuotas: false,
    ventasCbte: false,
    ventasAlicuotas: false,
    retenciones: false,
  });
  const [results, setResults] = React.useState({
    comprasCbte: null,
    comprasAlicuotas: null,
    ventasCbte: null,
    ventasAlicuotas: null,
    retenciones: null,
  });

  const formatNumber = (value, length = 15) => {
    const num = Math.round(Math.abs(value || 0) * 100).toString();
    return num.padStart(length, "0");
  };

  const formatDate = (isoDate) => {
    if (!isoDate) return "00000000";
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
    if (valor === 0.105) return "0005";
    if (valor === 0.27) return "0003";
    return "0004";
  };

  const fetchComprasAnual = async () => {
    const fromDate = `${selectedYear}-01-01`;
    const toDate = `${selectedYear}-12-31`;
    const response = await fetch(
      `/api/books/compras/comprobantes?from=${fromDate}&to=${toDate}`
    );
    return response.json();
  };

  const fetchVentasAnual = async () => {
    const fromDate = `${selectedYear}-01-01`;
    const toDate = `${selectedYear}-12-31`;
    const response = await fetch(
      `/api/books/ventas/comprobantes?from=${fromDate}&to=${toDate}`
    );
    return response.json();
  };

  const fetchRetencionesAnual = async () => {
    const response = await fetch(
      `/api/retention-certificates/payments`
    );
    const data = await response.json();
    return data.filter((item) => {
      const date = new Date(item.issue_date);
      return date.getFullYear() === selectedYear;
    });
  };

  const exportComprasCbteTxt = async () => {
    setLoading((prev) => ({ ...prev, comprasCbte: true }));
    try {
      const data = await fetchComprasAnual();
      if (data.error) throw new Error(data.error);

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

        const iva = taxes?.find((t) => t.name === "IVA")?.amount || 0;
        const percIVA = taxes?.find((t) => t.name === "PERC IVA")?.amount || 0;
        const percIIBB = taxes?.find((t) => t.name === "PERC IIBB")?.amount || 0;

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
          formatDate(date),
          tipoComprobante,
          pad(puntoVenta, 5, "number"),
          pad(numeroComprobante, 20, "number"),
          "".padEnd(16),
          "80",
          pad(cuit, 20, "number"),
          nombre,
          total,
          noGravado,
          exento,
          formatNumber(iva),
          otrosImpNac,
          iibb,
          muni,
          internos,
          moneda,
          tipoCambio,
          cantAlicuotas,
          codOperacion,
          creditoFiscal,
          otrosTributos,
          cuitCorredor,
          nombreCorredor,
          ivaComision,
        ].join("");
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `LIBRO_IVA_DIGITAL_COMPRAS_CBTE_${selectedYear}.txt`);
      setResults((prev) => ({
        ...prev,
        comprasCbte: { success: true, count: data.length },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        comprasCbte: { success: false, error: error.message },
      }));
    }
    setLoading((prev) => ({ ...prev, comprasCbte: false }));
  };

  const exportComprasAlicuotasTxt = async () => {
    setLoading((prev) => ({ ...prev, comprasAlicuotas: true }));
    try {
      const data = await fetchComprasAnual();
      if (data.error) throw new Error(data.error);

      const lines = data.flatMap((item) => {
        const { reference, taxes, supplier } = item;

        const tipoComprobante = getTipoComprobante(reference);
        const puntoVenta = reference?.slice(1, 5) || "0000";
        const numeroComprobante = reference?.slice(6) || "0";

        const tipoDoc = "80";
        const cuit = pad(supplier?.id?.toString(), 11, "number");

        const iva = taxes?.find((t) => t.name === "IVA");
        if (!iva) return [];

        const impuestoLiquidado = iva.amount;
        const netoGravado = item.amount + impuestoLiquidado;
        const alicuota = getAlicuotaCode(impuestoLiquidado / netoGravado);

        return [
          tipoComprobante.padStart(3, "0"),
          pad(puntoVenta, 5, "number"),
          pad(numeroComprobante, 20, "number"),
          tipoDoc.padStart(2, "0"),
          pad(cuit, 20, "number"),
          formatNumber(netoGravado),
          alicuota,
          formatNumber(impuestoLiquidado),
        ].join("");
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_${selectedYear}.txt`);
      setResults((prev) => ({
        ...prev,
        comprasAlicuotas: { success: true, count: lines.length },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        comprasAlicuotas: { success: false, error: error.message },
      }));
    }
    setLoading((prev) => ({ ...prev, comprasAlicuotas: false }));
  };

  const exportVentasCbteTxt = async () => {
    setLoading((prev) => ({ ...prev, ventasCbte: true }));
    try {
      const data = await fetchVentasAnual();
      if (data.error) throw new Error(data.error);

      const lines = data.map((item) => {
        const { reference, date, client, amount, taxes } = item;

        const tipoComprobante = getTipoComprobante(reference);
        const puntoVenta = reference?.slice(1, 5) || "0000";
        const numeroComprobante = reference?.slice(6) || "0";

        const tipoDoc = client?.cuit ? "80" : "99";
        const cuit = pad(client?.cuit?.toString() || client?.id?.toString() || "", 20, "number");
        const nombre = pad(client?.name || "", 30);

        const total = formatNumber(amount);
        const noGravado = formatNumber(0);
        const exento = formatNumber(0);

        const iva = taxes?.find((t) => t.name === "IVA")?.amount || 0;
        const percIVA = taxes?.find((t) => t.name === "PERC IVA")?.amount || 0;

        const otrosImpNac = formatNumber(percIVA);
        const iibb = formatNumber(0);
        const muni = formatNumber(0);
        const internos = formatNumber(0);

        const moneda = "PES";
        const tipoCambio = "0000100000";

        const cantAlicuotas = iva > 0 ? "1" : "0";
        const codOperacion = " ";

        return [
          formatDate(date),
          tipoComprobante,
          pad(puntoVenta, 5, "number"),
          pad(numeroComprobante, 20, "number"),
          pad(numeroComprobante, 20, "number"),
          tipoDoc,
          cuit,
          nombre,
          total,
          noGravado,
          formatNumber(0),
          exento,
          formatNumber(iva),
          otrosImpNac,
          iibb,
          muni,
          internos,
          moneda,
          tipoCambio,
          cantAlicuotas,
          codOperacion,
          formatNumber(0),
          formatDate(date),
        ].join("");
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `LIBRO_IVA_DIGITAL_VENTAS_CBTE_${selectedYear}.txt`);
      setResults((prev) => ({
        ...prev,
        ventasCbte: { success: true, count: data.length },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        ventasCbte: { success: false, error: error.message },
      }));
    }
    setLoading((prev) => ({ ...prev, ventasCbte: false }));
  };

  const exportVentasAlicuotasTxt = async () => {
    setLoading((prev) => ({ ...prev, ventasAlicuotas: true }));
    try {
      const data = await fetchVentasAnual();
      if (data.error) throw new Error(data.error);

      const lines = data.flatMap((item) => {
        const { reference, taxes } = item;

        const tipoComprobante = getTipoComprobante(reference);
        const puntoVenta = reference?.slice(1, 5) || "0000";
        const numeroComprobante = reference?.slice(6) || "0";

        const iva = taxes?.find((t) => t.name === "IVA");
        if (!iva) return [];

        const impuestoLiquidado = iva.amount;
        const netoGravado = item.amount + impuestoLiquidado;
        const alicuota = getAlicuotaCode(impuestoLiquidado / netoGravado);

        return [
          tipoComprobante.padStart(3, "0"),
          pad(puntoVenta, 5, "number"),
          pad(numeroComprobante, 20, "number"),
          formatNumber(netoGravado),
          alicuota,
          formatNumber(impuestoLiquidado),
        ].join("");
      });

      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS_${selectedYear}.txt`);
      setResults((prev) => ({
        ...prev,
        ventasAlicuotas: { success: true, count: lines.length },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        ventasAlicuotas: { success: false, error: error.message },
      }));
    }
    setLoading((prev) => ({ ...prev, ventasAlicuotas: false }));
  };

  const exportRetencionesSicore = async () => {
    setLoading((prev) => ({ ...prev, retenciones: true }));
    try {
      const data = await fetchRetencionesAnual();
      if (data.error) throw new Error(data.error);

      const lines = data
        .filter((item) => parseFloat(item.retention_amount) > 0)
        .map((item) => {
          const codigoComprobante = "06";
          const fechaEmision = formatDate(item.issue_date);
          const numeroComprobante = pad(item.invoice_number || "", 16);
          const importeComprobante = formatNumber(item.total_amount, 16);
          const codigoImpuesto = "217";
          const codigoRegimen = pad(item.category_code || "0", 3, "number");
          const codigoOperacion = "1";
          const baseCalculo = formatNumber(item.net_amount, 14);
          const fechaEmisionRetencion = formatDate(item.issue_date);
          const codigoCondicion = item.profits_condition === "Inscripto" ? "01" : "02";
          const retencionPracticadaSuspendidos = "0";
          const importeRetencion = formatNumber(item.retention_amount, 14);
          const porcentajeExclusion = "000.00";
          const fechaEmisionBoletin = "00000000";
          const tipoDocRetenido = "80";
          const cuitRetenido = pad(item.supplier_cuit?.toString().replace(/-/g, "") || "", 11, "number");
          const numeroCertificadoOriginal = pad("", 14);
          const denominacionOrdenante = pad("", 30);
          const acrecentamiento = "0";
          const cuitPaisOrdenante = pad("", 11, "number");
          const denominacionPaisOrdenante = pad("", 30);

          return [
            codigoComprobante,
            fechaEmision,
            numeroComprobante,
            importeComprobante,
            codigoImpuesto,
            codigoRegimen,
            codigoOperacion,
            baseCalculo,
            fechaEmisionRetencion,
            codigoCondicion,
            retencionPracticadaSuspendidos,
            importeRetencion,
            porcentajeExclusion,
            fechaEmisionBoletin,
            tipoDocRetenido,
            cuitRetenido,
            numeroCertificadoOriginal,
            denominacionOrdenante,
            acrecentamiento,
            cuitPaisOrdenante,
            denominacionPaisOrdenante,
          ].join("");
        });

      const blob = new Blob([lines.join("\n")], {
        type: "text/plain;charset=utf-8",
      });
      saveAs(blob, `SICORE_RETENCIONES_${selectedYear}.txt`);
      setResults((prev) => ({
        ...prev,
        retenciones: { success: true, count: lines.length },
      }));
    } catch (error) {
      setResults((prev) => ({
        ...prev,
        retenciones: { success: false, error: error.message },
      }));
    }
    setLoading((prev) => ({ ...prev, retenciones: false }));
  };

  const ExportCard = ({ title, description, onExport, loading, result, filename }) => (
    <div className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
          <p className="text-sm text-gray-500 mt-1">{description}</p>
          <p className="text-xs text-gray-400 mt-2">Archivo: {filename}</p>
        </div>
        <DocumentArrowDownIcon className="h-8 w-8 text-gray-400" />
      </div>
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={onExport}
          disabled={loading}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            loading
              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
              : "bg-gray-900 text-white hover:bg-gray-800"
          }`}
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-white" />
              Generando...
            </span>
          ) : (
            "Descargar"
          )}
        </button>
        {result && (
          <span
            className={`text-sm ${
              result.success ? "text-green-600" : "text-red-600"
            }`}
          >
            {result.success
              ? `${result.count} registros exportados`
              : `Error: ${result.error}`}
          </span>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={() => navigate("/home")}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Exportación Fiscal</div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">
                Archivos Fiscales Anuales
              </h2>
              <p className="text-gray-600 mt-2">
                Descargá los archivos de IVA y retenciones en formato compatible con AFIP.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="year-select" className="text-sm font-medium text-gray-700">
                Año:
              </label>
              <select
                id="year-select"
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="block w-24 h-10 px-3 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
              IVA Compras
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ExportCard
                title="Comprobantes"
                description="Libro IVA Digital - Comprobantes de compras"
                onExport={exportComprasCbteTxt}
                loading={loading.comprasCbte}
                result={results.comprasCbte}
                filename={`LIBRO_IVA_DIGITAL_COMPRAS_CBTE_${selectedYear}.txt`}
              />
              <ExportCard
                title="Alícuotas"
                description="Libro IVA Digital - Alícuotas de compras"
                onExport={exportComprasAlicuotasTxt}
                loading={loading.comprasAlicuotas}
                result={results.comprasAlicuotas}
                filename={`LIBRO_IVA_DIGITAL_COMPRAS_ALICUOTAS_${selectedYear}.txt`}
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-green-500 rounded-full"></span>
              IVA Ventas
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ExportCard
                title="Comprobantes"
                description="Libro IVA Digital - Comprobantes de ventas"
                onExport={exportVentasCbteTxt}
                loading={loading.ventasCbte}
                result={results.ventasCbte}
                filename={`LIBRO_IVA_DIGITAL_VENTAS_CBTE_${selectedYear}.txt`}
              />
              <ExportCard
                title="Alícuotas"
                description="Libro IVA Digital - Alícuotas de ventas"
                onExport={exportVentasAlicuotasTxt}
                loading={loading.ventasAlicuotas}
                result={results.ventasAlicuotas}
                filename={`LIBRO_IVA_DIGITAL_VENTAS_ALICUOTAS_${selectedYear}.txt`}
              />
            </div>
          </section>

          <section>
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
              Retenciones
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <ExportCard
                title="SICORE Retenciones"
                description="Archivo de retenciones para importar en SICORE"
                onExport={exportRetencionesSicore}
                loading={loading.retenciones}
                result={results.retenciones}
                filename={`SICORE_RETENCIONES_${selectedYear}.txt`}
              />
            </div>
          </section>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h4 className="text-sm font-semibold text-yellow-800">Nota importante</h4>
          <p className="text-sm text-yellow-700 mt-1">
            Verificá los archivos antes de importarlos en AFIP. Los formatos
            corresponden al Libro IVA Digital (RG 4597) y SICORE (RG 2233).
          </p>
        </div>
      </div>
    </div>
  );
};

export default FiscalExports;
