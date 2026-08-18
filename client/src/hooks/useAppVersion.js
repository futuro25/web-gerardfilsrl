import { useCallback, useEffect, useRef, useState } from "react";
import { fetchAppVersion } from "../apis/api.version";
import useLastActivity from "./useLastActivity";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
const AUTO_RELOAD_TICK_MS = 60 * 1000;
// Recargamos solos recien despues de este tiempo sin que el usuario toque nada.
const IDLE_BEFORE_AUTO_RELOAD_MS = 5 * 60 * 1000;
const AUTO_RELOAD_FLAG = "app_version_auto_reloaded";

/**
 * Version del bundle que este navegador tiene efectivamente cargado: sale del
 * hash que CRA le puso al script principal en index.html.
 */
function getRunningVersion() {
  const script = document.querySelector('script[src*="static/js/main."]');
  if (!script) return null;
  const match = script.src.match(/main\.([^.]+)\.js/);
  return match ? match[1] : null;
}

/**
 * Si hay algo tipeado sin guardar, no recargamos por las nuestras: preferimos
 * dejar el cartel y que el usuario decida cuando actualizar.
 */
function hasUnsavedWork() {
  const fields = document.querySelectorAll(
    'input:not([type="search"]):not([type="checkbox"]):not([type="radio"]):not([id="search"]), textarea'
  );
  return Array.from(fields).some(
    (field) => field.value && String(field.value).trim() !== ""
  );
}

/**
 * Detecta que se publico una version nueva comparando el bundle cargado contra
 * el que sirve el servidor. Resuelve el caso del usuario que deja la pestaña
 * abierta y nunca recarga.
 *
 * El chequeo corre tambien con la pestaña en segundo plano, justamente porque
 * esa es la situacion a resolver: asi la pestaña olvidada se actualiza sola y
 * el usuario la encuentra al dia cuando vuelve.
 */
export default function useAppVersion() {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const lastActivityRef = useLastActivity();
  const runningVersionRef = useRef(getRunningVersion());

  const reload = useCallback(() => {
    window.location.reload();
  }, []);

  useEffect(() => {
    const runningVersion = runningVersionRef.current;
    // En el server de desarrollo el bundle no tiene hash: no hay nada que comparar.
    if (!runningVersion) return undefined;

    let cancelled = false;

    const check = async () => {
      if (cancelled) return;
      try {
        const { version } = await fetchAppVersion();
        if (!cancelled && version && version !== runningVersion) {
          setUpdateAvailable(true);
        }
      } catch (e) {
        // Un deploy en curso puede cortar la conexion: reintentamos despues.
      }
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") check();
    };

    check();
    const checkInterval = setInterval(check, CHECK_INTERVAL_MS);
    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(checkInterval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  useEffect(() => {
    if (!updateAvailable) return undefined;

    const interval = setInterval(() => {
      const idleFor = Date.now() - lastActivityRef.current;
      if (idleFor < IDLE_BEFORE_AUTO_RELOAD_MS || hasUnsavedWork()) return;

      // Seguro contra el loop: si ya recargamos solos estando en esta misma
      // version y el desfase sigue, no insistimos. Queda el cartel para que el
      // usuario decida, en vez de una app recargandose cada cinco minutos.
      const runningVersion = runningVersionRef.current;
      if (sessionStorage.getItem(AUTO_RELOAD_FLAG) === runningVersion) return;

      sessionStorage.setItem(AUTO_RELOAD_FLAG, runningVersion);
      reload();
    }, AUTO_RELOAD_TICK_MS);

    return () => clearInterval(interval);
  }, [updateAvailable, lastActivityRef, reload]);

  return { updateAvailable, reload };
}
