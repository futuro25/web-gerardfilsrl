const BASE_URL = "/api/stock-entries";

export const useStockEntriesQuery = async () => {
  const res = await fetch(`${BASE_URL}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useStockEntryByIdQuery = async (stockEntryId) => {
  const res = await fetch(`${BASE_URL}/${stockEntryId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useCreateStockEntryMutation = async (body) => {
  const res = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errorData = await res.json();
    throw new Error(errorData.error || "Error en la petición");
  }
  return res.json();
};

export const useUpdateStockEntryMutation = async (body) => {
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

export const useDeleteStockEntryMutation = async (id) => {
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

