import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";

import { env } from "../config/env";
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
apiClient.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 500;
      const responseData = error.response?.data as Record<string, unknown> | undefined;

      const correlationId =
        (typeof responseData?.correlationId === "string" && responseData.correlationId) ||
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
        error.message ||
        "Ha ocurrido una incidencia al procesar la solicitud.";

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
          : undefined,
        retryable,
      };

      return Promise.reject(new ApiHttpError(problemDetails));
    }

    return Promise.reject(error);
  },
);
