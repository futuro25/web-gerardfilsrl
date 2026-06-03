import { useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogTitle } from "./common/Dialog";
import FormActions from "./common/FormActions";
import SupplierInvoiceForm from "./SupplierInvoiceForm";
import * as utils from "../utils/utils";
import {
  createSupplierInvoice,
  updateSupplierInvoice,
} from "../apis/api.supplierinvoices";
import { updateAccountMovement } from "../apis/api.accountmovements";
import { uploadInvoiceImage } from "../apis/api.uploads";
import {
  querySupplierAccountsListKey,
  querySupplierInvoiceByMovementKey,
  querySupplierAccountKey,
  queryPendingPaymentItemsKey,
  queryPurchaseInvoicesKey,
} from "../apis/queryKeys";

export default function InvoiceDataDialog({
  open,
  onOpenChange,
  accountMovement,
  onSaved,
}) {
  const queryClient = useQueryClient();
  const movementId = accountMovement?.id;
  const formRef = useRef(null);
  const [showErrors, setShowErrors] = useState(false);
  const [isLoadingSubmit, setIsLoadingSubmit] = useState(false);

  const createMutation = useMutation({ mutationFn: createSupplierInvoice });
  const updateMutation = useMutation({ mutationFn: updateSupplierInvoice });

  const onSubmit = async (e) => {
    e.preventDefault();
    const validation = formRef.current?.validate();
    if (!validation?.ok) {
      setShowErrors(true);
      return;
    }

    try {
      setIsLoadingSubmit(true);
      const payload = formRef.current.buildPayload(movementId);
      const imageFile = formRef.current.getImageFile?.();
      if (imageFile) {
        const uploadRes = await uploadInvoiceImage(imageFile);
        payload.image_key = uploadRes?.key || null;
      }

      const existingId = formRef.current.getExistingInvoiceId();
      if (existingId) {
        await updateMutation.mutateAsync({ ...payload, id: existingId });
      } else {
        await createMutation.mutateAsync(payload);
      }

      queryClient.invalidateQueries({
        queryKey: querySupplierAccountsListKey(),
      });
      queryClient.invalidateQueries({
        queryKey: querySupplierInvoiceByMovementKey(movementId),
      });
      queryClient.invalidateQueries({ queryKey: queryPendingPaymentItemsKey() });
      queryClient.invalidateQueries({ queryKey: queryPurchaseInvoicesKey() });
      if (payload.supplier_id) {
        queryClient.invalidateQueries({
          queryKey: querySupplierAccountKey(payload.supplier_id),
        });
      }

      if (movementId && accountMovement) {
        await updateAccountMovement({
          id: movementId,
          type: accountMovement.type,
          movement_kind: accountMovement.movement_kind || "UNICA VEZ",
          date: accountMovement.date,
          amount: payload.total,
          description: accountMovement.description,
          is_cheque: accountMovement.is_cheque || false,
          cheque_number: accountMovement.cheque_number,
          cheque_bank: accountMovement.cheque_bank,
          cheque_due_date: accountMovement.cheque_due_date,
          expense_category: accountMovement.expense_category || "FACTURA",
          payment_method: null,
        });
      }

      setIsLoadingSubmit(false);
      onSaved?.();
      onOpenChange(false);
    } catch (err) {
      console.error(err);
      setIsLoadingSubmit(false);
      window.alert(err.message || "No se pudo guardar la factura");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="w-[95vw] max-w-lg max-h-[90vh] overflow-y-auto p-6 gap-4"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="text-lg font-semibold text-slate-800 pr-8">
          Datos de factura
        </DialogTitle>
        {accountMovement && (
          <p className="text-xs text-slate-500 -mt-2">
            Movimiento egreso #{accountMovement.id} ·{" "}
            {utils.formatAmount(accountMovement.amount)} ·{" "}
            {accountMovement.description || "Sin detalle"}
          </p>
        )}

        {!open ? null : (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <SupplierInvoiceForm
              ref={formRef}
              accountMovement={accountMovement}
              movementDate={accountMovement?.date}
              movementDescription={accountMovement?.description}
              enabled={open}
              showErrors={showErrors}
              showImageUpload
              embedded
            />
            <FormActions
              className="pt-2"
              equalWidth
              onCancel={() => onOpenChange(false)}
              isLoading={isLoadingSubmit}
            />
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
