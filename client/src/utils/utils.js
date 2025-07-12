import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { config } from "../config";

export const featureFlags = [];

export const getFeatureFlagValue = (feature) => {
  return featureFlags.filter((a) => a.feature === feature)[0].isEnabled;
};

export const tw = String.raw;

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const uploadResource = async (data) => {
  const formData = new FormData();
  formData.append("file", data.file[0]);

  const res = await fetch(config.resourcesLink, {
    method: "POST",
    body: formData,
  }).then((res) => res.json());

  return res;
};

export const getInviteLink = (user_id) => {
  return config.inviteLink + user_id;
};

export const delay = (ms) => new Promise((res) => setTimeout(res, ms));

export const getStartOfWeek = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); // Lunes

  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);

  return d;
};

export const getWeekDays = (start) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const days = [...Array(7)].map((_, i) => {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    day.setHours(0, 0, 0, 0);
    return day;
  });

  // Si la semana es la actual, filtramos los días anteriores a hoy
  if (start <= today && today <= addDays(start, 6)) {
    return days.filter((day) => day >= today);
  }

  return days;
};

export const addDays = (date, days) => {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
};

export function formatAmount(numero) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero);
}

export function formatInvoiceNumber(numero) {
  const letra = numero.charAt(0);
  const numeros = numero.slice(1);
  const parte1 = numeros.slice(0, 4);
  const parte2 = numeros.slice(4);
  return `${letra} ${parte1}-${parte2}`.toUpperCase();
}

export function getTaxes() {
  return [
    { type: "IVA", value: "" },
    { type: "INGRESOS BRUTOS", value: "" },
    { type: "PERCEPCION", value: "" },
    { type: "GANANCIAS", value: "" },
  ];
}

export function getPaymentMethods() {
  return ["EFECTIVO", "TRANSFERENCIA BANCARIA", "CHEQUE"];
}

export function getPaycheckString() {
  return getPaymentMethods()[2] || "CHEQUE";
}

export function getBanks() {
  return ["SANTANDER", "BBVA", "GALICIA", "NACION", "CIUDAD"];
}

export function getCashflowInCategories() {
  return ["APORTES", "VENTAS", "COMISIONES", "OTROS"];
}

export function getCashflowOutCategories() {
  return [
    "SERVICIOS",
    "MATERIALES",
    "SUMINISTROS",
    "ALQUILER",
    "TRANSPORTE",
    "IMPUESTOS",
    "GASTOS ADMINISTRATIVOS ",
    "OTROS GASTOS",
  ];
}

export function getExpensesCategories() {
  return [
    "ALQUILER MAQUINARIAS Y EQUIPOS",
    "ALQUILER PLANTA",
    "AMORTIZACIONES ADMINISTRACIÓN",
    "AMORTIZACIONES COMERCIALIZACIÓN",
    "AMORTIZACIONES MAQUINARIAS Y EQUIPOS",
    "CARGAS SOCIALES ADMINISTRACIÓN",
    "CARGAS SOCIALES COMERCIALIZACIÓN",
    "CARGAS SOCIALES FÁBRICA",
    "COMBUSTIBLE",
    "COMIDA DEL PERSONAL",
    "COMISIONES DE TERCEROS",
    "CORRESPONDENCIA",
    "CUOTA MEDICA A CARGO EMPLEADOR",
    "DESCUENTOS OTORGADOS A CLIENTES",
    "DESPIDOS",
    "DESPIDOS ADMINISTRACIÓN",
    "ELEMENTOS DE FARMACIA",
    "ENERGÍA",
    "FLETES",
    "GASTOS DE ADMINISTRACION",
    "GASTOS DE COMERCIALIZACION",
    "GASTOS DE FABRICACION",
    "GASTOS DE LIMPIEZA",
    "GASTOS EXPORTACIÓN",
    "GASTOS VARIOS ADMINISTRACIÓN",
    "GASTOS VARIOS COMERCIALIZACIÓN",
    "HONORARIOS ADMINISTRACIÓN",
    "HONORARIOS COMERCIALIZACIÓN",
    "HONORARIOS INGENIEROS",
    "IMPRODUCTIVIDADES E INEFICIENCIAS",
    "INSUMOS COMPUTACION",
    "INSUMOS DIVERSOS",
    "IVA NO COMPUTABLE",
    "LIBRERÍA Y PAPELERÍA",
    "LUBRICANTES",
    "MANTENIMIENTO EQUIPOS",
    "MANTENIMIENTO ESPECIALIZADO",
    "MATERIALES DE SEGURIDAD",
    "PREMIOS A LA PRODUCCIÓN",
    "PUBLICIDAD",
    "REPARACIONES EN GARANTIA DE PRODUCTOS",
    "REPARACIONES MAQUINARIAS",
    "ROPA DE TRABAJO",
    "SEGURIDAD CONTRATADA",
    "SEGUROS",
    "SEGUROS COMERCIALIZACIÓN",
    "SOBRANTES Y DESPERDICIOS NO RECUPERABLES",
    "SUELDOS ADMINISTRACIÓN",
    "SUELDOS COMERCIALIZACIÓN",
    "SUELDOS Y JORNALES FÁBRICA",
    "TELEFONÍA",
    "TRABAJOS DE TERCEROS",
    "VIÁTICOS ADMINISTRACIÓN",
    "OTROS",
  ];
}

// Supplier
export function getSupplierCategories() {
  return [
    "ALQUILER MAQUINARIAS Y EQUIPOS",
    "ALQUILER PLANTA",
    "AMORTIZACIONES ADMINISTRACIÓN",
    "AMORTIZACIONES COMERCIALIZACIÓN",
    "AMORTIZACIONES MAQUINARIAS Y EQUIPOS",
    "CARGAS SOCIALES ADMINISTRACIÓN",
    "CARGAS SOCIALES COMERCIALIZACIÓN",
    "CARGAS SOCIALES FÁBRICA",
    "COMBUSTIBLE",
    "COMIDA DEL PERSONAL",
    "COMISIONES DE TERCEROS",
    "CORRESPONDENCIA",
    "CUOTA MEDICA A CARGO EMPLEADOR",
    "DESCUENTOS OTORGADOS A CLIENTES",
    "DESPIDOS",
    "DESPIDOS ADMINISTRACIÓN",
    "ELEMENTOS DE FARMACIA",
    "ENERGÍA",
    "FLETES",
    "GASTOS DE ADMINISTRACION",
    "GASTOS DE COMERCIALIZACION",
    "GASTOS DE FABRICACION",
    "GASTOS DE LIMPIEZA",
    "GASTOS EXPORTACIÓN",
    "GASTOS VARIOS ADMINISTRACIÓN",
    "GASTOS VARIOS COMERCIALIZACIÓN",
    "HONORARIOS ADMINISTRACIÓN",
    "HONORARIOS COMERCIALIZACIÓN",
    "HONORARIOS INGENIEROS",
    "IMPRODUCTIVIDADES E INEFICIENCIAS",
    "INSUMOS COMPUTACION",
    "INSUMOS DIVERSOS",
    "IVA NO COMPUTABLE",
    "LIBRERÍA Y PAPELERÍA",
    "LUBRICANTES",
    "MANTENIMIENTO EQUIPOS",
    "MANTENIMIENTO ESPECIALIZADO",
    "MATERIALES DE SEGURIDAD",
    "PREMIOS A LA PRODUCCIÓN",
    "PUBLICIDAD",
    "REPARACIONES EN GARANTIA DE PRODUCTOS",
    "REPARACIONES MAQUINARIAS",
    "ROPA DE TRABAJO",
    "SEGURIDAD CONTRATADA",
    "SEGUROS",
    "SEGUROS COMERCIALIZACIÓN",
    "SOBRANTES Y DESPERDICIOS NO RECUPERABLES",
    "SUELDOS ADMINISTRACIÓN",
    "SUELDOS COMERCIALIZACIÓN",
    "SUELDOS Y JORNALES FÁBRICA",
    "TELEFONÍA",
    "TRABAJOS DE TERCEROS",
    "VIÁTICOS ADMINISTRACIÓN",
    "OTROS",
  ];
}

export function getAfipInvoiceData(invoice) {
  const tipoComprobante = invoice.charAt(0);
  const puntoDeVenta = invoice.slice(1, 5);
  const numeroComprobante = invoice.slice(5, 15);
  const numeroComprobanteHasta = invoice.slice(15, 25);
  const tipoComprobanteMap = {
    A: 1, // Factura A
    B: 6, // Factura B
    C: 11, // Factura C
    M: 51, // Factura M
    E: 19, // Factura Exportación
    X: 13, // Tique Factura
  };

  return {
    tipoComprobante: tipoComprobanteMap[tipoComprobante] || null,
    puntoDeVenta: parseInt(puntoDeVenta, 10),
    numeroComprobante: parseInt(numeroComprobante, 10),
    numeroComprobanteHasta: parseInt(numeroComprobanteHasta, 10),
  };
}

export function getAfipDocumentInfo(documentType) {
  const documentTypes = {
    CUIT: 80, // CUIT
    DNI: 96, // DNI
    LC: 97, // LC
    LE: 98, // LE
    CI: 99, // CI
    0: 99, // Consumidor Final sin datos
  };

  return documentTypes[documentType] || null;
}

export function getDocumentTypes() {
  return ["CUIT", "DNI", "LC", "LE", "CI"];
}
