export const queryPaymentsKey = () => ["payments"];
export const queryUsersKey = () => ["users"];
export const queryInvoicesKey = () => ["invoices"];
export const queryDeliveryKey = () => ["deliveries"];
export const queryCashflowKey = () => ["cashflow"];
export const querySuppliersKey = () => ["suppliers"];
export const queryProductsKey = () => ["products"];
export const queryDeliveryNotesKey = () => ["deliverynotes"];
export const queryDeliveryNotesByIdKey = (id) => ["deliverynote", id];
export const queryClientsKey = () => ["clients"];
export const queryPaychecksKey = () => ["paychecks"];
export const queryBooksVentasCbteKey = () => ["BooksVentasCbte"];
export const queryBooksComprasCbteKey = () => ["BooksComprasCbte"];
export const queryBooksVentasAlicuotaKey = () => ["BooksVentasAlicuota"];
export const queryBooksComprasAlicuotaKey = () => ["BooksComprasAlicuota"];
export const queryUserKey = (user_id) => ["users", user_id];
export const queryUsersUsernameValidationKey = (param) => [
  "usersUsernameValidation",
  param,
];
export const queryUsersEmailValidationKey = (param) => [
  "usersEmailValidation",
  param,
];
export const queryOrdersKey = () => ["orders"];
export const queryStockEntriesKey = () => ["stock-entries"];
export const queryRetentionPaymentsKey = () => ["retention-payments"];
export const queryRetentionPaymentByIdKey = (id) => ["retention-payment", id];
export const queryRetentionCertificateKey = (paymentId) => ["retention-certificate", paymentId];
export const queryRetentionByInvoiceKey = ({
  supplierInvoiceId,
  accountMovementId,
  invoiceNumber,
  supplierId,
} = {}) => [
  "retention-by-invoice",
  supplierInvoiceId ?? null,
  accountMovementId ?? null,
  invoiceNumber ?? null,
  supplierId ?? null,
];
export const queryAccountMovementsKey = (params) => ["account-movements", params];
export const queryAccountMovementsSummaryKey = (params) => ["account-movements-summary", params];
export const queryUpcomingChequesKey = () => ["upcoming-cheques"];
export const queryAccountFutureBalancesKey = () => ["account-movements-future-balances"];
export const queryAportesKey = () => ["aportes"];
export const queryVepsKey = () => ["veps"];
export const queryUpcomingVepsKey = (days = 15) => ["upcoming-veps", days];
export const querySupplierAccountsListKey = () => ["supplier-accounts-list"];
export const querySupplierAccountKey = (supplierId) => ["supplier-account", supplierId];
export const querySupplierInvoiceByMovementKey = (movementId) => [
  "supplier-invoice-by-movement",
  movementId,
];
export const querySupplierInvoicesListKey = () => ["supplier-invoices-list"];
export const queryPurchaseInvoicesKey = (params) => [
  "supplier-invoices-list",
  params,
];
export const queryPaymentOrdersByMovementKey = (sourceMovementId) => [
  "payment-orders-by-movement",
  sourceMovementId,
];
export const queryPaymentOrdersNextNumberKey = () => ["payment-orders-next-number"];
export const queryPendingPaymentItemsKey = () => ["pending-payment-items"];
export const queryInvoiceImageUrlKey = (key) => ["invoice-image-url", key];
export const queryPaymentOrdersByInvoiceKey = (supplierInvoiceId) => [
  "payment-orders-by-invoice",
  supplierInvoiceId,
];
