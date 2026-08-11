const BASE_URL = "/api/fixed-expenses";

export const fetchFixedExpenses = async () => {
  const res = await fetch(BASE_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchFixedExpenseNames = async () => {
  const res = await fetch(`${BASE_URL}/names`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const updateFixedExpense = async ({ id, ...body }) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const deleteFixedExpense = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const createFixedExpenseAmount = async ({ id, amount, effective_from }) => {
  const res = await fetch(`${BASE_URL}/${id}/amounts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount, effective_from }),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const deleteFixedExpenseAmount = async ({ id, amountId }) => {
  const res = await fetch(`${BASE_URL}/${id}/amounts/${amountId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};
