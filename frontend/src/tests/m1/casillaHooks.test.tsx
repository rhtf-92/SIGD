import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CASILLA_QUERY_KEYS, useCasilla } from "../../hooks/useCasilla";
import { useCasillaNotifications } from "../../hooks/useCasillaNotifications";
import { acuse, filtrosIniciales, notificacion } from "./fixtures";

const serviceMocks = vi.hoisted(() => ({
  getNotificaciones: vi.fn(),
  getEstadisticas: vi.fn(),
  marcarComoLeido: vi.fn(),
  generarAcuseLegal: vi.fn(),
}));

vi.mock("../../services/casillaService", () => ({
  casillaService: serviceMocks,
}));

class FakeEventSource {
  static instances: FakeEventSource[] = [];
  url: string;
  addEventListener = vi.fn();
  removeEventListener = vi.fn();
  close = vi.fn();
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(url: string) {
    this.url = url;
    FakeEventSource.instances.push(this);
  }
}

function wrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useCasilla", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    serviceMocks.getNotificaciones.mockResolvedValue({
      data: [notificacion],
      meta: { currentPage: 1, totalPages: 1, totalItems: 1, itemsPerPage: 5, hasNextPage: false, hasPreviousPage: false },
    });
    serviceMocks.getEstadisticas.mockResolvedValue({ total: 1, noLeidos: 1, leidos: 0, notificados: 0, urgentes: 1 });
    serviceMocks.marcarComoLeido.mockResolvedValue({ ...notificacion, estado: "LEIDO" });
    serviceMocks.generarAcuseLegal.mockResolvedValue({ success: true, notificacionActualizada: { ...notificacion, estado: "NOTIFICADO", acuse } });
  });

  it("consulta datos, cambia/restaura filtros y actualiza el detalle tras leer y emitir acuse", async () => {
    const { result } = renderHook(() => useCasilla(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.notificaciones).toEqual([notificacion]));
    expect(result.current.stats.noLeidos).toBe(1);
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setTipo("OFICIO");
      result.current.setEstado("LEIDO");
      result.current.setFechaInicio("2026-01-01");
      result.current.setFechaFin("2026-01-31");
      result.current.setBusqueda("acta");
      result.current.setPage(2);
      result.current.setLimit(10);
    });
    expect(result.current.hasActiveFilters).toBe(true);
    expect(result.current.filtros).toMatchObject({ tipo: "OFICIO", estado: "LEIDO", page: 1, limit: 10 });
    await waitFor(() => expect(serviceMocks.getNotificaciones).toHaveBeenCalledWith(expect.objectContaining({ tipo: "OFICIO" })));

    act(() => result.current.openDetalle(notificacion));
    expect(result.current.isModalOpen).toBe(true);
    await waitFor(() => expect(serviceMocks.marcarComoLeido).toHaveBeenCalledWith(notificacion.id));
    await waitFor(() => expect(result.current.selectedNotificacion?.estado).toBe("LEIDO"));
    act(() => result.current.closeDetalle());
    expect(result.current.isModalOpen).toBe(false);

    act(() => result.current.generarAcuse(notificacion.id));
    await waitFor(() => expect(serviceMocks.generarAcuseLegal).toHaveBeenCalledWith(notificacion.id));
    await waitFor(() => expect(result.current.selectedNotificacion?.estado).toBe("NOTIFICADO"));
    expect(result.current.generarAcuseSuccess).toBe(true);

    act(() => result.current.resetFiltros());
    expect(result.current.filtros).toEqual(filtrosIniciales);
    expect(result.current.hasActiveFilters).toBe(false);
    act(() => result.current.setLimit(20));
    act(() => result.current.setPage(3));
    expect(result.current.filtros).toMatchObject({ page: 3, limit: 20 });
  });

  it("devuelve los valores iniciales y el error al fallar la carga", async () => {
    const error = new Error("HTTP 503");
    serviceMocks.getNotificaciones.mockRejectedValue(error);
    const { result } = renderHook(() => useCasilla(), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.notificaciones).toEqual([]);
    expect(result.current.error).toBe(error);
    expect(result.current.meta.totalItems).toBe(0);
    expect(result.current.stats.total).toBe(1);
  });
});

describe("useCasillaNotifications", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
    localStorage.clear();
  });

  afterEach(() => vi.unstubAllGlobals());

  it("abre el stream con token, invalida caché por ambos eventos y limpia suscripción", async () => {
    localStorage.setItem("sigd_token", "token-prueba");
    const queryClient = new QueryClient();
    const invalidate = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue();
    const hookWrapper = ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result, unmount } = renderHook(() => useCasillaNotifications(), { wrapper: hookWrapper });
    const source = FakeEventSource.instances[0]!;
    expect(new URL(source.url).searchParams.get("token")).toBe("token-prueba");
    expect(new URL(source.url).searchParams.get("canales")).toBe("casilla");
    expect(source.addEventListener).toHaveBeenCalledTimes(2);
    act(() => source.onopen?.());
    expect(result.current.sseConectado).toBe(true);
    const eventHandler = source.addEventListener.mock.calls[0]?.[1] as EventListener;
    act(() => eventHandler(new MessageEvent("casilla_notificacion")));
    expect(result.current.notificacionesRecibidas).toBe(1);
    expect(invalidate).toHaveBeenCalledWith({ queryKey: CASILLA_QUERY_KEYS.all });
    act(() => source.onerror?.());
    expect(result.current.sseConectado).toBe(false);
    unmount();
    expect(source.removeEventListener).toHaveBeenCalledTimes(2);
    expect(source.close).toHaveBeenCalledOnce();
  });

  it("abre el stream sin token y omite el parámetro de autorización", () => {
    const { unmount } = renderHook(() => useCasillaNotifications(), { wrapper: wrapper() });
    const source = FakeEventSource.instances[0]!;
    expect(new URL(source.url).searchParams.has("token")).toBe(false);
    unmount();
  });
});
