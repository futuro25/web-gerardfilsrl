// Lógica de cálculo de retenciones (Régimen 830 / RG 4525), replicada del
// módulo de Retenciones para poder reutilizarla desde otros lugares
// (ej: dialog de detalle en Facturas Compras).

// Categorías del Régimen 830 según RG 4525 Anexo 1
export const REGIMEN_830_CATEGORIES = [
  { code: "19", description: "Intereses por operaciones en entidades financieras (Ley 21.526) o agentes de bolsa." },
  { code: "21", description: "Intereses originados en operaciones no comprendidas en la categoría 19." },
  { code: "25", description: "Comisiones de comisionista, rematador, consignatario y demás auxiliares de comercio." },
  { code: "30", description: "Alquileres o arrendamientos de bienes muebles." },
  { code: "31", description: "Bienes inmuebles urbanos (incluye leasing)." },
  { code: "32", description: "Bienes inmuebles rurales (incluye leasing)." },
  { code: "35", description: "Regalías." },
  { code: "43", description: "Interés accionario, excedentes y retornos de cooperativas (excepto consumo)." },
  { code: "51", description: "Obligaciones de no hacer o por abandono / no ejercicio de una actividad." },
  { code: "53", description: "Operaciones en mercados de cereales a término y de futuros y opciones." },
  { code: "55", description: "Distribución de películas. Transmisión de programación. TV satelital." },
  { code: "78", description: "Enajenación de bienes muebles y bienes de cambio." },
  { code: "86", description: "Transferencia de derechos de llave, marcas, patentes, regalías, concesiones." },
  { code: "94", description: "Locaciones de obra y/o servicios no ejecutados en relación de dependencia." },
  { code: "95", description: "Operaciones de transporte de carga nacional e internacional." },
  { code: "110", description: "Explotación de derechos de autor (Ley 11.723)." },
  { code: "111", description: "Cualquier otra cesión o locación de derechos." },
  { code: "112", description: "Beneficios de planes de seguro de retiro privados." },
  { code: "113", description: "Rescates por desistimiento de planes de seguro de retiro." },
  { code: "116", description: "Honorarios de director, síndico, profesionales liberales, oficios." },
  { code: "124", description: "Corredor, viajante de comercio y despachante de aduana." },
  { code: "779", description: "Subsidios estatales por enajenación de bienes muebles y bienes de cambio." },
  { code: "780", description: "Subsidios estatales por locaciones de obra y/o servicios." },
];

// Escalas para cálculo de retenciones según RG 4525
const RETENTION_SCALES = [
  { min: 0, max: 8000, fixed: 0, percentage: 0.05 },
  { min: 8000, max: 16000, fixed: 400, percentage: 0.09 },
  { min: 16000, max: 24000, fixed: 1120, percentage: 0.12 },
  { min: 24000, max: 32000, fixed: 2080, percentage: 0.15 },
  { min: 32000, max: 48000, fixed: 3280, percentage: 0.19 },
  { min: 48000, max: 64000, fixed: 6320, percentage: 0.23 },
  { min: 64000, max: 96000, fixed: 10000, percentage: 0.27 },
  { min: 96000, max: Infinity, fixed: 18640, percentage: 0.31 },
];

// Tabla AFIP: Categoría -> { inscripto, noInscripto, montoNoSujeto, usaEscala }
export const RETENTION_TABLE = {
  "19": { inscripto: 0.03, noInscripto: 0.10, montoNoSujeto: 0, usaEscala: false },
  "21": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false },
  "25": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true },
  "30": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false },
  "31": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false },
  "32": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false },
  "35": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false },
  "43": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false },
  "51": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false },
  "53": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false },
  "55": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false },
  "78": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false },
  "86": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false },
  "94": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false },
  "95": { inscripto: 0.0025, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false },
  "110": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 10000, usaEscala: true },
  "111": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false },
  "112": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false },
  "113": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false },
  "116": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: true },
  "124": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true },
  "779": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 76140, usaEscala: false },
  "780": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 31460, usaEscala: false },
};

export function calculateNetAndIVA(totalAmount) {
  const factor = 1 + 0.21;
  const netAmount = totalAmount / factor;
  const iva = totalAmount - netAmount;
  return {
    netAmount: Math.round(netAmount * 100) / 100,
    iva: Math.round(iva * 100) / 100,
  };
}

function calculateScaleRetention(netAmount, montoNoSujeto) {
  if (netAmount <= montoNoSujeto) return 0;
  const montoSujeto = netAmount - montoNoSujeto;
  const scale = RETENTION_SCALES.find(
    (s) => montoSujeto >= s.min && montoSujeto < s.max
  );
  if (!scale) return 0;
  const retention = scale.fixed + (montoSujeto - scale.min) * scale.percentage;
  return Math.round(retention * 100) / 100;
}

// Calcula la retención (estimación por factura individual, sin acumulado mensual).
// El cálculo definitivo lo hace el backend al guardar (considera el acumulado).
export function calculateRetention(categoryCode, inscripto, totalAmount) {
  const amount = parseFloat(totalAmount) || 0;
  if (amount <= 0) return { retention: 0, netAmount: 0, iva: 0 };

  const categoryConfig = RETENTION_TABLE[categoryCode];
  if (!categoryConfig) return { retention: 0, netAmount: 0, iva: 0 };

  const { netAmount, iva } = calculateNetAndIVA(amount);
  const montoNoSujeto = categoryConfig.montoNoSujeto;
  let retention = 0;

  if (categoryConfig.usaEscala) {
    retention = calculateScaleRetention(netAmount, montoNoSujeto);
  } else {
    const porcentaje = inscripto
      ? categoryConfig.inscripto
      : categoryConfig.noInscripto;
    if (porcentaje !== null && netAmount > montoNoSujeto) {
      retention =
        Math.round((netAmount - montoNoSujeto) * porcentaje * 100) / 100;
    }
  }

  return { retention, netAmount, iva };
}

// Deriva la condición frente a Ganancias del régimen impositivo del proveedor.
export function profitsConditionFromTaxRegime(taxRegime) {
  const r = String(taxRegime || "").toUpperCase();
  if (r.includes("INSCRIPTO")) return "Inscripto";
  return "No inscripto";
}
