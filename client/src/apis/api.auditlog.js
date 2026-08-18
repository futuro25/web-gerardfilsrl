const BASE_URL = "/api/audit-log";

export const fetchAuditLog = async (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  });

  const res = await fetch(`${BASE_URL}?${search}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const fetchAuditLogFilters = async () => {
  const res = await fetch(`${BASE_URL}/filters`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};
