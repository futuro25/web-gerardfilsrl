const BASE_URL = "/api/retention-certificates";

export const useRetentionPaymentsQuery = async () => {
  const res = await fetch(`${BASE_URL}/payments`, {
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

export const useRetentionPaymentByIdQuery = async (paymentId) => {
  const res = await fetch(`${BASE_URL}/payments/${paymentId}`, {
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

export const useCreateRetentionPaymentMutation = async (body) => {
  const res = await fetch(`${BASE_URL}/payments`, {
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

export const useUpdateRetentionPaymentMutation = async (body) => {
  const res = await fetch(`${BASE_URL}/payments/${body.id}`, {
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

export const useDeleteRetentionPaymentMutation = async (id) => {
  const res = await fetch(`${BASE_URL}/payments/${id}`, {
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

export const useRetentionCertificateQuery = async (paymentId) => {
  const res = await fetch(`${BASE_URL}/${paymentId}`, {
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

export const useRetentionCertificateByNumberQuery = async (certificateNumber) => {
  const res = await fetch(`${BASE_URL}/certificate/${certificateNumber}`, {
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

