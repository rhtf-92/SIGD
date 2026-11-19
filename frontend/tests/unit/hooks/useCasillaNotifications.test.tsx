import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { useCasillaNotifications } from "../../../src/hooks/useCasillaNotifications";
import { useAuthStore } from "../../../src/stores/authStore";

// Mock EventSource
class MockEventSource {
  public url: string;
  public onopen: (() => void) | null = null;
  public onerror: (() => void) | null = null;
  public listeners = new Map<string, Array<(e: unknown) => void>>();
  public closed = false;

  constructor(url: string) {
    this.url = url;
    MockEventSource.instances.push(this);
  }

  static instances: MockEventSource[] = [];

  addEventListener(event: string, handler: (e: unknown) => void) {
    const list = this.listeners.get(event) || [];
    list.push(handler);
    this.listeners.set(event, list);
  }

  removeEventListener(event: string, handler: (e: unknown) => void) {
    const list = this.listeners.get(event) || [];
    this.listeners.set(
      event,
      list.filter((h) => h !== handler),
    );
  }

  close() {
    this.closed = true;
  }

  emit(event: string, data?: unknown) {
    const list = this.listeners.get(event) || [];
    list.forEach((h) => h(data));
  }
}

describe("useCasillaNotifications Hook (SSE CoreLink)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    MockEventSource.instances = [];
    vi.stubGlobal("EventSource", MockEventSource);
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    localStorage.clear();
    useAuthStore.setState({ accessToken: null, isAuthenticated: false });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("1. No inicia conexión SSE si el usuario no está autenticado (evita bucles 401)", () => {
    const { result } = renderHook(() => useCasillaNotifications(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(0);
    expect(result.current.sseConectado).toBe(false);
    expect(result.current.notificacionesRecibidas).toBe(0);
  });

  it("2. Inicia conexión SSE con token y canal 'casilla' cuando el usuario está autenticado", () => {
    useAuthStore.setState({ accessToken: "jwt-token-prueba-12345", isAuthenticated: true });

    const { result } = renderHook(() => useCasillaNotifications(), { wrapper });

    expect(MockEventSource.instances).toHaveLength(1);
    const es = MockEventSource.instances[0];
    expect(es.url).toContain("canales=casilla");
    expect(es.url).toContain("token=jwt-token-prueba-12345");

    act(() => {
      es.onopen?.();
    });

    expect(result.current.sseConectado).toBe(true);
  });

  it("3. Invalida la caché de TanStack Query al recibir un evento de notificación", () => {
    useAuthStore.setState({ accessToken: "jwt-token-prueba-12345", isAuthenticated: true });
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCasillaNotifications(), { wrapper });
    const es = MockEventSource.instances[0];

    act(() => {
      es.emit("casilla_notificacion", { tipo: "RESOLUCION" });
    });

    expect(result.current.notificacionesRecibidas).toBe(1);
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["casilla"] });
  });

  it("4. Limpia la conexión y elimina listeners al desmontar el hook", () => {
    useAuthStore.setState({ accessToken: "jwt-token-prueba-12345", isAuthenticated: true });

    const { unmount } = renderHook(() => useCasillaNotifications(), { wrapper });
    const es = MockEventSource.instances[0];

    expect(es.closed).toBe(false);

    unmount();

    expect(es.closed).toBe(true);
    // Listeners removed
    for (const [, handlers] of es.listeners.entries()) {
      expect(handlers).toHaveLength(0);
    }
  });
});
