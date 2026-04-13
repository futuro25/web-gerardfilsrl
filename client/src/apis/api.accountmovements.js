const BASE_URL = "/api/account-movements";

export const fetchAccountMovements = async ({ month, year, page = 1, limit = 50 }) => {
  const params = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (month && year) {
    params.set("month", String(month));
    params.set("year", String(year));
  }
  const res = await fetch(`${BASE_URL}?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchAccountMovementsSummary = async ({ month, year }) => {
  const params = new URLSearchParams();
  if (month && year) {
    params.set("month", String(month));
    params.set("year", String(year));
  }
  const res = await fetch(`${BASE_URL}/summary?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchUpcomingCheques = async () => {
  const res = await fetch(`${BASE_URL}/upcoming-cheques`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const createAccountMovement = async (body) => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const updateAccountMovement = async (body) => {
  const res = await fetch(`${BASE_URL}/${body.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const deleteAccountMovement = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};
