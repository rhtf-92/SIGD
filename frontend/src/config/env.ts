/**
 * La API se consume, por defecto, en el MISMO ORIGEN de la aplicación: en
 * desarrollo Vite redirige `/api` al backend (`vite.config.ts`) y en producción
 * lo hace el reverse proxy. Así se evita depender de `localhost:3000` y de CORS.
 * `VITE_API_BASE_URL` sigue admitiendo un origen explícito para despliegues
 * donde el frontend y el backend viven en dominios distintos.
 */
const apiBaseUrlCrudo = import.meta.env.VITE_API_BASE_URL || "/api";

/**
 * Prefijo canónico de la API (contrato REST v1 del backend).
 * Todos los call sites usan rutas absolutas con este prefijo:
 *   apiClient.get("/api/v1/expedientes")
 */
export const API_PREFIX = "/api/v1";

/**
 * Se normaliza VITE_API_BASE_URL a un origen puro porque las rutas ya incluyen
 * el prefijo canónico. Un valor relativo (`/api`, `/api/v1`) se resuelve a ""
 * y axios usa el origen de la página, donde está el proxy.
 */
const apiBaseUrl = apiBaseUrlCrudo
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/api(\/v\d+)?$/i, "");

export const env = {
  apiBaseUrl,
  apiPrefix: API_PREFIX,
  isDevelopment: import.meta.env.DEV,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
} as const;

/** Destino legible para mensajes de diagnóstico (nunca se muestra tal cual al usuario). */
export const apiDestination =
  apiBaseUrl ||
  (typeof window !== "undefined" ? window.location.origin : "el servidor de la aplicación");
