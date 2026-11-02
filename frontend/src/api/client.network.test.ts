import { AxiosError } from "axios";
import { afterEach, describe, expect, it } from "vitest";

import { apiClient } from "./client";

const originalAdapter = apiClient.defaults.adapter;

afterEach(() => {
  apiClient.defaults.adapter = originalAdapter;
});

describe("apiClient connection errors", () => {
  it("reports a missing backend as a retryable network error, not an HTTP 500", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Network Error", AxiosError.ERR_NETWORK, config);
    };

    await expect(apiClient.post("/api/v1/auth/registro-ciudadano", {})).rejects.toMatchObject({
      name: "ApiHttpError",
      problemDetails: {
        status: 0,
        code: "ERR_NETWORK",
        retryable: true,
        detail: expect.stringMatching(/backend esté iniciado/i),
      },
    });
  });

  it("explains when a backend request times out", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("timeout", AxiosError.ECONNABORTED, config);
    };

    await expect(apiClient.post("/api/v1/auth/registro-ciudadano", {})).rejects.toMatchObject({
      name: "ApiHttpError",
      problemDetails: {
        status: 0,
        code: "ERR_TIMEOUT",
        retryable: true,
        detail: expect.stringMatching(/demasiado en responder/i),
      },
    });
  });
});
