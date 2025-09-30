const BASE_URL = "/api/orders";

export const useOrdersQuery = async () => {
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

export const useActiveOrdersQuery = async () => {
  const res = await fetch(`${BASE_URL}/active`, {
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

export const useOrderByIdQuery = async (orderId) => {
  const res = await fetch(`${BASE_URL}/${orderId}`, {
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

export const useCreateOrderMutation = async (body) => {
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

export const useUpdateOrderMutation = async (body) => {
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

export const useDeleteOrderMutation = async (id) => {
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
