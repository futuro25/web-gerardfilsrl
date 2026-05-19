const BASE_URL = "/api/supplier-accounts";

export const fetchSupplierAccount = async (supplierId) => {
  const res = await fetch(`${BASE_URL}/${supplierId}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || "Error al cargar la cuenta corriente");
  }
  return res.json();
};
