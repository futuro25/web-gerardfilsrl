export const fetchAppVersion = async () => {
  const res = await fetch("/api/version", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};
