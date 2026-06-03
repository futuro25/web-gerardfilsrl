import React, { useState } from 'react';
import { Calculator, FileText, DollarSign, X, Table } from 'lucide-react';
import { Dialog, DialogContent } from './common/Dialog';
import {
  RETENTION_TABLE,
  RETENTION_SCALES,
  calculateRetention as calcCore,
} from '../utils/retention';

function calculateRetention(categoryCode, inscripto, amount) {
  if (amount <= 0) {
    return { retention: 0, netAmount: 0, iva: 0, details: { error: "El monto debe ser mayor a 0" } };
  }

  const categoryConfig = RETENTION_TABLE[categoryCode];
  if (!categoryConfig) {
    return { retention: 0, netAmount: 0, iva: 0, details: { error: `Categoría ${categoryCode} no encontrada` } };
  }

  // Cálculo unificado: única fuente de verdad en utils/retention.js
  const { retention, netAmount, iva } = calcCore(categoryCode, inscripto, amount);
  const montoNoSujeto = categoryConfig.montoNoSujeto;

  // Texto informativo del método aplicado (no afecta el número)
  let calculationMethod;
  if (categoryConfig.usaEscala && inscripto) {
    calculationMethod = "Escala progresiva para inscriptos";
  } else {
    const porcentaje = inscripto ? categoryConfig.inscripto : categoryConfig.noInscripto;
    if (porcentaje === null || porcentaje === undefined) {
      calculationMethod = "Sin retención para inscriptos";
    } else if (netAmount > montoNoSujeto) {
      calculationMethod = `${(porcentaje * 100).toFixed(2)}% sobre monto que excede $${montoNoSujeto.toLocaleString('es-AR')}`;
    } else {
      calculationMethod = `Monto no supera el mínimo no sujeto de $${montoNoSujeto.toLocaleString('es-AR')}`;
    }
  }

  return {
    retention,
    netAmount,
    iva,
    details: {
      categoria: categoryCode,
      descripcion: categoryConfig.descripcion,
      inscripto,
      montoTotal: amount,
      montoNoSujeto,
      metodoCalculo: calculationMethod,
      montoCobrar: amount - retention,
    },
  };
}

export default function RetentionCalculator() {
  const [categoryCode, setCategoryCode] = useState("21");
  const [inscripto, setInscripto] = useState(true);
  const [amount, setAmount] = useState("");
  const [result, setResult] = useState(null);
  const [showTablesModal, setShowTablesModal] = useState(false);

  const handleCalculate = () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      alert("Por favor ingrese un monto válido");
      return;
    }
    const calculationResult = calculateRetention(categoryCode, inscripto, numAmount);
    setResult(calculationResult);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-xl shadow-lg p-8 mb-6">
          <div className="flex items-center gap-3 mb-6">
            <Calculator className="w-8 h-8 text-indigo-600" />
            <h1 className="text-3xl font-bold text-gray-800">Calculadora de Retenciones AFIP</h1>
          </div>
          
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Categoría AFIP
              </label>
              <select
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {Object.entries(RETENTION_TABLE).map(([code, config]) => (
                  <option key={code} value={code}>
                    Cat. {code} - {config.descripcion}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Monto Total (con IVA)
              </label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 w-5 h-5 text-gray-400" />
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="50000"
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          <div className="mb-6">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={inscripto}
                onChange={(e) => setInscripto(e.target.checked)}
                className="w-5 h-5 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-sm font-semibold text-gray-700">
                Cliente inscripto en Ganancias
              </span>
            </label>
          </div>

          <button
            onClick={handleCalculate}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
          >
            <Calculator className="w-5 h-5" />
            Calcular Retención
          </button>
        </div>

        {result && (
          <div className="bg-white rounded-xl shadow-lg p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <FileText className="w-7 h-7 text-indigo-600" />
                <h2 className="text-2xl font-bold text-gray-800">Resultado del Cálculo</h2>
              </div>
              <button
                onClick={() => setShowTablesModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors duration-200"
              >
                <Table className="w-5 h-5" />
                Ver Tablas de Retenciones
              </button>
            </div>

            {result.details.error ? (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-red-700 font-semibold">{result.details.error}</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Categoría</p>
                  <p className="text-lg font-bold text-indigo-900">
                    {result.details.categoria} - {result.details.descripcion}
                  </p>
                </div>

                <div className="grid md:grid-cols-3 gap-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Monto Total</p>
                    <p className="text-xl font-bold text-gray-800">
                      ${result.details.montoTotal.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Neto (sin IVA)</p>
                    <p className="text-xl font-bold text-gray-800">
                      ${result.netAmount.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">IVA (21%)</p>
                    <p className="text-xl font-bold text-gray-800">
                      ${result.iva.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-gray-600 mb-1">Método de Cálculo</p>
                  <p className="text-base font-semibold text-amber-900">
                    {result.details.metodoCalculo}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {result.details.inscripto ? "Cliente INSCRIPTO" : "Cliente NO INSCRIPTO"}
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-blue-900 mb-2">ℹ️ Nota sobre Cálculo Mensual</p>
                  <p className="text-xs text-blue-800">
                    Esta calculadora muestra la retención sobre un pago individual. En el sistema de certificados, 
                    la retención se calcula considerando el <strong>acumulado mensual</strong>: se suman todos los pagos 
                    del mes para el mismo proveedor, categoría y condición, se calcula la retención total del mes, 
                    se resta lo ya retenido y se retiene solo la diferencia.
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Retención a Aplicar</p>
                    <p className="text-2xl font-bold text-red-700">
                      ${result.retention.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>

                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Monto a Pagar</p>
                    <p className="text-2xl font-bold text-green-700">
                      ${result.details.montoCobrar.toLocaleString('es-AR', {minimumFractionDigits: 2})}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Modal de Tablas de Retenciones */}
        <Dialog open={showTablesModal} onOpenChange={setShowTablesModal}>
          <DialogContent className="w-[95vw] md:w-full max-w-6xl max-h-[90vh] overflow-y-auto p-4 md:p-8">
            <div className="flex items-center justify-between mb-4 md:mb-6 pb-3 md:pb-4 border-b">
              <div className="flex items-center gap-2 md:gap-3">
                <Table className="w-5 h-5 md:w-6 md:h-6 text-indigo-600" />
                <h2 className="text-lg md:text-2xl font-bold text-gray-800">Tablas de Retenciones AFIP</h2>
              </div>
              <button
                onClick={() => setShowTablesModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full transition-colors"
              >
                <X className="w-5 h-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-6 md:space-y-8">
              {/* Tabla de Escalas */}
              <div>
                <h3 className="text-base md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                  Escala Progresiva de Retenciones (RG 4525)
                </h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto -mx-1 md:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            <th className="px-2 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold whitespace-nowrap">Desde</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold whitespace-nowrap">Hasta</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold whitespace-nowrap">Fijo</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold whitespace-nowrap">%</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {RETENTION_SCALES.map((scale, index) => (
                            <tr
                              key={index}
                              className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                              <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">
                                ${scale.min === 0 ? '0' : scale.min.toLocaleString('es-AR')}
                              </td>
                              <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-gray-700 whitespace-nowrap">
                                {scale.max === Infinity ? (
                                  <span className="font-semibold">Sin límite</span>
                                ) : (
                                  `$${scale.max.toLocaleString('es-AR')}`
                                )}
                              </td>
                              <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-right text-gray-700 whitespace-nowrap">
                                ${scale.fixed.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-right text-gray-700 whitespace-nowrap">
                                {(scale.percentage * 100).toFixed(2)}%
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-2 md:mt-3 italic px-1">
                  Esta escala se aplica a categorías que utilizan cálculo progresivo (usaEscala: true)
                </p>
              </div>

              {/* Tabla de Categorías */}
              <div>
                <h3 className="text-base md:text-xl font-bold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4 md:w-5 md:h-5 text-indigo-600" />
                  Tabla de Categorías AFIP
                </h3>
                <div className="bg-gray-50 rounded-lg overflow-hidden border border-gray-200">
                  <div className="overflow-x-auto -mx-1 md:mx-0">
                    <div className="inline-block min-w-full align-middle">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead>
                          <tr className="bg-indigo-600 text-white">
                            <th className="px-2 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold whitespace-nowrap">Cat.</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-left text-xs md:text-sm font-semibold min-w-[120px]">Descripción</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold whitespace-nowrap">Inscr.</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold whitespace-nowrap">No Inscr.</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-right text-xs md:text-sm font-semibold whitespace-nowrap">No Sujeto</th>
                            <th className="px-2 py-2 md:px-4 md:py-3 text-center text-xs md:text-sm font-semibold whitespace-nowrap">Escala</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {Object.entries(RETENTION_TABLE)
                            .sort(([a], [b]) => parseInt(a) - parseInt(b))
                            .map(([code, config], index) => (
                              <tr
                                key={code}
                                className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                              >
                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm font-semibold text-indigo-700 whitespace-nowrap">
                                  {code}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-gray-700">
                                  {config.descripcion}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-right text-gray-700 whitespace-nowrap">
                                  {config.inscripto === null ? (
                                    <span className="text-gray-400 italic">N/A</span>
                                  ) : (
                                    `${(config.inscripto * 100).toFixed(2)}%`
                                  )}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-right text-gray-700 whitespace-nowrap">
                                  {(config.noInscripto * 100).toFixed(2)}%
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 text-xs md:text-sm text-right text-gray-700 whitespace-nowrap">
                                  ${config.montoNoSujeto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                                </td>
                                <td className="px-2 py-2 md:px-4 md:py-3 text-center">
                                  {config.usaEscala ? (
                                    <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 bg-amber-100 text-amber-800 rounded-full text-xs font-semibold">
                                      Sí
                                    </span>
                                  ) : (
                                    <span className="inline-block px-2 py-0.5 md:px-3 md:py-1 bg-gray-100 text-gray-600 rounded-full text-xs font-semibold">
                                      No
                                    </span>
                                  )}
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                <p className="text-xs md:text-sm text-gray-600 mt-2 md:mt-3 italic px-1">
                  Los porcentajes se aplican sobre el monto neto (sin IVA) que excede el monto no sujeto
                </p>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}