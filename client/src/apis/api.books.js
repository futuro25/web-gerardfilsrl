const BASE_URL = "/api/books";

export const useBooksIVAComprasComprobantesQuery = async () => {
  const res = await fetch(`${BASE_URL}/compras/comprobantes`, {
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

export const useBooksIVAVentasComprobantesQuery = async () => {
  const res = await fetch(`${BASE_URL}/ventas/comprobantes`, {
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

export const useBooksIVAComprasAlicuotasQuery = async () => {
  const res = await fetch(`${BASE_URL}/compras/alicuotas`, {
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

export const useBooksIVAVentasAlicuotasQuery = async () => {
  const res = await fetch(`${BASE_URL}/ventas/alicuotas`, {
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
