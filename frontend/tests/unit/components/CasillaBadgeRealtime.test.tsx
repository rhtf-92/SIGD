import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement, type ReactNode } from "react";
import { CasillaBadgeRealtime } from "../../../src/components/casilla/CasillaBadgeRealtime";
import { useAuthStore } from "../../../src/stores/authStore";

vi.mock("../../../src/services/casillaService", () => ({
  casillaService: {
    getEstadisticas: vi.fn().mockResolvedValue({
      total: 5,
      noLeidos: 2,
      leidos: 3,
      notificados: 0,
      urgentes: 0,
    }),
    getNotificaciones: vi.fn().mockResolvedValue({
      data: [],
      meta: { currentPage: 1, totalPages: 1, totalItems: 0, itemsPerPage: 10, hasNextPage: false, hasPreviousPage: false },
    }),
  },
  CASILLA_ENDPOINTS: {
    ESTADISTICAS: "/api/v1/casilla/estadisticas",
    LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",
  },
}));

describe("CasillaBadgeRealtime Component", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAuthStore.setState({ accessToken: "token-badge-test", isAuthenticated: true });
  });

  const wrapper = ({ children }: { children: ReactNode }) =>
    createElement(QueryClientProvider, { client: queryClient }, children);

  it("renderiza el indicador de campana con estado accesible", async () => {
    render(<CasillaBadgeRealtime />, { wrapper });

    const statusEl = screen.getByRole("status");
    expect(statusEl).toBeInTheDocument();
    expect(statusEl).toHaveTextContent("🔔");
  });
});
