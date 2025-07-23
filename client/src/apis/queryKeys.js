export const queryPaymentsKey = () => ["payments"];
export const queryUsersKey = () => ["users"];
export const queryInvoicesKey = () => ["invoices"];
export const queryDeliveryKey = () => ["deliveries"];
export const queryCashflowKey = () => ["cashflow"];
export const querySuppliersKey = () => ["suppliers"];
export const queryProductsKey = () => ["products"];
export const queryDeliveryNotesKey = () => ["deliverynotes"];
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
