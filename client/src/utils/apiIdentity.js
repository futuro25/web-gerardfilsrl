/**
 * Adjunta la identidad del usuario logueado a cada request hacia /api.
 *
 * La API no tiene autenticacion y los 22 archivos api.*.js usan fetch directo,
 * asi que parchamos fetch una sola vez al arrancar la app: de esa forma el
 * backend puede auditar quien carga, edita o elimina sin tocar cada llamada.
 */
export default function installApiIdentity() {
  if (typeof window === "undefined" || window.__apiIdentityInstalled) return;
  window.__apiIdentityInstalled = true;

  const originalFetch = window.fetch.bind(window);

  const isApiRequest = (url) => {
    if (typeof url !== "string") return false;
    return url.startsWith("/api/") || url.includes(`${window.location.origin}/api/`);
  };

  window.fetch = (input, init = {}) => {
    const url = typeof input === "string" ? input : input && input.url;

    if (!isApiRequest(url) || !sessionStorage.user_id) {
      return originalFetch(input, init);
    }

    const headers = new Headers(
      init.headers || (typeof input === "object" && input.headers) || {}
    );
    headers.set("x-user-id", sessionStorage.user_id);
    if (sessionStorage.username) {
      headers.set("x-username", sessionStorage.username);
    }

    return originalFetch(input, { ...init, headers });
  };
}
