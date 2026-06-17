const BASE_URL = "/api/veps";

export const fetchVeps = async () => {
  const res = await fetch(BASE_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchUpcomingVeps = async (days = 15) => {
  const params = new URLSearchParams({ days: String(days) });
  const res = await fetch(`${BASE_URL}/upcoming?${params}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const createVep = async (body) => {
  const res = await fetch(BASE_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Error al guardar");
  return json;
};

export const updateVep = async (body) => {
  const res = await fetch(`${BASE_URL}/${body.id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Error al actualizar");
  return json;
};

export const deleteVep = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok || json.error) throw new Error(json.error || "Error al eliminar");
  return json;
};

export const markVepAsPaid = async (id) => {
  const res = await fetch(`${BASE_URL}/${id}/mark-paid`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
  });
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error || "Error al marcar como pagado");
  }
  return json;
};
