export const queryPaymentsKey = () => ["payments"];
export const queryUsersKey = () => ["users"];
export const queryInvoicesKey = () => ["invoices"];
export const querySuppliersKey = () => ["suppliers"];
export const queryUserKey = (user_id) => ["users", user_id];
export const queryUsersUsernameValidationKey = (param) => [
  "usersUsernameValidation",
  param,
];
export const queryUsersEmailValidationKey = (param) => [
  "usersEmailValidation",
  param,
];
