"use strict";

const self = {};
const supabase = require("./db.js");
const _ = require("lodash");

// Escalas para cálculo de retenciones según RG 4525
const RETENTION_SCALES = [
  { min: 0, max: 5000, fixed: 0, percentage: 0 },
  { min: 5000, max: 10000, fixed: 250, percentage: 0.09 },
  { min: 10000, max: 15000, fixed: 700, percentage: 0.12 },
  { min: 15000, max: 20000, fixed: 1300, percentage: 0.15 },
  { min: 20000, max: 30000, fixed: 2050, percentage: 0.19 },
  { min: 30000, max: 40000, fixed: 3950, percentage: 0.23 },
  { min: 40000, max: 60000, fixed: 6250, percentage: 0.27 },
  { min: 60000, max: Infinity, fixed: 11650, percentage: 0.31 },
];

// Tabla AFIP de retenciones: Categoría -> { inscripto: %, noInscripto: %, montoNoSujeto: $, usaEscala: boolean }
const RETENTION_TABLE = {
  "19": { inscripto: 0.03, noInscripto: 0.10, montoNoSujeto: 0, usaEscala: false, },
  "21": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, },
  "25": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true, },
  "30": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, },
  "31": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, },
  "32": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, },
  "35": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, },
  "43": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, },
  "51": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, },
  "53": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, },
  "55": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, },
  "78": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false, },
  "86": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false, },
  "94": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false, },
  "95": { inscripto: 0.0025, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false, },
  "110": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 10000, usaEscala: true, },
  "111": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, },
  "112": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false, },
  "113": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false, },
  "116": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: true, },
  "124": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true, },
  "779": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 76140, usaEscala: false, },
  "780": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 31460, usaEscala: false, },
};

/**
 * Calcula el IVA (21%) y el neto a partir del importe total
 */
function calculateNetAndIVA(totalAmount) {
  const factor = 1 + 0.21; // 21% IVA
  const netAmount = totalAmount / factor;
  const iva = totalAmount - netAmount;
  return {
    netAmount: Math.round(netAmount * 100) / 100,
    iva: Math.round(iva * 100) / 100,
  };
}

/**
 * Calcula la retención según la categoría, el importe neto y la condición frente a ganancias
 * Esta función calcula la retención sobre un monto individual (sin considerar acumulado mensual)
 */
function calculateRetention(categoryCode, netAmount, profitsCondition) {
  let retention = 0;

  // Obtener configuración de la categoría
  const categoryConfig = RETENTION_TABLE[categoryCode];
  
  if (!categoryConfig) {
    // Si la categoría no está en la tabla, retención 0
    return 0;
  }

  // Determinar si es inscripto o no inscripto
  const isInscripto = profitsCondition === "Inscripto" || profitsCondition === "inscripto";
  
  // Para categorías con escala: regla especial
  if (categoryConfig.usaEscala) {
    // Para montos menores a 5000, no se retiene nada
    if (netAmount < 5000) {
      return 0;
    }
    
    // Para montos mayores o iguales a 5000, se retiene el monto no sujeto a retención
    // Calcular base imponible (restar monto no sujeto a retención)
    const baseImponible = Math.max(0, netAmount - categoryConfig.montoNoSujeto);
    
    if (isInscripto) {
      // Para inscriptos: usar escala progresiva sobre la base imponible
      const scale = RETENTION_SCALES.find(
        (s) => baseImponible >= s.min && baseImponible < s.max
      );

      if (scale) {
        if (scale.max === Infinity) {
          // Última escala: aplicar sobre el excedente del mínimo
          const excedente = baseImponible - scale.min;
          const calculatedRetention = excedente * scale.percentage;
          const retentionEscala = scale.fixed + calculatedRetention;
          // Sumar el monto no sujeto a retención
          retention = Math.round((categoryConfig.montoNoSujeto + retentionEscala) * 100) / 100;
        } else {
          // Otras escalas: aplicar sobre el excedente del mínimo
          const excedente = baseImponible - scale.min;
          const calculatedRetention = excedente * scale.percentage;
          const retentionEscala = scale.fixed + calculatedRetention;
          // Sumar el monto no sujeto a retención
          retention = Math.round((categoryConfig.montoNoSujeto + retentionEscala) * 100) / 100;
        }
      } else {
        // Si no encuentra escala, solo retener el monto no sujeto
        retention = Math.round(categoryConfig.montoNoSujeto * 100) / 100;
      }
    } else {
      // Para no inscriptos: aplicar porcentaje sobre la base imponible + monto no sujeto
      const retentionPorcentaje = Math.round(baseImponible * categoryConfig.noInscripto * 100) / 100;
      // Sumar el monto no sujeto a retención
      retention = Math.round((categoryConfig.montoNoSujeto + retentionPorcentaje) * 100) / 100;
    }
  } else {
    // Para categorías sin escala: calcular base imponible (restar monto no sujeto a retención)
    const baseImponible = Math.max(0, netAmount - categoryConfig.montoNoSujeto);

    // Si la base imponible es 0 o negativa, no hay retención
    if (baseImponible <= 0) {
      return 0;
    }

    if (isInscripto) {
      // Para inscriptos: aplicar porcentaje fijo
      if (categoryConfig.inscripto !== null) {
        retention = Math.round(baseImponible * categoryConfig.inscripto * 100) / 100;
      }
    } else {
      // Para no inscriptos: aplicar porcentaje fijo
      retention = Math.round(baseImponible * categoryConfig.noInscripto * 100) / 100;
    }
  }

  return retention;
}

/**
 * Obtiene todos los pagos del mes para un proveedor, categoría y condición específicos
 * Excluye el pago actual si se proporciona un payment_id
 */
async function getMonthlyPayments(supplierCuit, categoryCode, profitsCondition, issueDate, excludePaymentId = null) {
  try {
    // Extraer año y mes de la fecha
    const date = new Date(issueDate);
    const year = date.getFullYear();
    const month = date.getMonth() + 1; // getMonth() devuelve 0-11

    // Construir rango de fechas para el mes
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = new Date(year, month, 0).toISOString().split('T')[0]; // Último día del mes

    let query = supabase
      .from("retention_payments")
      .select("id, net_amount, retention_amount, issue_date")
      .eq("supplier_cuit", supplierCuit)
      .eq("category_code", categoryCode)
      .eq("profits_condition", profitsCondition)
      .gte("issue_date", startDate)
      .lte("issue_date", endDate)
      .is("deleted_at", null);

    // Excluir el pago actual si se está editando
    if (excludePaymentId) {
      query = query.neq("id", excludePaymentId);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error obteniendo pagos del mes:", error);
      return [];
    }

    return data || [];
  } catch (e) {
    console.error("Error en getMonthlyPayments:", e);
    return [];
  }
}

/**
 * Calcula la retención considerando el acumulado mensual
 * Lógica: Suma todos los pagos del mes, calcula retención total, resta lo ya retenido, retiene solo la diferencia
 */
async function calculateMonthlyRetention(
  categoryCode,
  netAmount,
  profitsCondition,
  supplierCuit,
  issueDate,
  excludePaymentId = null
) {
  // Obtener todos los pagos del mes (excluyendo el actual si se está editando)
  const monthlyPayments = await getMonthlyPayments(
    supplierCuit,
    categoryCode,
    profitsCondition,
    issueDate,
    excludePaymentId
  );

  // Sumar todos los net_amount del mes (incluyendo el nuevo pago)
  const totalNetAmount = monthlyPayments.reduce((sum, p) => sum + (parseFloat(p.net_amount) || 0), 0) + netAmount;

  // Sumar lo ya retenido en el mes (excluyendo el pago actual si se está editando)
  const totalRetained = monthlyPayments.reduce((sum, p) => sum + (parseFloat(p.retention_amount) || 0), 0);

  // Calcular la retención teórica total del mes sobre el acumulado
  const totalRetentionForMonth = calculateRetention(categoryCode, totalNetAmount, profitsCondition);

  // Calcular la diferencia: retención total del mes - lo ya retenido
  const newRetention = Math.max(0, totalRetentionForMonth - totalRetained);

  return {
    retention: Math.round(newRetention * 100) / 100,
    totalNetAmount: Math.round(totalNetAmount * 100) / 100,
    totalRetained: Math.round(totalRetained * 100) / 100,
    totalRetentionForMonth: Math.round(totalRetentionForMonth * 100) / 100,
    monthlyPaymentsCount: monthlyPayments.length + 1, // +1 por el nuevo pago
  };
}

/**
 * Genera un número de certificado único y elegante
 * Formato: CR-YYYYMMDD-NNNN (ej: CR-20241225-0001)
 */
async function generateCertificateNumber() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  const datePrefix = `CR-${year}${month}${day}`;

  // Buscar el último certificado del día
  const { data, error } = await supabase
    .from("retention_certificates")
    .select("certificate_number")
    .like("certificate_number", `${datePrefix}-%`)
    .order("certificate_number", { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) {
    return `${datePrefix}-0001`;
  }

  // Extraer el número secuencial del último certificado
  const lastCert = data[0].certificate_number;
  const lastNumber = lastCert.split("-")[2];
  const nextNumber = String(parseInt(lastNumber, 10) + 1).padStart(4, "0");
  return `${datePrefix}-${nextNumber}`;
}

self.getRetentionPayments = async (req, res) => {
  try {
    const { data: payments, error } = await supabase
      .from("retention_payments")
      .select("*")
      .is("deleted_at", null)
      .order("issue_date", { ascending: false });

    if (error) throw error;

    // Obtener información de cashflow para los pagos que tienen cashflow_id
    const formattedData = await Promise.all(
      (payments || []).map(async (payment) => {
        if (payment.cashflow_id) {
          const { data: cashflow, error: cashflowError } = await supabase
            .from("cashflow")
            .select("category, payment_method")
            .eq("id", payment.cashflow_id)
            .single();

          if (!cashflowError && cashflow && cashflow.category) {
            // Parsear categoría: "CATEGORIA - SERVICIO"
            const parts = cashflow.category.split(" - ");
            return {
              ...payment,
              cashflow_category: parts[0] || "",
              cashflow_service: parts[1] || parts[0] || "",
              cashflow_payment_method: cashflow.payment_method || "EFECTIVO",
            };
          }
        }
        return {
          ...payment,
          cashflow_category: "",
          cashflow_service: "",
          cashflow_payment_method: "EFECTIVO",
        };
      })
    );

    res.json(formattedData);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getRetentionPaymentById = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;

    const { data: payment, error } = await supabase
      .from("retention_payments")
      .select("*")
      .eq("id", payment_id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;

    // Obtener información del cashflow si existe
    if (payment.cashflow_id) {
      const { data: cashflow, error: cashflowError } = await supabase
        .from("cashflow")
        .select("category, payment_method")
        .eq("id", payment.cashflow_id)
        .single();

      if (!cashflowError && cashflow && cashflow.category) {
        const parts = cashflow.category.split(" - ");
        return res.json({
          ...payment,
          cashflow_category: parts[0] || "",
          cashflow_service: parts[1] || parts[0] || "",
          cashflow_payment_method: cashflow.payment_method || "EFECTIVO",
        });
      }
    }

    res.json({
      ...payment,
      cashflow_category: "",
      cashflow_service: "",
      cashflow_payment_method: "EFECTIVO",
    });
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.createRetentionPayment = async (req, res) => {
  try {
    const {
      invoiceNumber,
      categoryCode,
      categoryDetail,
      supplier,
      supplierCuit,
      issueDate,
      dueDate,
      totalAmount,
      netAmount,
      iva,
      profitsCondition,
      cashflowCategory,
      cashflowService,
      paymentMethod,
    } = req.body;

    // Calcular retención considerando el acumulado mensual
    const retentionResult = await calculateMonthlyRetention(
      categoryCode,
      netAmount,
      profitsCondition,
      supplierCuit,
      issueDate,
      null // No excluir ningún pago al crear uno nuevo
    );
    const retentionAmount = retentionResult.retention;
    const totalToPay = Math.round((totalAmount - retentionAmount) * 100) / 100;

    // Crear el pago
    const payment = {
      invoice_number: invoiceNumber,
      category_code: categoryCode,
      category_detail: categoryDetail || "",
      supplier: supplier,
      supplier_cuit: supplierCuit,
      issue_date: issueDate,
      due_date: dueDate || null,
      total_amount: totalAmount,
      net_amount: netAmount,
      iva: iva,
      profits_condition: profitsCondition,
      retention_amount: retentionAmount,
      total_to_pay: totalToPay,
    };

    const { data: newPayment, error: paymentError } = await supabase
      .from("retention_payments")
      .insert(payment)
      .select()
      .single();

    if (paymentError) throw paymentError;

    // Crear egreso en cashflow
    let cashflowId = null;
    if (totalToPay > 0) {
      // Construir categoría completa: categoria - servicio
      const fullCategory = cashflowCategory && cashflowService 
        ? `${cashflowCategory} - ${cashflowService}`
        : cashflowCategory || "Pago a Proveedor";

      const cashflow = {
        type: "EGRESO",
        category: fullCategory,
        net_amount: netAmount,
        amount: -totalToPay,
        date: issueDate,
        description: `Pago factura ${invoiceNumber} - ${supplier}`,
        provider: supplier,
        reference: invoiceNumber,
        payment_method: paymentMethod || "EFECTIVO",
      };

      const { data: newCashflow, error: cashflowError } = await supabase
        .from("cashflow")
        .insert(cashflow)
        .select()
        .single();

      if (cashflowError) {
        console.error("Error creando cashflow:", cashflowError);
      } else {
        cashflowId = newCashflow.id;
        // Actualizar el pago con el cashflow_id
        await supabase
          .from("retention_payments")
          .update({ cashflow_id: cashflowId })
          .eq("id", newPayment.id);
      }
    }

    // Buscar supplier_id por nombre del proveedor
    let supplierId = null;
    if (supplier) {
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("fantasy_name", supplier)
        .is("deleted_at", null)
        .single();
      
      if (!supplierError && supplierData) {
        supplierId = supplierData.id;
      }
    }

    // Crear factura en la tabla invoices
    let invoiceId = null;
    if (supplierId) {
      const invoice = {
        supplier_id: supplierId,
        amount: netAmount,
        invoice_number: invoiceNumber,
        description: `Factura ${invoiceNumber} - ${supplier}`,
        due_date: dueDate || null,
        total: totalAmount,
      };

      const { data: newInvoice, error: invoiceError } = await supabase
        .from("invoices")
        .insert(invoice)
        .select()
        .single();

      if (invoiceError) {
        console.error("Error creando factura:", invoiceError);
      } else if (newInvoice) {
        invoiceId = newInvoice.id;
        
        // Crear impuestos de la factura (IVA)
        if (iva > 0) {
          await supabase
            .from("taxes")
            .insert({
              invoice_id: newInvoice.id,
              name: "IVA",
              amount: iva,
            });
        }

        // Actualizar el pago con el invoice_id
        await supabase
          .from("retention_payments")
          .update({ invoice_id: invoiceId })
          .eq("id", newPayment.id);
      }
    }

    // Crear certificado de retención
    if (retentionAmount > 0) {
      const certificateNumber = await generateCertificateNumber();

      const certificate = {
        retention_payment_id: newPayment.id,
        certificate_number: certificateNumber,
        issued_date: new Date().toISOString().split("T")[0],
        retention_amount: retentionAmount,
        category_code: categoryCode,
        category_detail: categoryDetail || "",
        supplier_name: supplier,
        supplier_cuit: supplierCuit,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        net_amount: netAmount,
        profits_condition: profitsCondition,
      };

      const { data: newCertificate, error: certError } = await supabase
        .from("retention_certificates")
        .insert(certificate)
        .select()
        .single();

      if (certError) {
        console.error("Error creando certificado:", certError);
      }

      return res.json({
        payment: { ...newPayment, cashflow_id: cashflowId, invoice_id: invoiceId },
        certificate: newCertificate || null,
        invoice: invoiceId ? { id: invoiceId } : null,
      });
    }

    return res.json({
      payment: { ...newPayment, cashflow_id: cashflowId, invoice_id: invoiceId },
      certificate: null,
      invoice: invoiceId ? { id: invoiceId } : null,
    });
  } catch (e) {
    console.log("Retention payment creation error", e.message);
    return res.json({ error: e.message });
  }
};

self.updateRetentionPayment = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;
    const {
      invoiceNumber,
      categoryCode,
      categoryDetail,
      supplier,
      supplierCuit,
      issueDate,
      dueDate,
      totalAmount,
      netAmount,
      iva,
      profitsCondition,
      cashflowCategory,
      cashflowService,
      paymentMethod,
    } = req.body;

    // Recalcular retención considerando el acumulado mensual
    // Excluir el pago actual al recalcular para obtener el acumulado correcto
    const retentionResult = await calculateMonthlyRetention(
      categoryCode,
      netAmount,
      profitsCondition,
      supplierCuit,
      issueDate,
      payment_id // Excluir el pago actual al recalcular
    );
    const retentionAmount = retentionResult.retention;
    const totalToPay = Math.round((totalAmount - retentionAmount) * 100) / 100;

    const update = {
      invoice_number: invoiceNumber,
      category_code: categoryCode,
      category_detail: categoryDetail || "",
      supplier: supplier,
      supplier_cuit: supplierCuit,
      issue_date: issueDate,
      due_date: dueDate || null,
      total_amount: totalAmount,
      net_amount: netAmount,
      iva: iva,
      profits_condition: profitsCondition,
      retention_amount: retentionAmount,
      total_to_pay: totalToPay,
      updated_at: new Date().toISOString(),
    };

    const { data: updatedPayment, error } = await supabase
      .from("retention_payments")
      .update(update)
      .eq("id", payment_id)
      .is("deleted_at", null)
      .select()
      .single();

    if (error) throw error;

    // Actualizar certificado existente o crear uno nuevo
    const { data: existingCertificate } = await supabase
      .from("retention_certificates")
      .select("*")
      .eq("retention_payment_id", payment_id)
      .is("deleted_at", null)
      .single();

    if (retentionAmount > 0) {
      const certificateData = {
        retention_amount: retentionAmount,
        category_code: categoryCode,
        category_detail: categoryDetail || "",
        supplier_name: supplier,
        supplier_cuit: supplierCuit,
        invoice_number: invoiceNumber,
        issue_date: issueDate,
        due_date: dueDate || null,
        net_amount: netAmount,
        profits_condition: profitsCondition,
        updated_at: new Date().toISOString(),
      };

      if (existingCertificate) {
        // Actualizar certificado existente
        await supabase
          .from("retention_certificates")
          .update(certificateData)
          .eq("id", existingCertificate.id);
      } else {
        // Crear nuevo certificado
        const certificateNumber = await generateCertificateNumber();
        await supabase.from("retention_certificates").insert({
          ...certificateData,
          retention_payment_id: payment_id,
          certificate_number: certificateNumber,
          issued_date: new Date().toISOString().split("T")[0],
        });
      }
    }

    // Actualizar o crear cashflow
    let cashflowId = updatedPayment.cashflow_id;
    if (cashflowId) {
      // Construir categoría completa: categoria - servicio
      const fullCategory = cashflowCategory && cashflowService 
        ? `${cashflowCategory} - ${cashflowService}`
        : cashflowCategory || "Pago a Proveedor";

      await supabase
        .from("cashflow")
        .update({
          amount: totalToPay,
          net_amount: netAmount,
          date: issueDate,
          description: `Pago factura ${invoiceNumber} - ${supplier}`,
          reference: invoiceNumber,
          category: fullCategory,
          payment_method: paymentMethod || "EFECTIVO",
        })
        .eq("id", cashflowId);
    } else if (totalToPay > 0) {
      // Crear cashflow si no existe
      const fullCategory = cashflowCategory && cashflowService 
        ? `${cashflowCategory} - ${cashflowService}`
        : cashflowCategory || "Pago a Proveedor";

      const cashflow = {
        type: "EGRESO",
        category: fullCategory,
        net_amount: netAmount,
        amount: totalToPay,
        date: issueDate,
        description: `Pago factura ${invoiceNumber} - ${supplier}`,
        provider: supplier,
        reference: invoiceNumber,
        payment_method: paymentMethod || "EFECTIVO",
      };

      const { data: newCashflow, error: cashflowError } = await supabase
        .from("cashflow")
        .insert(cashflow)
        .select()
        .single();

      if (!cashflowError && newCashflow) {
        cashflowId = newCashflow.id;
        await supabase
          .from("retention_payments")
          .update({ cashflow_id: cashflowId })
          .eq("id", payment_id);
      }
    }

    // Buscar supplier_id por nombre del proveedor
    let supplierId = null;
    if (supplier) {
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("id")
        .eq("fantasy_name", supplier)
        .is("deleted_at", null)
        .single();
      
      if (!supplierError && supplierData) {
        supplierId = supplierData.id;
      }
    }

    // Actualizar o crear factura en la tabla invoices
    let invoiceId = updatedPayment.invoice_id;
    if (supplierId) {
      if (invoiceId) {
        // Actualizar factura existente
        await supabase
          .from("invoices")
          .update({
            supplier_id: supplierId,
            amount: netAmount,
            invoice_number: invoiceNumber,
            description: `Factura ${invoiceNumber} - ${supplier}`,
            due_date: dueDate || null,
            total: totalAmount,
            updated_at: new Date().toISOString(),
          })
          .eq("id", invoiceId);

        // Actualizar impuestos (eliminar los anteriores y crear nuevos)
        await supabase
          .from("taxes")
          .delete()
          .eq("invoice_id", invoiceId);

        if (iva > 0) {
          await supabase
            .from("taxes")
            .insert({
              invoice_id: invoiceId,
              name: "IVA",
              amount: iva,
            });
        }
      } else {
        // Crear nueva factura
        const invoice = {
          supplier_id: supplierId,
          amount: netAmount,
          invoice_number: invoiceNumber,
          description: `Factura ${invoiceNumber} - ${supplier}`,
          due_date: dueDate || null,
          total: totalAmount,
        };

        const { data: newInvoice, error: invoiceError } = await supabase
          .from("invoices")
          .insert(invoice)
          .select()
          .single();

        if (!invoiceError && newInvoice) {
          invoiceId = newInvoice.id;
          
          // Crear impuestos de la factura (IVA)
          if (iva > 0) {
            await supabase
              .from("taxes")
              .insert({
                invoice_id: newInvoice.id,
                name: "IVA",
                amount: iva,
              });
          }

          // Actualizar el pago con el invoice_id
          await supabase
            .from("retention_payments")
            .update({ invoice_id: invoiceId })
            .eq("id", payment_id);
        }
      }
    }

    res.json({ ...updatedPayment, cashflow_id: cashflowId, invoice_id: invoiceId });
  } catch (e) {
    console.error("Error updating retention payment:", e.message);
    res.json({ error: e.message });
  }
};

self.deleteRetentionPayment = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;
    const update = { deleted_at: new Date().toISOString() };

    // Obtener el pago primero para verificar cashflow_id e invoice_id
    const { data: payment, error: paymentError } = await supabase
      .from("retention_payments")
      .select("cashflow_id, invoice_id")
      .eq("id", payment_id)
      .is("deleted_at", null)
      .single();

    if (paymentError) throw paymentError;

    // 1. Soft delete del pago en retention_payments (registro principal)
    const { error: deletePaymentError } = await supabase
      .from("retention_payments")
      .update(update)
      .eq("id", payment_id)
      .is("deleted_at", null);

    if (deletePaymentError) throw deletePaymentError;

    // 2. Soft delete del certificado asociado en retention_certificates
    await supabase
      .from("retention_certificates")
      .update(update)
      .eq("retention_payment_id", payment_id)
      .is("deleted_at", null);

    // 3. Soft delete del cashflow asociado si existe
    if (payment && payment.cashflow_id) {
      await supabase
        .from("cashflow")
        .update(update)
        .eq("id", payment.cashflow_id)
        .is("deleted_at", null);
    }

    // 4. Soft delete de la factura asociada si existe
    if (payment && payment.invoice_id) {
      // Soft delete de la factura en invoices
      await supabase
        .from("invoices")
        .update(update)
        .eq("id", payment.invoice_id)
        .is("deleted_at", null);

      // Eliminar los impuestos (taxes) asociados a la factura (hard delete)
      await supabase
        .from("taxes")
        .delete()
        .eq("invoice_id", payment.invoice_id);
    }

    res.json({ success: true });
  } catch (e) {
    console.error("Error deleting retention payment:", e.message);
    res.json({ error: e.message });
  }
};

self.getRetentionCertificate = async (req, res) => {
  try {
    const payment_id = req.params.payment_id;

    const { data, error } = await supabase
      .from("retention_certificates")
      .select("*")
      .eq("retention_payment_id", payment_id)
      .is("deleted_at", null)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

self.getRetentionCertificateByNumber = async (req, res) => {
  try {
    const certificate_number = req.params.certificate_number;

    const { data, error } = await supabase
      .from("retention_certificates")
      .select("*")
      .eq("certificate_number", certificate_number)
      .is("deleted_at", null)
      .single();

    if (error) throw error;

    res.json(data);
  } catch (e) {
    res.json({ error: e.message });
  }
};

// Función auxiliar exportada para usar en otros lugares si es necesario
self.calculateRetention = calculateRetention;
self.calculateNetAndIVA = calculateNetAndIVA;

module.exports = self;

