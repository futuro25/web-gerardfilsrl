const BASE_URL = "/api/supplier-invoices";

export const fetchSupplierInvoiceByAccountMovement = async (
  accountMovementId
) => {
  const res = await fetch(`${BASE_URL}/by-movement/${accountMovementId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const createSupplierInvoice = async (body) => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al crear la factura");
  }
  return res.json();
};

export const updateSupplierInvoice = async (body) => {
  const res = await fetch(`${BASE_URL}/${body.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al actualizar la factura");
  }
  return res.json();
};
