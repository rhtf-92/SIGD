// @vitest-environment jsdom
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatearFechaRadicacion, useBandejaRutaDoc, useDetalleRutaDoc, useTrazabilidadRutaDoc } from "./useRutaDocExpedientes";

const get = vi.fn();
vi.mock("../api/client", () => ({ apiClient: { get: (...args: unknown[]) => get(...args) } }));

function wrapper({ children }: PropsWithChildren) {
  return <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{children}</QueryClientProvider>;
}

describe("contrato HTTP de RutaDoc", () => {
  beforeEach(() => vi.clearAllMocks());

  it("envía pestaña, búsqueda, fechas y cursor al listado paginado", async () => {
    get.mockResolvedValue({ data: { elementos: [], siguienteCursor: null, tieneMas: false, contadores: {} } });
    const filtros = { pestana: "PENDIENTES" as const, terminoBusqueda: "EXP-2026", fechaDesde: "2026-10-01", fechaHasta: "2026-10-18", cursor: "continuacion", limite: 20 };
    const { result } = renderHook(() => useBandejaRutaDoc(filtros), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/api/v1/expedientes", { params: filtros });
  });

  it("consulta el detalle por identificador canónico", async () => {
    get.mockResolvedValue({ data: { idExpediente: "12", cut: "EXP-12" } });
    const { result } = renderHook(() => useDetalleRutaDoc("12"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/api/v1/expedientes/12");
  });

  it("consulta la trazabilidad autorizada por identificador", async () => {
    get.mockResolvedValue({ data: { expedienteId: "12", actuaciones: [] } });
    const { result } = renderHook(() => useTrazabilidadRutaDoc("12"), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenCalledWith("/api/v1/expedientes/12/trazabilidad");
  });

  it("no consulta el servidor cuando las fechas son inválidas", () => {
    renderHook(() => useBandejaRutaDoc({ pestana: "PENDIENTES" }, false), { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it("muestra la fecha de radicación en el mismo día UTC que usa el filtro", () => {
    expect(formatearFechaRadicacion("2026-09-02T00:00:00.000Z")).toBe("02/09/2026");
  });
});
