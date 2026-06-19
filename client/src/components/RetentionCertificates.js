import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { DateTime } from "luxon";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { queryRetentionPaymentsKey, queryRetentionCertificateKey, querySuppliersKey, querySupplierAccountsListKey, queryPendingPaymentItemsKey } from "../apis/queryKeys";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { CopyIcon, EditIcon, TrashIcon, EyeIcon, CloseIcon, ReceiptIcon } from "./icons";
import * as utils from "../utils/utils";
import Button from "./common/Button";
import ConfirmDialog from "./common/ConfirmDialog";
import Spinner from "./common/Spinner";
import { Input } from "./common/Input";
import SelectComboBox from "./common/SelectComboBox";
import {
  useRetentionPaymentsQuery,
  useCreateRetentionPaymentMutation,
  useDeleteRetentionPaymentMutation,
  useUpdateRetentionPaymentMutation,
  useRetentionCertificateQuery,
} from "../apis/api.retentioncertificates";
import { useSuppliersQuery } from "../apis/api.suppliers";
import { Download, FileText } from "lucide-react";
import { jsPDF } from "jspdf";
import {
  RETENTION_TABLE,
  calculateRetention as calcRetention,
  calculateNetAndIVA as calcNetAndIVA,
} from "../utils/retention";

// Categorías del Régimen 830 según RG 4525 Anexo 1
const REGIMEN_830_CATEGORIES = [
  { code: "19", description: "Intereses por operaciones realizadas en entidades financieras. Ley N° 21.526 y sus modificaciones o agentes de bolsa o mercado abierto." },
  { code: "21", description: "Intereses originados en operaciones no comprendidas en el punto 1." },
  { code: "25", description: "Comisiones u otras retribuciones derivadas de la actividad de comisionista, rematador, consignatario y demás auxiliares de comercio." },
  { code: "30", description: "Alquileres o arrendamientos de bienes muebles." },
  { code: "31", description: "Bienes Inmuebles Urbanos, incluidos los efectuados bajo la modalidad de leasing –incluye suburbanos–." },
  { code: "32", description: "Bienes Inmuebles Rurales, incluidos los efectuados bajo la modalidad de leasing –incluye subrurales–." },
  { code: "35", description: "Regalías." },
  { code: "43", description: "Interés accionario, excedentes y retornos distribuidos entre asociados, cooperativas -excepto consumo–." },
  { code: "51", description: "Obligaciones de no hacer, o por abandono o no ejercicio de una actividad." },
  { code: "53", description: "Operaciones realizadas por intermedio de mercados de cereales a término que se resuelvan en el curso del término (arbitrajes) y de mercados de futuros y opciones." },
  { code: "55", description: "Distribución de películas. Transmisión de programación. Televisión vía satelital." },
  { code: "78", description: "Enajenación de bienes muebles y bienes de cambio." },
  { code: "86", description: "Transferencia temporal o definitiva de derechos de llave, marcas, patentes de invención, regalías, concesiones y similares." },
  { code: "94", description: "Locaciones de obra y/o servicios no ejecutados en relación de dependencia no mencionados expresamente en otros incisos." },
  { code: "95", description: "Operaciones de transporte de carga nacional e internacional." },
  { code: "110", description: "Explotación de derechos de autor (Ley N° 11.723)." },
  { code: "111", description: "Cualquier otra cesión o locación de derechos, excepto las que correspondan a operaciones realizadas por intermedio de mercados de cereales a término que se resuelvan en el curso del término (arbitrajes) y de mercados de futuros y opciones." },
  { code: "112", description: "Beneficios provenientes del cumplimiento de los requisitos de los planes de seguro de retiro privados administrados por entidades sujetas al control de la Superintendencia de Seguros de la Nación." },
  { code: "113", description: "Rescates -totales o parciales- por desistimiento de los planes de seguro de retiro." },
  { code: "116", description: "Honorarios de director de sociedades anónimas, síndico, fiduciario, consejero de sociedades cooperativas, integrante de consejos de vigilancia y socios administradores de las sociedades de responsabilidad limitada, en comandita simple y en comandita por acciones. Profesionales liberales, oficios, albacea, mandatario, gestor de negocio." },
  { code: "124", description: "Corredor, viajante de comercio y despachante de aduana." },
  { code: "779", description: "Subsidios abonados por los Estados Nacional, provinciales, municipales o el Gobierno de la Ciudad Autónoma de Buenos Aires, en concepto de enajenación de bienes muebles y bienes de cambio." },
  { code: "780", description: "Subsidios abonados por los Estados Nacional, provinciales, municipales o el Gobierno de la Ciudad Autónoma de Buenos Aires, en concepto de locaciones de obra y/o servicios, no ejecutados en relación de dependencia." },
];

const MONTHS = [
  { value: 1, label: "Enero" },
  { value: 2, label: "Febrero" },
  { value: 3, label: "Marzo" },
  { value: 4, label: "Abril" },
  { value: 5, label: "Mayo" },
  { value: 6, label: "Junio" },
  { value: 7, label: "Julio" },
  { value: 8, label: "Agosto" },
  { value: 9, label: "Septiembre" },
  { value: 10, label: "Octubre" },
  { value: 11, label: "Noviembre" },
  { value: 12, label: "Diciembre" },
];

export default function RetentionCertificates() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedPaymentToEdit, setSelectedPaymentToEdit] = useState(null);
  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(DateTime.now().month);
  const [selectedYear, setSelectedYear] = useState(DateTime.now().year);
  const [viewAll, setViewAll] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [certificate, setCertificate] = useState(null);
  const [showCertificate, setShowCertificate] = useState(false);
  const [calculatedRetention, setCalculatedRetention] = useState(0);
  const [calculatedTotalToPay, setCalculatedTotalToPay] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [netAmount, setNetAmount] = useState(0);
  const [iva, setIva] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [calculatedCertificate, setCalculatedCertificate] = useState(null);
  const [isCalculated, setIsCalculated] = useState(false);
  const [invoiceLetter, setInvoiceLetter] = useState("A");
  const [invoiceFirst4, setInvoiceFirst4] = useState("");
  const [invoiceLast8, setInvoiceLast8] = useState("");
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [cashflowCategory, setCashflowCategory] = useState("");
  const [cashflowService, setCashflowService] = useState("");
  const [paymentMethod, setPaymentMethod] = useState(utils.getPaymentMethods()[0] || "EFECTIVO");
  const [deleteConfirmPayment, setDeleteConfirmPayment] = useState(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    control,
    setValue,
    formState: { errors },
  } = useForm();

  const {
    data: payments,
    isLoading,
    error,
  } = useQuery({
    queryKey: queryRetentionPaymentsKey(),
    queryFn: useRetentionPaymentsQuery,
  });

  const {
    data: suppliersRaw,
    isLoading: isLoadingSuppliers,
  } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const suppliers = Array.isArray(suppliersRaw) ? suppliersRaw : [];

  const watchedTotalAmount = watch("totalAmount");
  const watchedProfitsCondition = watch("profitsCondition");

  // Cálculo de retenciones: única fuente de verdad en utils/retention.js
  const calculateNetAndIVA = useCallback(
    (totalAmount) => calcNetAndIVA(totalAmount),
    []
  );

  const calculateRetention = useCallback(
    (categoryCode, inscripto, amount) =>
      calcRetention(categoryCode, inscripto, amount),
    []
  );

  // Calcular neto e IVA cuando cambia el importe total
  useEffect(() => {
    if (watchedTotalAmount) {
      const total = parseFloat(watchedTotalAmount) || 0;
      const { netAmount: calculatedNet, iva: calculatedIva } = calculateNetAndIVA(total);
      
      setTotalAmount(total);
      setNetAmount(calculatedNet);
      setIva(calculatedIva);
      
      setValue("netAmount", calculatedNet);
      setValue("iva", calculatedIva);
    } else {
      setTotalAmount(0);
      setNetAmount(0);
      setIva(0);
      setCalculatedRetention(0);
      setCalculatedTotalToPay(0);
    }
  }, [watchedTotalAmount, setValue, calculateNetAndIVA]);

  // Calcular retención cuando cambian los valores
  useEffect(() => {
    const amount = parseFloat(watchedTotalAmount) || 0;
    if (amount > 0 && selectedCategory && watchedProfitsCondition) {
      const isInscripto = watchedProfitsCondition === "Inscripto" || watchedProfitsCondition === "inscripto";
      const result = calculateRetention(selectedCategory.code, isInscripto, amount);
      
      setCalculatedRetention(result.retention);
      setCalculatedTotalToPay(Math.round((amount - result.retention) * 100) / 100);
    } else {
      if (amount <= 0) {
        setCalculatedRetention(0);
        setCalculatedTotalToPay(0);
      } else {
        setCalculatedRetention(0);
        setCalculatedTotalToPay(amount);
      }
    }
  }, [watchedTotalAmount, selectedCategory, watchedProfitsCondition, calculateRetention]);

  // Establecer valores por defecto cuando se crea un nuevo pago
  useEffect(() => {
    if (stage === "CREATE" && !selectedPaymentToEdit) {
      // Establecer valores por defecto para nuevos pagos
      setValue("profitsCondition", "Inscripto");
    }
  }, [stage, selectedPaymentToEdit, setValue]);

  const yearOptions = useMemo(() => {
    const currentYear = DateTime.now().year;
    const years = [];
    for (let y = currentYear - 3; y <= currentYear + 1; y++) {
      years.push(y);
    }
    return years;
  }, []);

  const listFiltered = useMemo(() => {
    if (!payments?.length) return [];
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (q) {
        const supplier = (p.supplier || "").toLowerCase();
        const invoice = (p.invoice_number || "").toLowerCase();
        if (!supplier.includes(q) && !invoice.includes(q)) return false;
      }
      if (viewAll) return true;
      if (!p.issue_date) return false;
      const dt = DateTime.fromISO(String(p.issue_date).slice(0, 10));
      if (!dt.isValid) return false;
      return dt.month === selectedMonth && dt.year === selectedYear;
    });
  }, [payments, search, selectedMonth, selectedYear, viewAll]);

  const periodTotals = useMemo(() => {
    return listFiltered.reduce(
      (acc, p) => {
        acc.count += 1;
        acc.retention += parseFloat(p.retention_amount) || 0;
        acc.totalAmount += parseFloat(p.total_amount) || 0;
        acc.totalToPay += parseFloat(p.total_to_pay) || 0;
        return acc;
      },
      { count: 0, retention: 0, totalAmount: 0, totalToPay: 0 }
    );
  }, [listFiltered]);

  const createMutation = useMutation({
    mutationFn: useCreateRetentionPaymentMutation,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
      queryClient.invalidateQueries({ queryKey: queryRetentionCertificateKey(data.payment.id) });
      
      // Limpiar estados y volver al listado
      setStage("LIST");
      setCalculatedCertificate(null);
      setIsCalculated(false);
      setShowCertificate(false);
      onCancel();
    },
    onError: (error) => {
      console.error("Error creando pago:", error);
      alert("Error al guardar el pago. Por favor, intente nuevamente.");
    },
  });

  const updateMutation = useMutation({
    mutationFn: useUpdateRetentionPaymentMutation,
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
      
      // Limpiar estados y volver al listado
      setStage("LIST");
      setCalculatedCertificate(null);
      setIsCalculated(false);
      setShowCertificate(false);
      onCancel();
    },
    onError: (error) => {
      console.error("Error actualizando pago:", error);
      alert("Error al actualizar el pago. Por favor, intente nuevamente.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: useDeleteRetentionPaymentMutation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
      queryClient.invalidateQueries({ queryKey: ["account-movements"] });
      queryClient.invalidateQueries({ queryKey: ["account-movements-summary"] });
      queryClient.invalidateQueries({ queryKey: querySupplierAccountsListKey() });
      queryClient.invalidateQueries({ queryKey: queryPendingPaymentItemsKey() });
    },
    onError: (error) => {
      console.error("Error eliminando pago:", error);
    },
  });

  const onEdit = (payment_id) => {
    reset();
    const payment = payments.find((p) => p.id === payment_id) || null;
    setSelectedPaymentToEdit(payment);
    setSelectedPayment(payment);
    setTotalAmount(payment?.total_amount || 0);
    setNetAmount(payment?.net_amount || 0);
    setIva(payment?.iva || 0);
    setCalculatedRetention(payment?.retention_amount || 0);
    setCalculatedTotalToPay(payment?.total_to_pay || 0);
    
    // Establecer valores en el formulario
    setValue("supplier", payment?.supplier || "");
    setValue("supplierCuit", payment?.supplier_cuit || "");
    setValue("issueDate", payment?.issue_date ? payment.issue_date.split("T")[0] : "");
    setValue("totalAmount", payment?.total_amount || 0);
    setValue("netAmount", payment?.net_amount || 0);
    setValue("iva", payment?.iva || 0);
    setValue("profitsCondition", payment?.profits_condition || "Inscripto");

    const { letter, first4, last8 } = splitInvoiceNumber(payment?.invoice_number);
    setInvoiceLetter(letter || "A");
    setInvoiceFirst4(first4);
    setInvoiceLast8(last8);
    
    // Buscar y establecer categoría
    if (payment?.category_code) {
      const category = RETENTION_TABLE[payment.category_code];
      if (category) {
        setSelectedCategory({
          code: category.code,
          description: category.description,
          id: category.code,
          label: `${category.code} - ${category.description}`,
          name: `${category.code} - ${category.description}`,
        });
      } else {
        // Si no se encuentra en la lista, crear un objeto temporal con los datos guardados
        setSelectedCategory({
          code: payment.category_code,
          description: payment.category_detail || "",
          id: payment.category_code,
          label: `${payment.category_code} - ${payment.category_detail || ""}`,
          name: `${payment.category_code} - ${payment.category_detail || ""}`,
        });
      }
    }
    
    setIsCalculated(false);
    setCalculatedCertificate(null);
    
    // Buscar y establecer proveedor
    if (payment?.supplier && suppliers) {
      const supplier = suppliers.find((s) => s.fantasy_name === payment.supplier);
      if (supplier) {
        setSelectedSupplier({
          id: supplier.id,
          label: supplier.fantasy_name,
          name: supplier.fantasy_name,
        });
      }
    }
    
    setStage("CREATE");
  };

  const onView = async (payment_id) => {
    const payment = payments.find((p) => p.id === payment_id) || null;
    setSelectedPayment(payment);
    setViewOnly(true);
    setStage("CREATE");
    
    // Obtener certificado
    try {
      const cert = await useRetentionCertificateQuery(payment_id);
      if (cert && !cert.error) {
        setCertificate(cert);
        setShowCertificate(true);
      }
    } catch (e) {
      console.error("Error obteniendo certificado:", e);
    }
  };

  const onViewCertificate = async (payment_id) => {
    try {
      const cert = await useRetentionCertificateQuery(payment_id);
      if (cert && !cert.error) {
        setCertificate(cert);
        setShowCertificate(true);
      } else {
        alert("No se encontró certificado para este pago");
      }
    } catch (e) {
      console.error("Error obteniendo certificado:", e);
      alert("No se pudo cargar el certificado");
    }
  };

  const downloadCertificatePDF = async (payment_id) => {
    try {
      // Obtener el pago y el certificado
      const payment = payments.find((p) => p.id === payment_id);
      if (!payment) {
        alert("No se encontró el pago");
        return;
      }

      const cert = await useRetentionCertificateQuery(payment_id);
      if (!cert || cert.error) {
        alert("No se encontró certificado para este pago");
        return;
      }

      // Crear el PDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      const margin = 20;
      let y = 20;

      // Título principal
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("CERTIFICADO DE RETENCIÓN", pageWidth / 2, y, { align: "center" });
      y += 8;

      // Subtítulo
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Régimen de Retención de Ganancias", pageWidth / 2, y, { align: "center" });
      y += 12;

      // Datos del agente de retención
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text("Gerardfil SRL - CUIT: 30-71878217-8", pageWidth / 2, y, { align: "center" });
      y += 6;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text("Pilar 5180, Caseros, Buenos Aires - Tel: 54 11 7856 4391", pageWidth / 2, y, { align: "center" });
      y += 15;

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Datos del certificado
      doc.setFontSize(10);
      
      // Número de certificado y fecha
      doc.setFont("helvetica", "bold");
      doc.text("Número de Certificado:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(cert.certificate_number || "-", margin + 50, y);
      
      doc.setFont("helvetica", "bold");
      doc.text("Fecha de Emisión:", pageWidth / 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(utils.formatDate(cert.issued_date) || "-", pageWidth / 2 + 40, y);
      y += 10;

      // Razón social y CUIT
      doc.setFont("helvetica", "bold");
      doc.text("Razón Social:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(cert.supplier_name || "-", margin + 30, y);
      
      doc.setFont("helvetica", "bold");
      doc.text("CUIT:", pageWidth / 2, y);
      doc.setFont("helvetica", "normal");
      doc.text(cert.supplier_cuit || "-", pageWidth / 2 + 15, y);
      y += 15;

      // Categoría
      doc.setFont("helvetica", "bold");
      doc.text("Categoría (Régimen 830):", margin, y);
      y += 6;
      doc.setFont("helvetica", "normal");
      const categoryDesc = REGIMEN_830_CATEGORIES.find(cat => cat.code === cert.category_code)?.description || cert.category_detail || "";
      const categoryText = `${cert.category_code} - ${categoryDesc}`;
      const splitCategory = doc.splitTextToSize(categoryText, pageWidth - (margin * 2));
      doc.text(splitCategory, margin, y);
      y += (splitCategory.length * 5) + 5;

      // Condición frente a Ganancias
      doc.setFont("helvetica", "bold");
      doc.text("Condición frente a Ganancias:", margin, y);
      doc.setFont("helvetica", "normal");
      doc.text(cert.profits_condition || "Inscripto", margin + 60, y);
      y += 15;

      // Línea separadora
      doc.line(margin, y, pageWidth - margin, y);
      y += 10;

      // Montos
      doc.setFontSize(11);
      const totalToPay = payment.total_to_pay || ((cert.net_amount * 1.21) - (cert.retention_amount || 0));
      const totalFactura = payment.total_amount || (cert.net_amount * 1.21);

      // Tabla de montos
      const colWidth = (pageWidth - margin * 2) / 3;
      
      doc.setFont("helvetica", "bold");
      doc.text("Total a Pagar", margin, y);
      doc.text("Monto Retenido", margin + colWidth, y);
      doc.text("Total Factura", margin + colWidth * 2, y);
      y += 8;
      
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`$${totalToPay?.toFixed(2) || "0.00"}`, margin, y);
      doc.text(`$${cert.retention_amount?.toFixed(2) || "0.00"}`, margin + colWidth, y);
      doc.text(`$${totalFactura?.toFixed(2) || "0.00"}`, margin + colWidth * 2, y);
      y += 20;

      // Línea separadora
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 15;

      // Pie de página
      doc.setFontSize(9);
      doc.setFont("helvetica", "italic");
      const footerText = "Este certificado ha sido generado electrónicamente y tiene validez legal conforme a la normativa vigente.";
      const splitFooter = doc.splitTextToSize(footerText, pageWidth - (margin * 2));
      doc.text(splitFooter, pageWidth / 2, y, { align: "center" });

      // Guardar el PDF
      const fileName = `Certificado_Retencion_${cert.certificate_number || payment_id}.pdf`;
      doc.save(fileName);
    } catch (e) {
      console.error("Error generando PDF:", e);
      alert("Error al generar el PDF del certificado");
    }
  };

  const confirmDeletePayment = async () => {
    if (!deleteConfirmPayment?.id) return;

    try {
      const result = await deleteMutation.mutateAsync(deleteConfirmPayment.id);
      if (result?.error) {
        window.alert(result.error);
        return;
      }
      setDeleteConfirmPayment(null);
      setStage("LIST");
    } catch (e) {
      window.alert(e.message || "No se pudo eliminar la retención.");
    }
  };

  const onCancel = () => {
    setStage("LIST");
    setSelectedPayment(null);
    setSelectedPaymentToEdit(null);
    setViewOnly(false);
    setShowCertificate(false);
    setCertificate(null);
    setCalculatedCertificate(null);
    setSelectedSupplier(null);
    setSelectedCategory(null);
    setTotalAmount(0);
    setNetAmount(0);
    setIva(0);
    setCalculatedRetention(0);
    setCalculatedTotalToPay(0);
    setIsCalculated(false);
    setInvoiceLetter("A");
    setInvoiceFirst4("");
    setInvoiceLast8("");
    // Establecer valores por defecto antes de reset
    setValue("profitsCondition", "Inscripto");
    reset({
      profitsCondition: "Inscripto",
    });
  };

  const concatenateInvoiceNumber = () => {
    return `${invoiceLetter}${invoiceFirst4}${invoiceLast8}`;
  };

  const splitInvoiceNumber = (invoiceNumber) => {
    if (!invoiceNumber) return { letter: "", first4: "", last8: "" };
    const letter = invoiceNumber.charAt(0);
    const numbers = invoiceNumber.slice(1);
    const first4 = numbers.slice(0, 4);
    const last8 = numbers.slice(4);
    return { letter, first4, last8 };
  };

  const calculateCertificate = (body) => {
    if (!selectedSupplier) {
      alert("Debe seleccionar un proveedor");
      return;
    }

    if (!selectedCategory) {
      alert("Debe seleccionar una categoría");
      return;
    }

    if (!body.issueDate) {
      alert("Debe ingresar la fecha de emisión");
      return;
    }

    if (!totalAmount || totalAmount <= 0) {
      alert("Debe ingresar un importe total válido");
      return;
    }

    // Generar número de certificado temporal elegante para preview
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const hour = String(now.getHours()).padStart(2, "0");
    const minute = String(now.getMinutes()).padStart(2, "0");
    const tempCertificateNumber = `CR-${year}${month}${day}-${hour}${minute}-PREVIEW`;

    // Crear certificado calculado
    const calculatedCert = {
      certificate_number: tempCertificateNumber,
      issued_date: new Date().toISOString().split("T")[0],
      retention_amount: calculatedRetention,
      category_code: selectedCategory.code,
      category_detail: selectedCategory.description,
      supplier_name: selectedSupplier.name,
      supplier_cuit: body.supplierCuit,
      invoice_number: concatenateInvoiceNumber(),
      issue_date: body.issueDate,
      due_date: null,
      total_amount: totalAmount,
      net_amount: netAmount,
      iva: iva,
      profits_condition: body.profitsCondition || "Inscripto",
    };

    setCalculatedCertificate(calculatedCert);
    setShowCertificate(true);
    setIsCalculated(true);
  };

  const onSave = async (body) => {
    const paymentData = {
      invoiceNumber: concatenateInvoiceNumber(),
      categoryCode: selectedCategory.code,
      categoryDetail: selectedCategory.description,
      supplier: selectedSupplier.name,
      supplierCuit: body.supplierCuit,
      issueDate: body.issueDate,
      dueDate: null,
      totalAmount: totalAmount,
      netAmount: netAmount,
      iva: iva,
      profitsCondition: body.profitsCondition || "Inscripto",
      cashflowCategory: "",
      cashflowService: "",
      paymentMethod: "",
    };

    if (selectedPaymentToEdit?.id) {
      updateMutation.mutate({ ...paymentData, id: selectedPaymentToEdit.id });
    } else {
      createMutation.mutate(paymentData);
    }
  };

  const onSubmit = async (body) => {
    if (!isCalculated) {
      // Si no está calculado, calcular y mostrar certificado
      calculateCertificate(body);
    } else {
      // Si ya está calculado, guardar
      onSave(body);
    }
  };

  const onAcceptCertificate = async () => {
    // El usuario aceptó el certificado, guardar los datos
    const formValues = {
      supplierCuit: calculatedCertificate.supplier_cuit,
      issueDate: calculatedCertificate.issue_date,
      profitsCondition: calculatedCertificate.profits_condition,
    };
    
    // Guardar usando los datos del formulario
    await onSave(formValues);
  };

  const onRejectCertificate = () => {
    // El usuario rechazó el certificado, volver a calcular
    setShowCertificate(false);
    setCalculatedCertificate(null);
    setIsCalculated(false);
  };

  const redirectNavigation = () => {
    if (stage === "LIST") {
      navigate("/home");
    } else {
      setStage("LIST");
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const supplierOptions = suppliers.map((s) => ({
    id: s.id,
    label: s.fantasy_name,
    name: s.fantasy_name,
  }));

  return (
    <>
      <div className="w-full flex items-center gap-2 pb-4 pl-2 pt-4 bg-gray-50 border-b border-b-gray-200 shadow-md mb-2">
        <div className="flex gap-2 items-center justify-between text-xl font-bold text-center pl-2 w-full mr-2">
          <div
            className="flex gap-2 items-center cursor-pointer"
            onClick={redirectNavigation}
          >
            <ArrowLeftIcon className="h-5 w-5 cursor-pointer" />
            <div>Certificados de Retención</div>
          </div>
          {/* {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size={"sm"}
              onClick={() => {
                reset({
                  profitsCondition: "Inscripto",
                });
                setStage("CREATE");
                setSelectedSupplier(null);
                setSelectedCategory(null);
                setTotalAmount(0);
                setNetAmount(0);
                setIva(0);
                setCalculatedRetention(0);
                setCalculatedTotalToPay(0);
                setIsCalculated(false);
                setCalculatedCertificate(null);
                setInvoiceLetter("A");
                setInvoiceFirst4("");
                setInvoiceLast8("");
                setValue("profitsCondition", "Inscripto");
              }}
            >
              Crear
            </Button>
          )} */}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        {stage === "LIST" && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <select
              className="h-10 border rounded px-2 text-sm bg-white"
              value={selectedMonth}
              onChange={(e) => {
                setSelectedMonth(parseInt(e.target.value, 10));
                setViewAll(false);
              }}
              disabled={viewAll}
            >
              {MONTHS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <select
              className="h-10 border rounded px-2 text-sm bg-white"
              value={selectedYear}
              onChange={(e) => {
                setSelectedYear(parseInt(e.target.value, 10));
                setViewAll(false);
              }}
              disabled={viewAll}
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant={viewAll ? "alternative" : "outlined"}
              size="sm"
              className="shrink-0 h-[40px]"
              onClick={() => setViewAll((v) => !v)}
            >
              {viewAll ? "Filtrar por mes" : "Ver todo"}
            </Button>
            <div className="flex-1 min-w-[12rem] p-0 -mt-1.5">
              <Input
                size="sm"
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
          </div>
        )}

        {isLoading && (
          <div>
            <Spinner />
          </div>
        )}

        {error && <div className="text-red-500">Error al cargar los pagos</div>}

        {stage === "LIST" && payments && (
          <div className="my-4 mb-28">
            <div className="pl-1 pb-1 text-slate-500 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
              <div>
                {viewAll
                  ? "Período: todos los meses"
                  : `Período: ${MONTHS.find((m) => m.value === selectedMonth)?.label} ${selectedYear}`}
              </div>
              <div>Retenciones: {periodTotals.count}</div>
              <div className="font-semibold text-slate-700">
                Total retenido: {utils.formatAmount(periodTotals.retention)}
              </div>
              <div>
                Importe facturado: {utils.formatAmount(periodTotals.totalAmount)}
              </div>
              <div>
                Total a pagar: {utils.formatAmount(periodTotals.totalToPay)}
              </div>
            </div>
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden">
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-auto my-8">
                  <table className="border-collapse table-auto w-full text-sm">
                    <thead>
                      <tr>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Factura
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Categoría
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Proveedor
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Fecha Emisión
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Importe Total
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Neto
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          IVA
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Retención
                        </th>
                        <th className="border-b font-medium p-4 pt-0 pb-3 text-slate-400 text-left">
                          Total a Pagar
                        </th>
                        <th className="border-b font-medium p-4 pr-8 pt-0 pb-3 text-slate-400 text-left">
                          Acciones
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {listFiltered.length ? (
                        listFiltered.map((pago, index) => (
                          <tr
                            key={pago.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {pago.invoice_number ? utils.formatInvoiceNumber(pago.invoice_number) : "-"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {pago.category_code}
                              {pago.category_detail && (
                                <div className="text-xs text-gray-400">
                                  {pago.category_detail}
                                </div>
                              )}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {pago.supplier}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {pago.issue_date
                                ? utils.formatDate(pago.issue_date)
                                : "-"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              ${pago.total_amount?.toFixed(2) || "0.00"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              ${pago.net_amount?.toFixed(2) || "0.00"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              ${pago.iva?.toFixed(2) || "0.00"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              ${pago.retention_amount?.toFixed(2) || "0.00"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              ${pago.total_to_pay?.toFixed(2) || "0.00"}
                            </td>
                            <td className="!text-xs text-left border-b border-slate-100 text-slate-500 w-10">
                              <div className="flex gap-2">
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver certificado"
                                  onClick={() => onViewCertificate(pago.id)}
                                >
                                  <FileText className="w-4 h-4" />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8 text-indigo-600 hover:text-indigo-800"
                                  title="Descargar PDF"
                                  onClick={() => downloadCertificatePDF(pago.id)}
                                >
                                  <Download className="w-4 h-4" />
                                </button>
                                {/* <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(pago.id)}
                                >
                                  <EyeIcon />
                                </button> */}
                                <button
                                  className="flex items-center justify-center w-8 h-8 text-red-600 hover:text-red-800"
                                  title="Eliminar retención"
                                  onClick={() => setDeleteConfirmPayment(pago)}
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
                            colSpan={10}
                            className="border-b border-slate-100 p-4 text-slate-500"
                          >
                            No hay datos
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {stage === "CREATE" && (
          <div className="my-4">
            <div className="not-prose relative bg-slate-50 rounded-xl overflow-hidden ">
              <div
                className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,#fff,rgba(255,255,255,0.6))] "
                style={{ backgroundPosition: "10px 10px" }}
              ></div>
              <div className="relative rounded-xl overflow-auto">
                <div className="shadow-sm overflow-hidden my-8">
                  <form
                    onSubmit={handleSubmit(onSubmit)}
                    className="w-full flex flex-col"
                  >
                    <table className="border-collapse table-fixed w-full text-sm bg-white">
                      <tbody>
                        {/* Proveedor */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Proveedor:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.supplier}
                                </label>
                              ) : (
                                <div className="flex-1">
                                  <SelectComboBox
                                    options={supplierOptions}
                                    value={selectedSupplier}
                                    onChange={(value) => {
                                      setSelectedSupplier(value);
                                      if (value && suppliers) {
                                        const supplier = suppliers.find((s) => s.id === value.id);
                                        if (supplier) {
                                          setValue("supplierCuit", supplier.cuit || "");
                                          setValue("supplier", supplier.fantasy_name);
                                        }
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* CUIT */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                CUIT:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.supplier_cuit}
                                </label>
                              ) : (
                                <input
                                  type="text"
                                  defaultValue={selectedPayment?.supplier_cuit || ""}
                                  {...register("supplierCuit", { required: true })}
                                  className="rounded border border-slate-200 p-4 text-slate-500 md:w-64"
                                />
                              )}
                              {errors.supplierCuit && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Número de factura */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                N° Factura:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.invoice_number
                                    ? utils.formatInvoiceNumber(
                                        selectedPayment.invoice_number
                                      )
                                    : "-"}
                                </label>
                              ) : (
                                <div className="flex flex-wrap gap-2 items-center">
                                  <select
                                    value={invoiceLetter}
                                    onChange={(e) =>
                                      setInvoiceLetter(e.target.value)
                                    }
                                    className="rounded border border-slate-200 p-3 text-slate-500 w-16 text-center"
                                  >
                                    <option value="A">A</option>
                                    <option value="B">B</option>
                                    <option value="C">C</option>
                                  </select>
                                  <span className="text-slate-400">-</span>
                                  <input
                                    type="text"
                                    value={invoiceFirst4}
                                    onChange={(e) =>
                                      setInvoiceFirst4(
                                        e.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 4)
                                      )
                                    }
                                    placeholder="0001"
                                    maxLength={4}
                                    className="rounded border border-slate-200 p-3 text-slate-500 w-20 text-center"
                                  />
                                  <span className="text-slate-400">-</span>
                                  <input
                                    type="text"
                                    value={invoiceLast8}
                                    onChange={(e) =>
                                      setInvoiceLast8(
                                        e.target.value
                                          .replace(/\D/g, "")
                                          .slice(0, 8)
                                      )
                                    }
                                    placeholder="00000001"
                                    maxLength={8}
                                    className="rounded border border-slate-200 p-3 text-slate-500 w-28 text-center"
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Categoría */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Categoría:
                              </label>
                              {viewOnly ? (
                                <div className="text-slate-500">
                                  <div className="font-semibold">{selectedPayment?.category_code}</div>
                                  <div className="text-sm mt-1">{selectedPayment?.category_detail}</div>
                                </div>
                              ) : (
                                <div className="flex-1">
                                  <SelectComboBox
                                    options={REGIMEN_830_CATEGORIES.map((cat) => ({
                                      id: cat.code,
                                      label: `${cat.code} - ${cat.description}`,
                                      name: `${cat.code} - ${cat.description}`,
                                      code: cat.code,
                                    }))}
                                    value={selectedCategory}
                                    onChange={(value) => {
                                      setSelectedCategory(value);
                                      if (value) {
                                        setValue("categoryCode", value.code);
                                        setValue("categoryDetail", value.name);
                                        // La retención se recalcula automáticamente en el useEffect
                                        // cuando cambia selectedCategory
                                      }
                                    }}
                                  />
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Fecha de Emisión */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Fecha Emisión:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.issue_date
                                    ? utils.formatDate(selectedPayment.issue_date)
                                    : "-"}
                                </label>
                              ) : (
                                <input
                                  type="date"
                                  defaultValue={
                                    selectedPayment?.issue_date
                                      ? selectedPayment.issue_date.split("T")[0]
                                      : new Date().toISOString().split("T")[0]
                                  }
                                  {...register("issueDate", { required: true })}
                                  className="rounded border border-slate-200 p-4 text-slate-500 md:w-64"
                                />
                              )}
                              {errors.issueDate && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Importe Total */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Importe Total:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  ${selectedPayment?.total_amount?.toFixed(2) || "0.00"}
                                </label>
                              ) : (
                                <Controller
                                  name="totalAmount"
                                  control={control}
                                  rules={{ required: true, min: 0 }}
                                  render={({ field }) => (
                                    <input
                                      type="number"
                                      step="0.01"
                                      {...field}
                                      value={field.value || ""}
                                      onChange={(e) => {
                                        const value = parseFloat(e.target.value) || 0;
                                        setTotalAmount(value);
                                        field.onChange(e.target.value);
                                      }}
                                      className="rounded border border-slate-200 p-4 text-slate-500 md:w-48"
                                    />
                                  )}
                                />
                              )}
                              {errors.totalAmount && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Importe Neto */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Neto (calc.):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={netAmount}
                                {...register("netAmount")}
                                className="rounded border border-slate-200 p-4 text-slate-500 bg-gray-100 md:w-48"
                                readOnly
                              />
                            </div>
                          </td>
                        </tr>
                        {/* IVA */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                IVA (calc.):
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={iva}
                                {...register("iva")}
                                className="rounded border border-slate-200 p-4 text-slate-500 bg-gray-100 md:w-48"
                                readOnly
                              />
                            </div>
                          </td>
                        </tr>
                        {/* Condición frente a Ganancias */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Condición frente a Ganancias:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.profits_condition}
                                </label>
                              ) : (
                                <Controller
                                  name="profitsCondition"
                                  control={control}
                                  defaultValue={selectedPayment?.profits_condition || "Inscripto"}
                                  render={({ field }) => (
                                    <select
                                      {...field}
                                      value={field.value || "Inscripto"}
                                      className="rounded border border-slate-200 p-4 text-slate-500 md:w-48"
                                    >
                                      <option value="Inscripto">Inscripto</option>
                                      <option value="No inscripto">No inscripto</option>
                                    </select>
                                  )}
                                />
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Resumen de cálculos */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-start">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Resumen:
                              </label>
                              <div className="space-y-2 p-4 bg-gray-50 rounded flex-1">
                                <div className="space-y-1">
                                  <p>
                                    <strong>Retención estimada:</strong> $
                                    {calculatedRetention.toFixed(2)}
                                  </p>
                                  <p>
                                    <strong>Total a pagar estimado:</strong> $
                                    {calculatedTotalToPay.toFixed(2)}
                                  </p>
                                </div>
                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                                  <p className="font-semibold mb-1">ℹ️ Cálculo Mensual Acumulado</p>
                                  <p>
                                    La retención final se calcula considerando todos los pagos del mes para este proveedor, 
                                    categoría y condición. Se suma el acumulado mensual, se calcula la retención total del mes, 
                                    se resta lo ya retenido y se retiene solo la diferencia.
                                  </p>
                                </div>
                              </div>
                            </div>
                          </td>
                        </tr>
                        {/* Botones */}
                        <tr>
                          <td>
                            <div className="p-4 flex gap-2 items-center justify-end">
                              <Button variant="destructive" onClick={() => onCancel()}>
                                Cancelar
                              </Button>
                              {!viewOnly && (
                                <>
                                  {isCalculated && (
                                    <Button
                                      variant="alternative"
                                      onClick={() => {
                                        setShowCertificate(false);
                                        setCalculatedCertificate(null);
                                        setIsCalculated(false);
                                      }}
                                    >
                                      Resetear
                                    </Button>
                                  )}
                                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                                    {createMutation.isPending || updateMutation.isPending ? (
                                      <Spinner />
                                    ) : isCalculated ? (
                                      selectedPaymentToEdit?.id ? "Actualizar" : "Guardar"
                                    ) : (
                                      "Calcular"
                                    )}
                                  </Button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </form>
                </div>
              </div>
              <div className="absolute inset-0 pointer-events-none border border-black/5 rounded-xl"></div>
            </div>
          </div>
        )}

        {/* Vista de Certificado */}
        {showCertificate && (certificate || calculatedCertificate) && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 print:relative print:inset-auto print:bg-transparent print:z-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-auto print:shadow-none print:max-h-none">
              <div className="p-6 print:p-8">
                <div className="flex justify-between items-center mb-6 print:hidden">
                  <h2 className="text-2xl font-bold">
                    {calculatedCertificate ? "Vista Previa del Certificado" : "Certificado de Retención"}
                  </h2>
                  <div className="flex gap-2">
                    {calculatedCertificate ? (
                      <>
                        <Button
                          variant="destructive"
                          onClick={onRejectCertificate}
                          size="sm"
                        >
                          Cancelar
                        </Button>
                        <Button
                          onClick={onAcceptCertificate}
                          size="sm"
                        >
                          Aceptar y Guardar
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="alternative"
                          onClick={() => {
                            if (certificate?.retention_payment_id) {
                              downloadCertificatePDF(certificate.retention_payment_id);
                            }
                          }}
                          size="sm"
                        >
                          <Download className="w-4 h-4 mr-2" />
                          Descargar PDF
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={() => {
                            setShowCertificate(false);
                            setCertificate(null);
                          }}
                          size="sm"
                        >
                          Cerrar
                        </Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="border-2 border-gray-300 p-8 print:border-gray-800">
                  <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold mb-2">CERTIFICADO DE RETENCIÓN</h1>
                    <p className="text-lg">Régimen de Retención de Ganancias</p>
                    {calculatedCertificate && (
                      <p className="text-sm text-amber-600 mt-2 font-semibold">(Vista Previa - No Guardado)</p>
                    )}

                    <div>
                      <p className="font-semibold">Gerardfil SRL - CUIT: 30-71878217-8</p>
                      <p>Pilar 5180, Caseros, Buenos Aires - Tel: 54 11 7856 4391</p>
                    </div>
                  </div>

                  {(() => {
                    const certData = calculatedCertificate || certificate;
                    return (
                      <div className="space-y-4 mb-8">

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold">Número de Certificado:</p>
                            <p>{certData.certificate_number}</p>
                          </div>

                          <div>
                            <p className="font-semibold">Fecha de Emisión:</p>
                            <p>
                              {utils.formatDate(certData.issued_date)}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold">Razón Social:</p>
                            <p>{certData.supplier_name}</p>
                          </div>
                          <div>
                            <p className="font-semibold">CUIT:</p>
                            <p>{certData.supplier_cuit}</p>
                          </div>
                        </div>

                        {
                          /*

                         
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold">Número de Factura:</p>
                            <p>{certData.invoice_number ? utils.formatInvoiceNumber(certData.invoice_number) : "-"}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-semibold">Fecha de Factura:</p>
                              <p>
                                {utils.formatDate(certData.issue_date)}
                              </p>
                            </div>
                            {certData.due_date && (
                              <div>
                                <p className="font-semibold">Fecha de Vencimiento:</p>
                                <p>
                                  {utils.formatDate(certData.due_date)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                          */
                        }

                        <div>
                          <p className="font-semibold">Categoría (Régimen 830):</p>
                          <div className="flex">
                          <p className="mt-1"><b>{certData.category_code}</b> - {REGIMEN_830_CATEGORIES.find(cat => cat.code === certData.category_code)?.description}</p>
                          </div>
                        </div>

                        <div>
                          <p className="font-semibold">Condición frente a Ganancias:</p>
                          <p>{certData.profits_condition}</p>
                        </div>

                        <div className="flex gap-2 justify-between">
                          <div>
                            <p className="font-semibold">Total a pagar:</p>
                            <p className="text-xl font-bold">${
                              calculatedCertificate
                                ? calculatedTotalToPay?.toFixed(2) || "0.00"
                                : selectedPayment?.total_to_pay?.toFixed(2) ||
                                  ((certData.net_amount * 1.21) - (certData.retention_amount || 0)).toFixed(2) ||
                                  "0.00"
                            }</p>
                          </div>
                          
                          
                            <div>
                              <p className="font-semibold">Monto Retenido:</p>
                              <p className="text-xl font-bold">
                                ${certData.retention_amount?.toFixed(2) || "0.00"}
                              </p>
                            </div>
                          
                            <div>
                              <p className="font-semibold">Total Factura:</p>
                              <p className="text-xl font-bold">
                                ${certData.total_amount?.toFixed(2) || selectedPayment?.total_amount?.toFixed(2) || "0.00"}
                              </p>
                            </div>

                          </div>
                        </div>
                    );
                  })()}

                  <div className="mt-12 pt-8 border-t-2 border-gray-300">
                    <p className="text-center text-sm text-gray-600">
                      Este certificado ha sido generado electrónicamente y tiene validez legal
                      conforme a la normativa vigente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteConfirmPayment)}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteConfirmPayment(null);
        }}
        title="¿Eliminar retención?"
        description="El saldo pendiente de la factura se recalculará sin el monto retenido. Esta acción no se puede deshacer."
        confirmLabel="Eliminar retención"
        cancelLabel="Cancelar"
        variant="destructive"
        isLoading={deleteMutation.isPending}
        onConfirm={confirmDeletePayment}
      >
        {deleteConfirmPayment && (
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
            {deleteConfirmPayment.supplier && (
              <>
                <dt className="text-slate-500">Proveedor</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {deleteConfirmPayment.supplier}
                </dd>
              </>
            )}
            {deleteConfirmPayment.invoice_number && (
              <>
                <dt className="text-slate-500">Factura</dt>
                <dd className="font-medium text-slate-800 text-right">
                  {deleteConfirmPayment.invoice_number}
                </dd>
              </>
            )}
            <dt className="text-slate-500">Monto retenido</dt>
            <dd className="font-semibold text-slate-900 tabular-nums text-right">
              ${Number(deleteConfirmPayment.retention_amount || 0).toFixed(2)}
            </dd>
          </dl>
        )}
      </ConfirmDialog>
    </>
  );
}

