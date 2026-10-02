// Origen canónico del Backend API, sin el sufijo /api: los servicios invocan
// rutas con el prefijo /api/v1/... y la concatenación evita el doble prefijo
// http://localhost:3000/api/api/v1/... (plan maestro §2.3).
const apiBaseUrl = (
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000"
).replace(/\/+$/, "");

export const env = {
  apiBaseUrl,
  isDevelopment: import.meta.env.DEV,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
} as const;
