import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import {
  startPresenceSession,
  sendPresenceHeartbeat,
  endPresenceSession,
} from "../apis/api.presence";

const HEARTBEAT_MS = 45000;
// Sin interaccion durante este tiempo el usuario se reporta como inactivo.
const IDLE_AFTER_MS = 5 * 60 * 1000;
const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

function getSessionToken() {
  let token = sessionStorage.presence_token;
  if (!token) {
    token =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    sessionStorage.presence_token = token;
  }
  return token;
}

/**
 * Mantiene viva la sesion del usuario logueado: crea la sesion, manda heartbeat
 * cada 45s indicando si hubo interaccion, y la cierra al salir de la plataforma.
 */
export default function usePresence() {
  const location = useLocation();
  const pathRef = useRef(location.pathname);
  const lastActivityRef = useRef(Date.now());

  pathRef.current = location.pathname;

  useEffect(() => {
    const user_id = sessionStorage.user_id;
    if (!user_id) return undefined;

    const session_token = getSessionToken();
    let cancelled = false;

    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const isIdle = () =>
      document.visibilityState === "hidden" ||
      Date.now() - lastActivityRef.current > IDLE_AFTER_MS;

    const start = async () => {
      try {
        await startPresenceSession({
          user_id,
          session_token,
          path: pathRef.current,
        });
      } catch (e) {
        console.log("presence start", e.message);
      }
    };

    const beat = async () => {
      if (cancelled) return;
      try {
        const result = await sendPresenceHeartbeat({
          session_token,
          path: pathRef.current,
          is_idle: isIdle(),
        });
        // Si el backend perdio la sesion, la volvemos a crear.
        if (result && result.missing) await start();
      } catch (e) {
        console.log("presence heartbeat", e.message);
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markActivity();
      beat();
    };

    const onPageHide = () => {
      endPresenceSession(session_token);
    };

    start();

    const interval = setInterval(beat, HEARTBEAT_MS);
    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      clearInterval(interval);
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity)
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, []);
}
