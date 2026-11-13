const BASE_URL = "/api/credit-card-expenses";

async function parse(res, fallback) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.error) throw new Error(json.error || fallback);
  return json;
}

export const fetchCreditCardExpenses = async ({ month, year, search } = {}) => {
  const params = new URLSearchParams();
  if (month) params.set("month", month);
  if (year) params.set("year", year);
  if (search) params.set("search", search);
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  return parse(res, "Error en la petición");
};

export const createCreditCardExpense = async (body) => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse(res, "Error al guardar");
};

export const updateCreditCardExpense = async ({ id, ...body }) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return parse(res, "Error al actualizar");
};

export const setCreditCardExpenseImage = async ({ id, image_key }) => {
  const res = await fetch(`${BASE_URL}/${id}/image`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_key }),
  });
  return parse(res, "Error al adjuntar el comprobante");
};

export const deleteCreditCardExpense = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  return parse(res, "Error al eliminar");
};
