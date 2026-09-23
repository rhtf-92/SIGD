import { describe, it, expect, beforeEach, afterEach } from "vitest";
import axios, { type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { apiClient } from "../api/client";
import { ApiHttpError } from "../types/api";

describe("Suite de Pruebas de Cliente API con Interceptores RFC 7807 y Correlación (BR-14)", () => {
  const originalAdapter = apiClient.defaults.adapter;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    apiClient.defaults.adapter = originalAdapter;
  });

  it("inyecta la cabecera X-Correlation-ID en cada petición saliente", async () => {
    let capturedConfig: InternalAxiosRequestConfig | undefined;

    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    };

    await apiClient.get("/test-endpoint");

    expect(capturedConfig).toBeDefined();
    const correlationId = capturedConfig?.headers?.["X-Correlation-ID"] as string;
    expect(correlationId).toBeDefined();
    expect(typeof correlationId).toBe("string");
    expect(correlationId.length).toBeGreaterThan(10);
  });

  it("inyecta la cabecera Authorization: Bearer cuando existe token en almacenamiento", async () => {
    localStorage.setItem("sigd_token", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test");

    let capturedConfig: InternalAxiosRequestConfig | undefined;
    apiClient.defaults.adapter = async (config) => {
      capturedConfig = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: "OK",
        headers: {},
        config,
      } as AxiosResponse;
    };

    await apiClient.get("/test-protected");

    expect(capturedConfig?.headers?.["Authorization"]).toBe(
      "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test",
    );
  });

  it("captura errores HTTP y los normaliza tipadamente a ApiHttpError bajo RFC 7807", async () => {
    apiClient.defaults.adapter = async (config) => {
      const err = new axios.AxiosError(
        "Request failed with status code 400",
        "ERR_BAD_REQUEST",
        config,
        {},
        {
          status: 400,
          statusText: "Bad Request",
          headers: { "x-correlation-id": "test-corr-400" },
          config,
          data: {
            type: "https://sigd.iestpsuiza.edu.pe/errors/validation",
            title: "Parámetros de validación incorrectos",
            status: 400,
            detail: "El DNI ingresado no cumple con el algoritmo Módulo 11.",
            code: "ERR_DNI_MOD11_INVALID",
            category: "Validation",
            correlationId: "test-corr-400",
            invalidParams: [{ name: "numeroDocumento", reason: "Dígito verificador inválido" }],
            retryable: false,
          },
        },
      );
      throw err;
    };

    try {
      await apiClient.post("/api/v1/auth/validar-dni", { dni: "12345678" });
      expect.fail("Debe lanzar ApiHttpError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiHttpError);
      const apiErr = err as ApiHttpError;
      expect(apiErr.status).toBe(400);
      expect(apiErr.correlationId).toBe("test-corr-400");
      expect(apiErr.problemDetails.category).toBe("Validation");
      expect(apiErr.problemDetails.code).toBe("ERR_DNI_MOD11_INVALID");
      expect(apiErr.problemDetails.invalidParams).toHaveLength(1);
      expect(apiErr.problemDetails.invalidParams?.[0].name).toBe("numeroDocumento");
      expect(apiErr.problemDetails.retryable).toBe(false);
    }
  });

  it("normaliza errores 500 no estructurados asignándoles categoría System y retryable: true", async () => {
    apiClient.defaults.adapter = async (config) => {
      const err = new axios.AxiosError(
        "Request failed with status code 500",
        "ERR_BAD_RESPONSE",
        config,
        {},
        {
          status: 500,
          statusText: "Internal Server Error",
          headers: {},
          config,
          data: "Error no tipado del gateway",
        },
      );
      throw err;
    };

    try {
      await apiClient.get("/api/v1/expedientes/crash");
      expect.fail("Debe lanzar ApiHttpError");
    } catch (err: unknown) {
      expect(err).toBeInstanceOf(ApiHttpError);
      const apiErr = err as ApiHttpError;
      expect(apiErr.status).toBe(500);
      expect(apiErr.problemDetails.category).toBe("System");
      expect(apiErr.problemDetails.retryable).toBe(true);
      expect(apiErr.problemDetails.correlationId).toBeDefined();
    }
  });
});
