const BASE_URL = "/api/cashflow";

export const useCashflowsQuery = async () => {
  try {
    const res = await fetch(`${BASE_URL}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error("Error en la petición");

    const result = await res.json();

    // Si Supabase devuelve { error: ... }, devolvemos []
    if (result?.error) return [];

    return Array.isArray(result) ? result : [];
  } catch (error) {
    console.error("Error al obtener cashflows:", error.message);
    return [];
  }
};

export const useCashflowByIdQuery = async (cashflowId) => {
  try {
    const res = await fetch(`${BASE_URL}/${cashflowId}`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) throw new Error("Error en la petición");

    const result = await res.json();
    return result?.error ? null : result;
  } catch (error) {
    console.error("Error al obtener cashflow por ID:", error.message);
    return null;
  }
};

export const useCreateCashflowMutation = async (body) => {
  const res = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useUpdateCashflowMutation = async (body) => {
  const res = await fetch(`${BASE_URL}/${body.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useDeleteCashflowMutation = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};
