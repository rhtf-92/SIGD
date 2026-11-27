import { AxiosError } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { apiClient } from "./client";
import { ApiHttpError } from "@/types/api";

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("apiClient connection errors", () => {
  it("reports a missing backend as a retryable network error, not an HTTP 500", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
    };

    const error = await apiClient.post("/api/v1/auth/registro-ciudadano", {}).catch((fallo: unknown) => fallo);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({
      name: "ApiHttpError",
      problemDetails: {
        status: 0,
        code: "ERR_NETWORK",
        retryable: true,
        detail: expect.stringMatching(/No se pudo establecer conexión/i),
      },
    });
    expect((error as ApiHttpError).problemDetails.detail).not.toMatch(/localhost|https?:\/\//i);
  });

  it("muestra un mensaje profesional ante un 500 sin problem details", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError(
        "Request failed with status code 500",
        AxiosError.ERR_BAD_RESPONSE,
        config,
        undefined,
        { status: 500, statusText: "Internal Server Error", data: {}, headers: {}, config },
      );
    };

    const error = await apiClient.post("/api/v1/auth/registro-ciudadano", {}).catch((fallo: unknown) => fallo);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect((error as ApiHttpError).problemDetails.detail).toMatch(/no pudo procesar la solicitud/i);
    expect((error as ApiHttpError).problemDetails.detail).not.toMatch(/status code/i);
  });

  it("explains when a backend request times out", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("timeout", AxiosError.ECONNABORTED, config);
    };

    const error = await apiClient.post("/api/v1/auth/registro-ciudadano", {}).catch((fallo: unknown) => fallo);

    expect(error).toBeInstanceOf(ApiHttpError);
    expect(error).toMatchObject({
      name: "ApiHttpError",
      problemDetails: {
        status: 0,
        code: "ERR_TIMEOUT",
        retryable: true,
        detail: expect.stringMatching(/tiempo esperado/i),
      },
    });
  });
});
