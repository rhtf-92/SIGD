const apiBaseUrlCrudo =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

/**
 * Prefijo canónico de la API (contrato REST v1 del backend).
 * Todos los call sites usan rutas absolutas con este prefijo:
 *   apiClient.get("/api/v1/expedientes")
 */
export const API_PREFIX = "/api/v1";

/**
 * Se normaliza VITE_API_BASE_URL a un origen puro porque las rutas ya incluyen
 * el prefijo canónico. Así se toleran las tres convenciones que conviven en el
 * repositorio (`http://host`, `http://host/api`, `http://host/api/v1`) sin
 * producir `/api/v1/v1` ni `/api/v1/api/v1`.
 */
const apiBaseUrl = apiBaseUrlCrudo
  .replace(/\/api(\/v\d+)?\/?$/i, "")
  .replace(/\/+$/, "");

export const env = {
  apiBaseUrl,
  apiPrefix: API_PREFIX,
  isDevelopment: import.meta.env.DEV,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
} as const;

