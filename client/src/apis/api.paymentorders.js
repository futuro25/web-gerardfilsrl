const BASE_URL = "/api/payment-orders";

export const fetchPaymentOrdersByMovement = async (movementId) => {
  const params = new URLSearchParams({
    account_movement_id: String(movementId),
  });
  const res = await fetch(`${BASE_URL}?${params}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchPaymentOrdersByInvoice = async (supplierInvoiceId) => {
  const params = new URLSearchParams({
    supplier_invoice_id: String(supplierInvoiceId),
  });
  const res = await fetch(`${BASE_URL}?${params}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchPendingPaymentItems = async () => {
  const res = await fetch(`${BASE_URL}/pending`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchNextOrderNumber = async () => {
  const res = await fetch(`${BASE_URL}/next-number`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const createPaymentOrder = async (body) => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const cancelPaymentOrder = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const updatePaymentOrderDate = async (id, paymentDate) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payment_date: paymentDate }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.error) {
    throw new Error(data.error || "Error al actualizar la fecha de pago");
  }
  return data;
};
