import { forwardRef } from "react";
import SupplierInvoiceForm, {
  getInvoiceTotalAmount,
  splitInvoiceNumber,
} from "./SupplierInvoiceForm";

export { getInvoiceTotalAmount, splitInvoiceNumber };

const InvoiceDataFields = forwardRef(function InvoiceDataFields(props, ref) {
  return (
    <div className="border-t border-slate-200 pt-4 mt-2">
      <h3 className="text-sm font-semibold text-slate-800 mb-3">
        Datos de factura
      </h3>
      <SupplierInvoiceForm
        ref={ref}
        embedded
        showImageUpload
        {...props}
      />
    </div>
  );
});

export default InvoiceDataFields;
