export const queryPaymentsKey = () => ["payments"];
export const queryUsersKey = () => ["users"];
export const queryInvoicesKey = () => ["invoices"];
export const queryDeliveryKey = () => ["deliveries"];
export const queryCashflowKey = () => ["cashflow"];
export const querySuppliersKey = () => ["suppliers"];
export const queryClientsKey = () => ["clients"];
export const queryUserKey = (user_id) => ["users", user_id];
export const queryUsersUsernameValidationKey = (param) => [
  "usersUsernameValidation",
  param,
];
export const queryUsersEmailValidationKey = (param) => [
  "usersEmailValidation",
  param,
];
