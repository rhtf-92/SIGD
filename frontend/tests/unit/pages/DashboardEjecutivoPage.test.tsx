import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../src/api/client";
import DashboardEjecutivoPage from "../../../src/pages/DashboardEjecutivoPage";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn() } }));

const dashboardSummary = {
  periodo: "2026:2026",
  vtep: { valor: 95, meta: 95, cumple: true },
  tprHorasHabiles: { valor: 18.5, meta: 24, cumple: true },
  tro: { valor: 87, meta: 90, cumple: false },
  teo: { valor: 3, meta: 5, cumple: true },
  contadores: {
    nRadicados: 100,
    nAtendidos: 90,
    nArchivados: 5,
    nResueltos: 95,
    nEnTramite: 3,
    nObservados: 2,
    nResueltosDentroPlazo: 82,
    horasHabilesSuma: 1757.5,
  },
  actualizadoEn: "2026-10-16T12:00:00.000Z",
};

const dashboardTrend = Array.from({ length: 12 }, (_, index) => ({
  mes: index + 1,
  radicados: 20 + index,
  atendidos: 15 + index,
  observados: 2,
}));

const dashboardBottlenecks = [
  {
    areaId: "unidad-1",
    areaNombre: "Secretaría Académica",
    expedientesEstancados: 4,
    diasRetencion: 12.5,
    riesgo: "medio",
  },
];

function responseFor(url: string) {
  if (url.endsWith("/dashboard/resumen")) return dashboardSummary;
  if (url.endsWith("/dashboard/tendencias")) return dashboardTrend;
  return dashboardBottlenecks;
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardEjecutivoPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

function respondWithDashboard() {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    data: responseFor(url),
  }) as never);
}

afterEach(() => vi.clearAllMocks());

describe("DashboardEjecutivoPage filtros reactivos", () => {
  it("consulta los tres endpoints con el rango anual que acepta la API", async () => {
    respondWithDashboard();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/resumen", {
      params: { periodoDesde: "2026-01", periodoHasta: "2026-12" },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/tendencias", {
      params: { anio: 2026 },
    });
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/cuellos-botella", {
      params: { periodoDesde: "2026-01", periodoHasta: "2026-12", diasLimite: 5 },
    });
  });

  it("adapta los indicadores oficiales MGD y el resumen de la API", async () => {
    respondWithDashboard();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    expect(screen.getAllByText("95%")).toHaveLength(2);
    expect(screen.getByText("18.5")).toBeInTheDocument();
    expect(screen.getByText("87")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    const executiveSummary = screen.getByLabelText("Resumen ejecutivo");
    expect(within(executiveSummary).getByText("Sin comparativo")).toBeInTheDocument();
    expect(within(executiveSummary).getByText(/2026/)).toBeInTheDocument();
    expect(screen.getAllByText("Secretaría Académica")).toHaveLength(2);
    expect(screen.getByText("4")).toBeInTheDocument();
  });

  it("envía el mes seleccionado a los endpoints mensuales y conserva la serie anual", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "month");
    await user.selectOptions(await screen.findByLabelText("Mes"), "02");

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/resumen", {
        params: { periodo: "2026-02" },
      });
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/cuellos-botella", {
        params: { periodo: "2026-02", diasLimite: 5 },
      });
    });
  });

  it("envía al backend los meses personalizados seleccionados", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "custom");
    fireEvent.change(await screen.findByLabelText("Mes inicial"), { target: { value: "2026-03" } });
    fireEvent.change(screen.getByLabelText("Mes final"), { target: { value: "2026-06" } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/resumen", {
        params: { periodoDesde: "2026-03", periodoHasta: "2026-06" },
      });
    });
  });

  it("filtra localmente el ranking por unidad sin afirmar que los KPI también se filtraron", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findAllByText("Secretaría Académica");
    await user.selectOptions(screen.getByLabelText(/Unidad orgánica/), "unidad-1");

    expect(screen.getAllByText("Secretaría Académica")).toHaveLength(2);
    expect(screen.getByText(/los indicadores son institucionales/i)).toBeInTheDocument();
  });

  it("redibuja la serie del gráfico para el mes elegido", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    const { container } = renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "month");
    await user.selectOptions(await screen.findByLabelText("Mes"), "03");

    await waitFor(() => expect(container.querySelectorAll('svg[role="img"] circle')).toHaveLength(2));
  });

  it("muestra el skeleton accesible mientras las consultas siguen pendientes", () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}) as never);
    renderDashboard();

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando tablero ejecutivo.")).toBeInTheDocument();
  });

  it("permite reintentar la consulta tras un error de red", async () => {
    const attempts = new Map<string, number>();
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      const attempt = (attempts.get(url) ?? 0) + 1;
      attempts.set(url, attempt);
      if (attempt <= 2) throw new Error("Network Error");
      return { data: responseFor(url) } as never;
    });
    const user = userEvent.setup();
    renderDashboard();

    const retryButton = await screen.findByRole("button", { name: "Reintentar" }, { timeout: 5000 });
    expect(screen.getByText(/El servidor de reportes no está disponible en localhost:3000/i)).toBeInTheDocument();
    await user.click(retryButton);

    expect(await screen.findByText("Expedientes procesados")).toBeInTheDocument();
  });

  it("muestra estados vacíos correctos cuando la API no tiene registros en el período", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => {
      const data = url.endsWith("/dashboard/resumen")
        ? {
          ...dashboardSummary,
          contadores: {
            nRadicados: 0,
            nAtendidos: 0,
            nArchivados: 0,
            nResueltos: 0,
            nEnTramite: 0,
            nObservados: 0,
            nResueltosDentroPlazo: 0,
            horasHabilesSuma: 0,
          },
        }
        : url.endsWith("/dashboard/tendencias") ? [] : [];
      return { data } as never;
    });
    renderDashboard();

    expect(await screen.findByText("No hay datos de tendencia para el periodo seleccionado.")).toBeInTheDocument();
    expect(screen.getByText("No hay datos de estados para este periodo.")).toBeInTheDocument();
    expect(screen.getByText("No se identificaron cuellos de botella para el periodo seleccionado.")).toBeInTheDocument();
  });
});
