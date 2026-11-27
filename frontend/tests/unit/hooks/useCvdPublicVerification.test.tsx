import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

vi.mock("../../../src/config/env", () => ({
  env: { enableMocks: false },
}));

import { apiClient } from "../../../src/api/client";
import {
  CVD_VALIDO,
  useCvdPublicVerification,
} from "../../../src/hooks/useCvdPublicVerification";
import { ApiHttpError } from "../../../src/types/api";

const get = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { mutations: { retry: false } },
  });
  return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>;
}

describe("useCvdPublicVerification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("conserva el estado HTTP del Problem Details en lugar de transformarlo en 500", async () => {
    get.mockRejectedValue(
      new ApiHttpError({
        type: "https://sigd.iestpsuiza.edu.pe/errors/business",
        title: "Not Found",
        status: 404,
        detail: "No existe un documento para el CVD indicado.",
        instance: "/api/v1/validador/cvd/CVD-2026-RD-000412-892F",
        code: "NOT_FOUND",
        category: "Business",
        correlationId: "corr-1",
        retryable: false,
      }),
    );

    const { result } = renderHook(() => useCvdPublicVerification(), { wrapper });
    result.current.verificar(CVD_VALIDO);

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.error).toMatchObject({
      titulo: "Not Found",
      detalle: "No existe un documento para el CVD indicado.",
      codigoEstado: 404,
    });
  });
});
