import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { PropsWithChildren } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "@/api/client";
import { useDashboardMetrics } from "@/hooks/useDashboardMetrics";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn() } }));

const counters = {
  nRadicados: 5,
  nAtendidos: 3,
  nArchivados: 1,
  nResueltos: 3,
  nEnTramite: 1,
  nObservados: 0,
  nResueltosDentroPlazo: 3,
  horasHabilesSuma: 12,
};

function createWrapper() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return function Wrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

afterEach(() => vi.clearAllMocks());

describe("useDashboardMetrics", () => {
  it("reports a malformed MGD summary instead of silently replacing it with unrelated KPIs", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).endsWith("/tendencias")) return { data: [] } as never;
      if (String(url).endsWith("/cuellos-botella")) return { data: [] } as never;
      return { data: { mensaje: "respuesta incompleta" } } as never;
    });

    const { result } = renderHook(
      () => useDashboardMetrics({ fechaInicio: "2026-01-01", fechaFin: "2026-12-31", periodo: "anual", anio: 2026 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(apiClient.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.summary.metrics).toEqual([]);
  });

  it("normalizes an empty but complete MGD period into finite zero metrics", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).endsWith("/tendencias")) return { data: [] } as never;
      if (String(url).endsWith("/cuellos-botella")) return { data: [] } as never;
      return {
        data: {
          contadores: { ...counters, nRadicados: 0, nAtendidos: 0, nArchivados: 0, nResueltos: 0, nEnTramite: 0, horasHabilesSuma: 0 },
          vtep: { valor: 0 },
          tprHorasHabiles: { valor: 0 },
          tro: { valor: 0 },
          teo: { valor: 0 },
        },
      } as never;
    });

    const { result } = renderHook(
      () => useDashboardMetrics({ fechaInicio: "2026-01-01", fechaFin: "2026-12-31", periodo: "anual", anio: 2026 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.summary.metrics.every((metric) => Number.isFinite(metric.value))).toBe(true);
    expect(result.current.summary.metrics.find((metric) => metric.id === "vtep")?.value).toBe(0);
    expect(result.current.summary.metrics.find((metric) => metric.id === "tro")?.value).toBe(100);
  });

  it("calculates TEO over all radicados in the period, not only items in progress", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      if (String(url).endsWith("/tendencias")) return { data: [] } as never;
      if (String(url).endsWith("/cuellos-botella")) return { data: [] } as never;
      return {
        data: {
          contadores: { ...counters, nRadicados: 50, nObservados: 2, nEnTramite: 100 },
          vtep: { valor: 0 },
          tprHorasHabiles: { valor: 0 },
          tro: { valor: 0 },
          teo: { valor: 0 },
        },
      } as never;
    });

    const { result } = renderHook(
      () => useDashboardMetrics({ fechaInicio: "2026-01-01", fechaFin: "2026-12-31", periodo: "anual", anio: 2026 }),
      { wrapper: createWrapper() },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false), { timeout: 5000 });
    expect(result.current.summary.metrics.find((metric) => metric.id === "teo")?.value).toBe(4);
  });
});
