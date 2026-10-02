import "@testing-library/jest-dom/vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../src/api/client";
import DashboardEjecutivoPage from "../../../src/pages/DashboardEjecutivoPage";

vi.mock("@/api/client", () => ({ apiClient: { get: vi.fn() } }));

const dashboardResponse = {
  totalProcesados: 120,
  tasaResolucionOportuna: 84.5,
  tasaCompletitud: 91,
  deltaMensual: 4.2,
  saludMesasPartes: "Operativa",
  tendencia: [{ fechaLabel: "Enero", radicados: 10, resueltos: 8 }],
  estados: [{ estado: "En trámite", porcentaje: 100 }],
  unidades: [{ id: "unidad-1", nombre: "Secretaría Académica" }],
  cuellosBotella: [],
};

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
  vi.mocked(apiClient.get).mockResolvedValue({ data: dashboardResponse } as never);
}

afterEach(() => vi.clearAllMocks());

describe("DashboardEjecutivoPage filtros reactivos", () => {
  it("consulta el endpoint canónico con el año completo predeterminado", async () => {
    respondWithDashboard();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    expect(apiClient.get).toHaveBeenCalledWith("/api/v1/reportes/dashboard/resumen", {
      params: expect.objectContaining({
        fechaInicio: "2026-01-01",
        fechaFin: "2026-12-31",
        periodo: "anual",
        anio: 2026,
      }),
    });
  });

  it("renderiza los indicadores y el resumen ejecutivo recibidos", async () => {
    respondWithDashboard();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    const executiveSummary = screen.getByLabelText("Resumen ejecutivo");
    expect(await within(executiveSummary).findByText("91%")).toBeInTheDocument();
    expect(within(executiveSummary).getByText((_, element) => element?.textContent?.replace(/\s/g, "") === "+4.2%")).toBeInTheDocument();
    expect(screen.getByText("Operativa")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
  });

  it("cambia a periodo mensual y consulta sus fechas", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "month");

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
      "/api/v1/reportes/dashboard/resumen",
      { params: expect.objectContaining({ periodo: "mensual", fechaInicio: "2026-01-01", fechaFin: "2026-01-31", mes: "01" }) },
    ));
  });

  it("actualiza los parámetros al cambiar el mes", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "month");
    await user.selectOptions(await screen.findByLabelText("Mes"), "02");

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
      "/api/v1/reportes/dashboard/resumen",
      { params: expect.objectContaining({ fechaInicio: "2026-02-01", fechaFin: "2026-02-28", mes: "02" }) },
    ));
  });

  it("envía las fechas elegidas para un rango personalizado", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "custom");
    fireEvent.change(await screen.findByLabelText("Desde"), { target: { value: "2026-03-04" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-03-20" } });

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
      "/api/v1/reportes/dashboard/resumen",
      { params: expect.objectContaining({ periodo: "personalizado", fechaInicio: "2026-03-04", fechaFin: "2026-03-20" }) },
    ));
  });

  it("incluye la unidad orgánica seleccionada en la consulta", async () => {
    respondWithDashboard();
    const user = userEvent.setup();
    renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Unidad orgánica"), "unidad-1");

    await waitFor(() => expect(apiClient.get).toHaveBeenLastCalledWith(
      "/api/v1/reportes/dashboard/resumen",
      { params: expect.objectContaining({ unidadOrganicaId: "unidad-1" }) },
    ));
  });

  it("vuelve a dibujar la tendencia con la respuesta del filtro nuevo", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (_url, config) => ({
      data: {
        ...dashboardResponse,
        tendencia: Array.from({ length: (config?.params as { mes?: string } | undefined)?.mes === "03" ? 3 : 1 }, (_, index) => ({
          fechaLabel: `P${index + 1}`,
          radicados: index + 1,
          resueltos: index,
        })),
      },
    }) as never);
    const user = userEvent.setup();
    const { container } = renderDashboard();

    await screen.findByText("Expedientes procesados");
    await user.selectOptions(screen.getByLabelText("Periodo"), "month");
    await user.selectOptions(await screen.findByLabelText("Mes"), "03");

    await waitFor(() => expect(container.querySelectorAll('svg[role="img"] circle')).toHaveLength(6));
  });

  it("muestra el skeleton accesible mientras la consulta sigue pendiente", () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}) as never);
    renderDashboard();

    expect(screen.getByRole("main")).toHaveAttribute("aria-busy", "true");
    expect(screen.getByText("Cargando tablero ejecutivo.")).toBeInTheDocument();
  });
});
