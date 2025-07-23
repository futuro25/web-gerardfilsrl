const BASE_URL = "/api/books";

export const useBooksIVAComprasComprobantesQuery = async (from, to) => {
  const res = await fetch(
    `${BASE_URL}/compras/comprobantes?from=${from}&to=${to}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};

export const useBooksIVAVentasComprobantesQuery = async (from, to) => {
  const res = await fetch(
    `${BASE_URL}/ventas/comprobantes?from=${from}&to=${to}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  );
  if (!res.ok) {
    throw new Error("Error en la petición");
  }
  return res.json();
};
