import { useEffect, useRef } from "react";

const ACTIVITY_EVENTS = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

/**
 * Marca cuando fue la ultima interaccion real del usuario. Lo usan el modulo
 * de presencia (activo vs inactivo) y el aviso de nueva version.
 */
export default function useLastActivity() {
  const lastActivityRef = useRef(Date.now());

  useEffect(() => {
    const markActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") markActivity();
    };

    ACTIVITY_EVENTS.forEach((event) =>
      window.addEventListener(event, markActivity, { passive: true })
    );
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      ACTIVITY_EVENTS.forEach((event) =>
        window.removeEventListener(event, markActivity)
      );
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return lastActivityRef;
}
