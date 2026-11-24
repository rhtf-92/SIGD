import { useAuthStore } from "../stores/authStore";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { apiDestination, env } from "../config/env";
import {
  type ApiProblemDetails,
  ApiHttpError,
  type ProblemCategory,
} from "../types/api";

function generateCorrelationId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function mapStatusToCategory(status: number): ProblemCategory {
  if (status === 401 || status === 403) return "Security";
  if (status === 400 || status === 422) return "Validation";
  if (status === 409) return "Conflict";
  if (status >= 500) return "System";
  return "Business";
}

export const apiClient = axios.create({
  baseURL: env.apiBaseUrl,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

// Interceptor de Petición: Inyección de X-Correlation-ID y Bearer Token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const correlationId = generateCorrelationId();
    if (!config.headers["X-Correlation-ID"]) {
      config.headers["X-Correlation-ID"] = correlationId;
    }

    // Inyección de token JWT si existe en almacenamiento local o de sesión
    const token =
      (typeof localStorage !== "undefined" &&
        (localStorage.getItem("sigd_token") || localStorage.getItem("token"))) ||
      (typeof sessionStorage !== "undefined" &&
        (sessionStorage.getItem("sigd_token") || sessionStorage.getItem("token")));

    if (token && !config.headers["Authorization"]) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }

    return config;
  },
  (error: unknown) => Promise.reject(error),
);

// Interceptor de Respuesta: Tratamiento centralizado y tipado RFC 7807 (Problem Details)
let isRefreshing = false;
let pendingQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

function procesarCola(error: unknown, token: string | null) {
  pendingQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token as string);
  });
  pendingQueue = [];
}

// Interceptor de Respuesta: Tratamiento centralizado y tipado RFC 7807 (Problem Details)
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  async (error: unknown) => {
    if (axios.isAxiosError(error) && !error.response) {
      const timedOut = error.code === "ECONNABORTED" || error.code === "ETIMEDOUT";
      const code = timedOut ? "ERR_TIMEOUT" : "ERR_NETWORK";
      const correlationId =
        (typeof error.config?.headers?.["X-Correlation-ID"] === "string" &&
          error.config.headers["X-Correlation-ID"]) ||
        generateCorrelationId();

      // El detalle técnico se registra en consola; la interfaz muestra un mensaje
      // comprensible y decide qué hacer según `code`, no según texto libre.
      console.error("[API] Fallo de conexión", {
        destino: apiDestination,
        url: error.config?.url,
        code,
        correlationId,
      });

      return Promise.reject(
        new ApiHttpError({
          type: "https://sigd.iestpsuiza.edu.pe/errors/system",
          title: timedOut
            ? "Tiempo de espera agotado"
            : "No se pudo conectar con el servidor",
          status: 0,
          detail: timedOut
            ? "El servicio no respondió dentro del tiempo esperado."
            : "No se pudo establecer conexión con el servicio del SIGD.",
          instance: error.config?.url ?? "",
          code,
          category: "System",
          correlationId,
          retryable: true,
        }),
      );
    }

    if (axios.isAxiosError(error) && error.response?.status === 401) {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
      const url = originalRequest.url ?? "";
      const esEndpointDeAutenticacion =
        url.includes("/auth/login") || url.includes("/auth/refresh") || url.includes("/auth/logout");

      // Un 401 del propio login significa credenciales inválidas: intentar un
      // refresh aquí sólo produce un bucle de redirección a /login.
      if (!esEndpointDeAutenticacion && !originalRequest._retry) {
        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            pendingQueue.push({
              resolve: (token: string) => {
                originalRequest.headers.Authorization = `Bearer ${token}`;
                resolve(apiClient(originalRequest));
              },
              reject,
            });
          });
        }

        originalRequest._retry = true;
        isRefreshing = true;

        try {
          const refreshToken = useAuthStore.getState().refreshToken;
          const { data } = await apiClient.post("/api/v1/auth/refresh", { refreshToken });
          useAuthStore.getState().setToken(data.accessToken, data.refreshToken);
          procesarCola(null, data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
          isRefreshing = false;
          return apiClient(originalRequest);
        } catch (refreshError) {
          procesarCola(refreshError, null);
          useAuthStore.getState().logout();
          isRefreshing = false;
        }
      } else {
        useAuthStore.getState().logout();
      }
    }

    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const responseData = error.response?.data as Record<string, unknown> | undefined;

      const correlationId =
        (typeof responseData?.correlationId === "string" && responseData.correlationId) ||
        (typeof responseData?.correlation_id === "string" && (responseData.correlation_id as string)) ||
        (typeof error.config?.headers?.["X-Correlation-ID"] === "string" &&
          (error.config.headers["X-Correlation-ID"] as string)) ||
        (typeof error.response?.headers?.["x-correlation-id"] === "string" &&
          (error.response.headers["x-correlation-id"] as string)) ||
        generateCorrelationId();

      const category =
        (typeof responseData?.category === "string" &&
          (responseData.category as ProblemCategory)) ||
        mapStatusToCategory(status);

      const title =
        (typeof responseData?.title === "string" && responseData.title) ||
        error.message ||
        "Error en la operación del servidor";

      const detail =
        (typeof responseData?.detail === "string" && responseData.detail) ||
        (typeof responseData?.message === "string" && responseData.message) ||
        (status >= 500
          ? "El servicio del SIGD no pudo procesar la solicitud. Intente nuevamente; si persiste, contacte al administrador."
          : error.message || "Ha ocurrido una incidencia al procesar la solicitud.");

      const instance =
        (typeof responseData?.instance === "string" && responseData.instance) ||
        error.config?.url ||
        "";

      const code =
        (typeof responseData?.code === "string" && responseData.code) ||
        `ERR_HTTP_${status}`;

      const retryable =
        typeof responseData?.retryable === "boolean"
          ? responseData.retryable
          : status >= 500 || status === 429;

      const problemDetails: ApiProblemDetails = {
        type:
          (typeof responseData?.type === "string" && responseData.type) ||
          `https://sigd.iestpsuiza.edu.pe/errors/${category.toLowerCase()}`,
        title,
        status,
        detail,
        instance,
        code,
        category,
        correlationId,
        invalidParams: Array.isArray(responseData?.invalidParams)
          ? (responseData.invalidParams as ApiProblemDetails["invalidParams"])
          : Array.isArray(responseData?.invalid_params)
            ? (responseData.invalid_params as ApiProblemDetails["invalidParams"])
            : undefined,
        retryable,
      };

      return Promise.reject(new ApiHttpError(problemDetails));
    }

    return Promise.reject(error);
  },
);
