const BASE_URL = "/api/suppliers";

export const useSuppliersQuery = async () => {
  const res = await fetch(`${BASE_URL}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
    },
  });
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  const data = await res.json();
  if (data?.error) {
    throw new Error(data.error);
  }
  return Array.isArray(data) ? data : [];
};

export const useSupplierByIdQuery = async (inviteId) => {
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

/** Devuelve el mensaje que manda el backend en vez de uno genérico. */
async function throwServerError(res) {
  let message = "Error en la petición";
  try {
    const body = await res.json();
    if (body?.error) message = body.error;
  } catch (e) {
    // respuesta sin cuerpo JSON: se usa el mensaje genérico
  }
  throw new Error(message);
}

export const useCreateSupplierMutation = async (body) => {
  const res = await fetch(`${BASE_URL}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await throwServerError(res);
  }
  return res.json();
};

export const useUpdateSupplierMutation = async (body) => {
  const res = await fetch(`${BASE_URL}/${body.id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    await throwServerError(res);
  }
  return res.json();
};

export const useDeleteSupplierMutation = async (id) => {
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

export const useSuppliersByNameQuery = async (search) => {
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

export const useSuppliersByEmailQuery = async (search) => {
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
