const BASE_URL = "/api/deliveries";

export const useDeliveriesQuery = async () => {
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

export const useDeliveryByIdQuery = async (inviteId) => {
  const res = await fetch(`${BASE_URL}/${inviteId}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    console.log("VER", res);
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useCreateDeliveryMutation = async (body) => {
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

export const useUpdateDeliveryMutation = async (body) => {
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

export const useDeleteDeliveryMutation = async (id) => {
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

export const useDeliveriesByNameQuery = async (search) => {
  const res = await fetch(`${BASE_URL}/name/${encodeURIComponent(search)}`, {
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

export const useDeliveriesByEmailQuery = async (search) => {
  const res = await fetch(`${BASE_URL}/email/${encodeURIComponent(search)}`, {
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
