import { useNavigate } from "react-router-dom";
import React, { useState, useEffect, useCallback } from "react";
import { useForm, Controller } from "react-hook-form";
import { ArrowLeftIcon } from "@heroicons/react/24/solid";
import { queryRetentionPaymentsKey, queryRetentionCertificateKey, querySuppliersKey } from "../apis/queryKeys";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { CopyIcon, EditIcon, TrashIcon, EyeIcon, CloseIcon, ReceiptIcon } from "./icons";
import * as utils from "../utils/utils";
import Button from "./common/Button";
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

export default function RetentionCertificates() {
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [selectedPaymentToEdit, setSelectedPaymentToEdit] = useState(null);
  const [stage, setStage] = useState("LIST");
  const [viewOnly, setViewOnly] = useState(false);
  const [search, setSearch] = useState("");
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
    data: suppliers,
    isLoading: isLoadingSuppliers,
  } = useQuery({
    queryKey: querySuppliersKey(),
    queryFn: useSuppliersQuery,
  });

  const watchedTotalAmount = watch("totalAmount");
  const watchedProfitsCondition = watch("profitsCondition");

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

  // Tabla AFIP de retenciones: Categoría -> { inscripto: %, noInscripto: %, montoNoSujeto: $, usaEscala: boolean }
  const RETENTION_TABLE = {
    "19": { inscripto: 0.03, noInscripto: 0.10, montoNoSujeto: 0, usaEscala: false, descripcion: "Intereses por operaciones realizadas en entidades financieras" },
  "21": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, descripcion: "ntereses originados en operaciones no comprendidas en la categoria 19." },
  "25": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true, descripcion: "Comisiones u otras retribuciones derivadas de la actividad de comisionista, rematador, consignatario y demás auxiliares de comercio a que se refiere el inciso c) del artículo 49 de la Ley de Impuesto a las Ganancias, texto ordenado en 1997 y sus modificaciones" },
  "30": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, descripcion: "Alquileres o arrendamientos de bienes muebles" },
  "31": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, descripcion: "Bienes Inmuebles Urbanos, incluidos los efectuados bajo la modalidad de leasing – incluye suburbanos." },
  "32": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 11200, usaEscala: false, descripcion: "Bienes Inmuebles Rurales, incluidos los efectuados bajo la modalidad de leasing – incluye subrurales." },
  "35": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, descripcion: "Regalias" },
  "43": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, descripcion: "Interés accionario, excedentes y retornos distribuidos entre asociados, cooperativas - excepto consumo" },
  "51": { inscripto: 0.06, noInscripto: 0.28, montoNoSujeto: 7870, usaEscala: false, descripcion: "Obligaciones de no hacer, o por abandono o no ejercicio de una actividad" },
  "53": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, descripcion: "Operaciones realizadas por intermedio de mercados de cereales a término que se resuelvan en el curso del término (arbitrajes) y de mercados de futuros y opciones" },
  "55": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, descripcion: "Distribución de películas. Transmisión de programación. Televisión vía satelital" },
  "78": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false, descripcion: "Enajenación de bienes muebles y bienes de cambio" },
  "86": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 224000, usaEscala: false, descripcion: "Transferencia temporaria o definitiva de derechos de llave, marcas, patentes de invención, regalías, concesiones y similares" },
  "94": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false, descripcion: "Locaciones de obra y/o servicios no ejecutados en relación de dependencia no mencionados expresamente en otros incisos" },
  "95": { inscripto: 0.0025, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: false, descripcion: "Operaciones de transporte de carga nacional e internacional" },
  "110": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 10000, usaEscala: true, descripcion: "Explotación de derechos de autor (Ley N° 11.723)" },
  "111": { inscripto: 0.005, noInscripto: 0.02, montoNoSujeto: 0, usaEscala: false, descripcion: "Cualquier otra cesión o locación de derechos, excepto las que correspondan a operaciones realizadas por intermedio de mercados de cereales a término que se resuelvan en el curso del término (arbitrajes) y de mercados de futuros y opciones." },
  "112": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false, descripcion: "SeguridadBeneficios provenientes del cumplimiento de los requisitos de los planes de seguro de retiro privados administrados por entidades sujetas al control de la Superintendencia de Seguros de la Nación, establecidos por el inciso d) del artículo 45 y el inciso d) del artículo 79, de la Ley de Impuesto a las Ganancias, texto ordenado en 1997 y sus modificaciones -excepto cuando se encuentren alcanzados por el régimen de retención establecido por la Resolución General N° 2,437, sus modificatorias y complementarias." },
  "113": { inscripto: 0.03, noInscripto: 0.03, montoNoSujeto: 16830, usaEscala: false, descripcion: "VigilanciaRescates -totales o parciales- por desistimiento de los planes de seguro de retiro a que se refiere el inciso o), excepto que sea de aplicación lo normado en el artículo 101 de la Ley de Impuesto a las Ganancias, texto ordenado en 1997 y sus modificaciones." },
  "116": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 67170, usaEscala: true, descripcion: "Honorarios de director de sociedades anónimas, síndico, fiduciario, consejero de sociedades cooperativas, integrante de consejos de vigilancia y socios administradores de las sociedades de responsabilidad limitada, en comandita simple y en comandita por acciones." },
  "124": { inscripto: null, noInscripto: 0.28, montoNoSujeto: 16830, usaEscala: true, descripcion: "Corredor, viajante de comercio y despachante de aduana" },
  "779": { inscripto: 0.02, noInscripto: 0.10, montoNoSujeto: 76140, usaEscala: false, descripcion: "Subsidios abonados por los Estados Nacional, provinciales, municipales o el Gobierno de la Ciudad Autónoma de Buenos Ares, en concepto de enajenación de bienes muebles y bienes de cambio, en la medida que una ley general o especial no establezca la exención de los mismos en el impuesto a las ganancias. " },
  "780": { inscripto: 0.02, noInscripto: 0.28, montoNoSujeto: 31460, usaEscala: false, descripcion: "Subsidios abonados por los Estados Nacional, provinciales, municipales o el Gobierno de la Ciudad Autónoma de Buenos Aires, en concepto de locaciones de obra y/o servicios, no ejecutados en relación de dependencia, en la medida que una ley general o especial no establezca la exención de los mismos en el impuesto a las ganancias." },
  };

  // Funciones auxiliares de cálculo (iguales a RetentionCalculator.js)
  const calculateNetAndIVA = useCallback((totalAmount) => {
    const factor = 1 + 0.21;
    const netAmount = totalAmount / factor;
    const iva = totalAmount - netAmount;
    return {
      netAmount: Math.round(netAmount * 100) / 100,
      iva: Math.round(iva * 100) / 100,
    };
  }, []);

  const calculateScaleRetention = useCallback((netAmount, montoNoSujeto) => {
    if (netAmount <= montoNoSujeto) {
      return 0;
    }

    const montoSujeto = netAmount - montoNoSujeto;
    
    const scale = RETENTION_SCALES.find(
      (s) => montoSujeto >= s.min && montoSujeto < s.max
    );

    if (!scale) {
      return 0;
    }

    const retention = scale.fixed + (montoSujeto - scale.min) * scale.percentage;
    return Math.round(retention * 100) / 100;
  }, []);

  // Función de cálculo de retención (igual a RetentionCalculator.js)
  const calculateRetention = useCallback((categoryCode, inscripto, amount) => {
    if (amount <= 0) {
      return {
        retention: 0,
        netAmount: 0,
        iva: 0,
      };
    }

    const categoryConfig = RETENTION_TABLE[categoryCode];
    
    if (!categoryConfig) {
      return {
        retention: 0,
        netAmount: 0,
        iva: 0,
      };
    }

    // Calcular neto e IVA
    const { netAmount, iva } = calculateNetAndIVA(amount);
    const montoNoSujeto = categoryConfig.montoNoSujeto;
    let retention = 0;

    if (inscripto) {
      if (categoryConfig.usaEscala) {
        retention = calculateScaleRetention(netAmount, montoNoSujeto);
      } else {
        const porcentaje = categoryConfig.inscripto;
        
        if (porcentaje === null) {
          retention = 0;
        } else {
          if (netAmount > montoNoSujeto) {
            retention = Math.round((netAmount - montoNoSujeto) * porcentaje * 100) / 100;
          } else {
            retention = 0;
          }
        }
      }
    } else {
      // No inscripto
      if (categoryConfig.usaEscala) {
        retention = calculateScaleRetention(netAmount, montoNoSujeto);
      } else {
        const porcentaje = categoryConfig.noInscripto;
        
        if (netAmount > montoNoSujeto) {
          retention = Math.round((netAmount - montoNoSujeto) * porcentaje * 100) / 100;
        } else {
          retention = 0;
        }
      }
    }

    return {
      retention,
      netAmount,
      iva,
    };
  }, [calculateNetAndIVA, calculateScaleRetention]);

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

  // Sincronizar valores de cashflow cuando se edita un pago
  useEffect(() => {
    if (selectedPaymentToEdit && stage === "FORM") {
      // Asegurar que los valores se establezcan correctamente después del reset
      const payment = selectedPaymentToEdit;
      if (payment.cashflow_category) {
        setValue("cashflowCategory", payment.cashflow_category);
        setCashflowCategory(payment.cashflow_category);
      }
      if (payment.cashflow_service) {
        setValue("cashflowService", payment.cashflow_service);
        setCashflowService(payment.cashflow_service);
      }
      if (payment.cashflow_payment_method) {
        setValue("paymentMethod", payment.cashflow_payment_method);
        setPaymentMethod(payment.cashflow_payment_method);
      }
    }
  }, [selectedPaymentToEdit, stage, setValue]);

  // Establecer valores por defecto cuando se crea un nuevo pago
  useEffect(() => {
    if (stage === "CREATE" && !selectedPaymentToEdit) {
      // Establecer valores por defecto para nuevos pagos
      const defaultPaymentMethod = utils.getPaymentMethods()[0] || "EFECTIVO";
      setValue("profitsCondition", "Inscripto");
      setValue("paymentMethod", defaultPaymentMethod);
      setPaymentMethod(defaultPaymentMethod);
    }
  }, [stage, selectedPaymentToEdit, setValue]);

  const dataFiltered =
    payments &&
    payments?.length > 0 &&
    payments?.filter((d) =>
      search
        ? d.supplier.toLowerCase().includes(search.toLowerCase()) ||
          d.invoice_number.toLowerCase().includes(search.toLowerCase())
        : d
    );

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
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
      console.log("Pago eliminado:", data);
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
    
    // Obtener campos de cashflow del payment
    setCashflowCategory(payment?.cashflow_category || "");
    setCashflowService(payment?.cashflow_service || "");
    setPaymentMethod(payment?.cashflow_payment_method || utils.getPaymentMethods()[0] || "EFECTIVO");
    
    // Establecer valores en el formulario
    setValue("cashflowCategory", payment?.cashflow_category || "");
    setValue("cashflowService", payment?.cashflow_service || "");
    setValue("paymentMethod", payment?.cashflow_payment_method || utils.getPaymentMethods()[0] || "EFECTIVO");
    
    // Parsear número de factura
    if (payment?.invoice_number) {
      const { letter, first4, last8 } = splitInvoiceNumber(payment.invoice_number);
      setInvoiceLetter(letter || "A");
      setInvoiceFirst4(first4 || "");
      setInvoiceLast8(last8 || "");
    } else {
      setInvoiceLetter("A");
      setInvoiceFirst4("");
      setInvoiceLast8("");
    }
    
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

  const removePayment = async (payment_id) => {
    if (window.confirm("¿Seguro desea eliminar este pago?")) {
      try {
        await deleteMutation.mutate(payment_id);
        setStage("LIST");
      } catch (e) {
        console.log(e);
      }
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
    setFormSubmitted(false);
    setCashflowCategory("");
    setCashflowService("");
    setPaymentMethod(utils.getPaymentMethods()[0] || "EFECTIVO");
    // Establecer valores por defecto antes de reset
    setValue("profitsCondition", "Inscripto");
    setValue("paymentMethod", utils.getPaymentMethods()[0] || "EFECTIVO");
    reset({
      profitsCondition: "Inscripto",
      paymentMethod: utils.getPaymentMethods()[0] || "EFECTIVO",
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

    // Validar formato de factura
    if (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) {
      alert("Debe completar todos los campos del número de factura");
      setFormSubmitted(true);
      return;
    }

    if (invoiceFirst4.length !== 4) {
      alert("El punto de venta debe tener 4 dígitos");
      setFormSubmitted(true);
      return;
    }

    if (invoiceLast8.length !== 8) {
      alert("El número de factura debe tener 8 dígitos");
      setFormSubmitted(true);
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

    if (!cashflowCategory) {
      alert("Debe seleccionar una categoría para el cashflow");
      return;
    }

    if (!cashflowService) {
      alert("Debe seleccionar un servicio para el cashflow");
      return;
    }

    if (!paymentMethod) {
      alert("Debe seleccionar una forma de pago");
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

    const concatenatedInvoiceNumber = concatenateInvoiceNumber();

    // Crear certificado calculado
    const calculatedCert = {
      certificate_number: tempCertificateNumber,
      issued_date: new Date().toISOString().split("T")[0],
      retention_amount: calculatedRetention,
      category_code: selectedCategory.code,
      category_detail: selectedCategory.description,
      supplier_name: selectedSupplier.name,
      supplier_cuit: body.supplierCuit,
      invoice_number: concatenatedInvoiceNumber,
      issue_date: body.issueDate,
      due_date: null,
      total_amount: totalAmount,
      net_amount: netAmount,
      iva: iva,
      profits_condition: body.profitsCondition,
    };

    setCalculatedCertificate(calculatedCert);
    setShowCertificate(true);
    setIsCalculated(true);
  };

  const onSave = async (body) => {
    const concatenatedInvoiceNumber = concatenateInvoiceNumber();
    
    const paymentData = {
      invoiceNumber: concatenatedInvoiceNumber,
      categoryCode: selectedCategory.code,
      categoryDetail: selectedCategory.description,
      supplier: selectedSupplier.name,
      supplierCuit: body.supplierCuit,
      issueDate: body.issueDate,
      dueDate: null,
      totalAmount: totalAmount,
      netAmount: netAmount,
      iva: iva,
      profitsCondition: body.profitsCondition,
      cashflowCategory: cashflowCategory,
      cashflowService: cashflowService,
      paymentMethod: paymentMethod,
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

  const supplierOptions =
    suppliers?.map((s) => ({
      id: s.id,
      label: s.fantasy_name,
      name: s.fantasy_name,
    })) || [];

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
          {stage === "LIST" && !viewOnly && (
            <Button
              variant="alternative"
              className="ml-auto"
              size={"sm"}
              onClick={() => {
                const defaultPaymentMethod = utils.getPaymentMethods()[0] || "EFECTIVO";
                reset({
                  profitsCondition: "Inscripto",
                  paymentMethod: defaultPaymentMethod,
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
                setFormSubmitted(false);
                setCashflowCategory("");
                setCashflowService("");
                setPaymentMethod(defaultPaymentMethod);
                setValue("profitsCondition", "Inscripto");
                setValue("paymentMethod", defaultPaymentMethod);
              }}
            >
              Crear
            </Button>
          )}
        </div>
      </div>

      <div className="px-4 h-full overflow-auto">
        {stage === "LIST" && (
          <div className="w-full flex shadow rounded mb-4">
            <Input
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
        )}

        {isLoading && (
          <div>
            <Spinner />
          </div>
        )}

        {error && <div className="text-red-500">Error al cargar los pagos</div>}

        {stage === "LIST" && payments && (
          <div className="my-4 mb-28">
            <div className="pl-1 pb-1 text-slate-500 flex items-center gap-2 text-sm">
              <div>Total de pagos: {payments.length}</div>
              <div>
                Importe total:{" "}
                {utils.formatAmount(
                  payments.reduce((acc, p) => acc + (p.total_amount || 0), 0)
                )}
              </div>
              <div>
                Retenciones:{" "}
                {utils.formatAmount(
                  payments.reduce((acc, p) => acc + (p.retention_amount || 0), 0)
                )}
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
                      {dataFiltered && dataFiltered.length ? (
                        dataFiltered.map((pago, index) => (
                          <tr
                            key={pago.id}
                            className={utils.cn(
                              "border-b last:border-b-0 hover:bg-gray-100",
                              index % 2 === 0 && "bg-gray-50"
                            )}
                          >
                            <td className="!text-xs text-left border-b border-slate-100 p-4 text-slate-500">
                              {utils.formatInvoiceNumber(pago.invoice_number)}
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
                                ? new Date(pago.issue_date).toLocaleDateString()
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
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Ver detalle"
                                  onClick={() => onView(pago.id)}
                                >
                                  <EyeIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Editar"
                                  onClick={() => onEdit(pago.id)}
                                >
                                  <EditIcon />
                                </button>
                                <button
                                  className="flex items-center justify-center w-8 h-8"
                                  title="Eliminar"
                                  onClick={() => removePayment(pago.id)}
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
                        {/* Número de Factura */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Factura Nro:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.invoice_number
                                    ? utils.formatInvoiceNumber(selectedPayment.invoice_number)
                                    : "-"}
                                </label>
                              ) : (
                                <div className="flex flex-col gap-2">
                                  <div className="flex gap-2 items-center">
                                    <select
                                      value={invoiceLetter}
                                      onChange={(e) => setInvoiceLetter(e.target.value)}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-16 text-center"
                                    >
                                      <option value="A">A</option>
                                      <option value="B">B</option>
                                      <option value="C">C</option>
                                    </select>
                                    <span className="text-slate-400">-</span>
                                    <input
                                      type="text"
                                      value={invoiceFirst4}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "").slice(0, 4);
                                        setInvoiceFirst4(value);
                                      }}
                                      placeholder="0001"
                                      maxLength={4}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-20 text-center"
                                    />
                                    <span className="text-slate-400">-</span>
                                    <input
                                      type="text"
                                      value={invoiceLast8}
                                      onChange={(e) => {
                                        const value = e.target.value.replace(/\D/g, "").slice(0, 8);
                                        setInvoiceLast8(value);
                                      }}
                                      placeholder="00000001"
                                      maxLength={8}
                                      className="rounded border border-slate-200 p-4 text-slate-500 w-28 text-center"
                                    />
                                  </div>
                                  {formSubmitted && (!invoiceLetter || !invoiceFirst4 || !invoiceLast8) && (
                                    <span className="text-red-500 text-sm">
                                      * Todos los campos son obligatorios
                                    </span>
                                  )}
                                  {formSubmitted && invoiceFirst4.length !== 4 && (
                                    <span className="text-red-500 text-sm">
                                      * El punto de venta debe tener 4 dígitos
                                    </span>
                                  )}
                                  {formSubmitted && invoiceLast8.length !== 8 && (
                                    <span className="text-red-500 text-sm">
                                      * El número de factura debe tener 8 dígitos
                                    </span>
                                  )}
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
                                    ? new Date(selectedPayment.issue_date).toLocaleDateString()
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
                                  rules={{ required: true }}
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
                              {errors.profitsCondition && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Condición (Categoría del proveedor) */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Condición:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.cashflow_category || "-"}
                                </label>
                              ) : (
                                <Controller
                                  name="cashflowCategory"
                                  control={control}
                                  rules={{ required: !viewOnly }}
                                  render={({ field }) => (
                                    <select
                                      {...field}
                                      value={cashflowCategory || ""}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setCashflowCategory(value);
                                        field.onChange(value);
                                      }}
                                      className="rounded border border-slate-200 p-4 text-slate-500 md:w-64"
                                    >
                                      <option value="">SELECCIONAR</option>
                                      {utils.getCashflowOutCategories().map((cat) => (
                                        <option key={cat} value={cat}>
                                          {cat}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                />
                              )}
                              {errors.cashflowCategory && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Servicio */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Servicio:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">
                                  {selectedPayment?.cashflow_service || "-"}
                                </label>
                              ) : (
                                <Controller
                                  name="cashflowService"
                                  control={control}
                                  rules={{ required: !viewOnly }}
                                  render={({ field }) => (
                                    <select
                                      {...field}
                                      value={cashflowService || ""}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setCashflowService(value);
                                        field.onChange(value);
                                      }}
                                      className="rounded border border-slate-200 p-4 text-slate-500 md:w-64"
                                    >
                                      <option value="">SELECCIONAR</option>
                                      {utils.getExpensesCategories().map((service) => (
                                        <option key={service} value={service}>
                                          {service}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                />
                              )}
                              {errors.cashflowService && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
                              )}
                            </div>
                          </td>
                        </tr>
                        {/* Forma de Pago */}
                        <tr>
                          <td>
                            <div className="p-4 flex flex-col md:flex-row gap-2 md:gap-4 md:items-center">
                              <label className="text-slate-500 md:w-32 font-bold">
                                Forma de Pago:
                              </label>
                              {viewOnly ? (
                                <label className="text-slate-500">-</label>
                              ) : (
                                <Controller
                                  name="paymentMethod"
                                  control={control}
                                  rules={{ required: !viewOnly }}
                                  defaultValue={utils.getPaymentMethods()[0] || "EFECTIVO"}
                                  render={({ field }) => (
                                    <select
                                      {...field}
                                      value={field.value || paymentMethod || utils.getPaymentMethods()[0] || "EFECTIVO"}
                                      onChange={(e) => {
                                        const value = e.target.value;
                                        setPaymentMethod(value);
                                        field.onChange(value);
                                      }}
                                      className="rounded border border-slate-200 p-4 text-slate-500 md:w-64"
                                    >
                                      {utils.getPaymentMethods().map((method) => (
                                        <option key={method} value={method}>
                                          {method}
                                        </option>
                                      ))}
                                    </select>
                                  )}
                                />
                              )}
                              {errors.paymentMethod && (
                                <span className="px-2 text-red-500">* Obligatorio</span>
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
                    {/* <Button onClick={handlePrint} size="sm">
                      <ReceiptIcon className="w-4 h-4 mr-2" />
                      Imprimir
                    </Button> */}
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
                              {certData.issued_date
                                ? new Date(certData.issued_date).toLocaleDateString("es-AR")
                                : "-"}
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

                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="font-semibold">Número de Factura:</p>
                            <p>{utils.formatInvoiceNumber(certData.invoice_number)}</p>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <p className="font-semibold">Fecha de Factura:</p>
                              <p>
                                {certData.issue_date
                                  ? new Date(certData.issue_date).toLocaleDateString("es-AR")
                                  : "-"}
                              </p>
                            </div>
                            {certData.due_date && (
                              <div>
                                <p className="font-semibold">Fecha de Vencimiento:</p>
                                <p>
                                  {new Date(certData.due_date).toLocaleDateString("es-AR")}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

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
    </>
  );
}

