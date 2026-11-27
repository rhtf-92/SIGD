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
import { useExpedienteTimeline } from "../../../src/hooks/useExpedienteTimeline";

const get = vi.mocked(apiClient.get);

function wrapper({ children }: { children: ReactNode }) {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return (
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider>
  );
}

describe("useExpedienteTimeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("normaliza el payload de actuaciones del backend", async () => {
    get.mockResolvedValue({
      data: {
        expedienteId: "exp-1",
        actuaciones: [
          {
            movimientoId: "mov-1",
            fechaHora: "2026-01-01T10:00:00.000Z",
            estadoAnterior: "REGISTRADO",
            evento: "RECEPCION",
            estadoNuevo: "RECEPCIONADO",
            usuarioOperadorId: "u-1",
            areaDestinoId: "area-1",
            proveido: "Recepción conforme",
            hashTransaccion: "abc123",
          },
        ],
      },
    } as never);

    const { result } = renderHook(() => useExpedienteTimeline("exp-1"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith(
      "/api/v1/expedientes/exp-1/trazabilidad",
    );
    expect(result.current.data ?? []).toHaveLength(1);
    expect(result.current.data?.[0]).toMatchObject({
      eventoId: "mov-1",
      expedienteId: "exp-1",
      tipoEvento: "RECEPCION",
      timestamp: "2026-01-01T10:00:00.000Z",
      usuarioId: "u-1",
      areaNombre: "area-1",
      estadoAnterior: "REGISTRADO",
      estadoNuevo: "RECEPCIONADO",
      descripcionDetallada: "Recepción conforme",
      hashTransaccion: "abc123",
    });
  });

  it("devuelve una lista vacía sin lanzar error si no hay movimientos", async () => {
    get.mockResolvedValue({
      data: { expedienteId: "exp-2", actuaciones: [] },
    } as never);

    const { result } = renderHook(() => useExpedienteTimeline("exp-2"), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data ?? []).toEqual([]);
  });
});
