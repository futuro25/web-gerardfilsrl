const BASE_URL = "/api/presence";

export const fetchPresence = async () => {
  const res = await fetch(BASE_URL, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const startPresenceSession = async (body) => {
  const res = await fetch(`${BASE_URL}/session`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

export const sendPresenceHeartbeat = async (body) => {
  const res = await fetch(`${BASE_URL}/heartbeat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 404) return { missing: true };
  if (!res.ok) throw new Error("Error en la petición");
  return res.json();
};

// Se usa tambien al cerrar la pestaña, donde solo sendBeacon llega a tiempo.
export const endPresenceSession = (session_token) => {
  if (!session_token) return;
  const url = `${BASE_URL}/session/end`;
  const payload = JSON.stringify({ session_token });

  if (navigator.sendBeacon) {
    const blob = new Blob([payload], { type: "application/json" });
    if (navigator.sendBeacon(url, blob)) return;
  }

  fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {});
};
