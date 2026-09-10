const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error(
    "La variable de entorno VITE_API_BASE_URL debe estar definida en el archivo .env.",
  );
}

export const env = {
  apiBaseUrl,
  isDevelopment: import.meta.env.DEV,
} as const;
