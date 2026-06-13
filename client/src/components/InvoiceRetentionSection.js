import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import Button from "./common/Button";
import Spinner from "./common/Spinner";
import RetentionCertificateDialog from "./RetentionCertificateDialog";
import RetentionFormDialog from "./RetentionFormDialog";
import { fetchRetentionByInvoice } from "../apis/api.retentioncertificates";
import {
  queryRetentionByInvoiceKey,
  queryRetentionPaymentsKey,
} from "../apis/queryKeys";
import { retentionLookupParams, invoiceSupportsRetention } from "../utils/retentionInvoice";
import * as utils from "../utils/utils";

export default function InvoiceRetentionSection({
  invoice,
  enabled = true,
  className,
  onRetentionCreated,
}) {
  const queryClient = useQueryClient();
  const [retentionFormOpen, setRetentionFormOpen] = useState(false);
  const [certOpen, setCertOpen] = useState(false);
  const [createdRetention, setCreatedRetention] = useState(null);

  const lookup = retentionLookupParams(invoice);
  const supportsRetention = invoiceSupportsRetention(invoice?.invoice_number);
  const canLookup = Boolean(
    lookup.supplierInvoiceId ||
      lookup.accountMovementId ||
      lookup.invoiceNumber ||
      lookup.supplierId
  );

  const { data: retentionRes, isLoading: retentionLoading } = useQuery({
    queryKey: queryRetentionByInvoiceKey(lookup),
    queryFn: () => fetchRetentionByInvoice(lookup),
    enabled: enabled && supportsRetention && canLookup,
  });

  const retentionPayment = retentionRes?.data?.payment || null;
  const retentionCertificate = retentionRes?.data?.certificate || null;

  const invalidateRetention = () => {
    queryClient.invalidateQueries({ queryKey: queryRetentionPaymentsKey() });
    queryClient.invalidateQueries({ queryKey: queryRetentionByInvoiceKey(lookup) });
  };

  const handleRetentionCreated = (result) => {
    setRetentionFormOpen(false);
    invalidateRetention();
    if (result?.payment) {
      setCreatedRetention(result);
      setCertOpen(true);
    }
    onRetentionCreated?.(result);
  };

  if (!invoice || !supportsRetention) return null;

  return (
    <>
      <div className={utils.cn("border-t border-slate-100 pt-4 mt-4", className)}>
        <span className="text-xs text-slate-400 uppercase tracking-wide block mb-2">
          Retención
        </span>

        {retentionLoading ? (
          <div className="flex justify-center py-4">
            <Spinner />
          </div>
        ) : retentionPayment ? (
          <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 text-xs">Estado</span>
              <span className="font-semibold text-violet-700">
                Retención realizada
              </span>
            </div>
            {(retentionPayment.category_code ||
              retentionPayment.category_detail) && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Categoría</span>
                <span className="font-medium text-slate-700 text-right">
                  {retentionPayment.category_code}
                  {retentionPayment.category_detail
                    ? ` - ${retentionPayment.category_detail}`
                    : ""}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 text-xs">Monto retenido</span>
              <span className="font-semibold text-slate-800">
                {utils.formatAmount(retentionPayment.retention_amount)}
              </span>
            </div>
            {retentionPayment.total_to_pay != null && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Total a pagar</span>
                <span className="font-medium text-slate-700">
                  {utils.formatAmount(retentionPayment.total_to_pay)}
                </span>
              </div>
            )}
            {retentionCertificate?.certificate_number && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-500 text-xs">Certificado</span>
                <span className="font-medium text-slate-700">
                  {retentionCertificate.certificate_number}
                </span>
              </div>
            )}
            <div className="pt-1">
              <Button
                type="button"
                variant="outlined"
                size="sm"
                onClick={() => setCertOpen(true)}
              >
                <FileText className="h-4 w-4 mr-1" />
                Ver comprobante
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-amber-200 bg-amber-50 p-3">
            <span className="text-sm text-amber-700">
              No hay retención registrada para esta factura. Verificá si
              corresponde practicarle retención.
            </span>
            <Button
              type="button"
              variant="default"
              size="sm"
              className="self-start"
              onClick={() => setRetentionFormOpen(true)}
            >
              <FileText className="h-4 w-4 mr-1" />
              Calcular y registrar retención
            </Button>
          </div>
        )}
      </div>

      <RetentionCertificateDialog
        open={certOpen}
        onOpenChange={setCertOpen}
        certificate={createdRetention?.certificate || retentionCertificate}
        payment={createdRetention?.payment || retentionPayment}
      />

      <RetentionFormDialog
        open={retentionFormOpen}
        onOpenChange={setRetentionFormOpen}
        invoice={invoice}
        onCreated={handleRetentionCreated}
      />
    </>
  );
}
