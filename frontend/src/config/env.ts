const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:3000/api";

export const env = {
  apiBaseUrl,
  isDevelopment: import.meta.env.DEV,
  enableMocks: import.meta.env.VITE_ENABLE_MOCKS === "true",
} as const;

