import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { apiClient } from "../../../src/api/client";
import ExpedienteDetallePage from "../../../src/pages/expedientes/ExpedienteDetallePage";
import type { ExpedienteDetalleRutaDoc } from "../../../src/types/expediente";
import { useAuthStore } from "../../../src/stores/authStore";

const mockExpedienteDerivado: ExpedienteDetalleRutaDoc = {
  idExpediente: "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  cut: "EXP-2026-000011",
  asunto: "Derecho de Reincorporación (Reingreso)",
  fechaRadicacion: "2026-10-27T18:23:27.000Z",
  estadoActual: "DERIVADO",
  areaActualId: "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
  solicitanteId: "00000000-0000-0000-0000-000000000011",
  resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 5 },
  ultimoMovimiento: {
    idMovimiento: "mov-deriv-01",
    evento: "DERIVACION",
    estadoNuevo: "DERIVADO",
    fechaHora: "2026-10-27T18:59:52.000Z",
    usuarioOperadorId: "990000000",
  },
  sla: null,
};

function renderDetalle(id: string = "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/expedientes/${id}`]}>
        <Routes>
          <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("FASE 7B: Acción Frontend de Recepción Formal en ExpedienteDetallePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ usuario: { id: '11111111-1111-4111-8111-111111111111',
      nombreCompleto: 'Operador de prueba', correo: 'operador@example.invalid', rol: 'MESA_PARTES',
      permisos: [{ codigo: 'EXPEDIENTE_DERIVAR', ambito: 'AREA', areaId: mockExpedienteDerivado.areaActualId }] } });
  });
  afterEach(() => useAuthStore.setState({ usuario: null }));

  it('no ofrece recepcion sin una facultad persistida, aunque el expediente sea DERIVADO', async () => {
    useAuthStore.setState({ usuario: null });
    setupGetMock(mockExpedienteDerivado); renderDetalle();
    await screen.findByRole('heading', { name: mockExpedienteDerivado.cut });
    expect(screen.queryByRole('button', { name: /Recepcionar Expediente/ })).toBeNull();
  });

  function setupGetMock(expediente: ExpedienteDetalleRutaDoc = mockExpedienteDerivado) {
    return vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes("/trazabilidad")) {
        return { data: { expedienteId: expediente.idExpediente, actuaciones: [] } } as AxiosResponse;
      }
      if (url.includes("/api/v1/areas")) {
        return { data: [] } as AxiosResponse;
      }
      if (url.includes("/api/v1/expedientes/")) {
        return { data: expediente } as AxiosResponse;
      }
      return { data: {} } as AxiosResponse;
    });
  }

  it("1. Muestra el botón '✓ Recepcionar Expediente' cuando el estado es DERIVADO", async () => {
    setupGetMock(mockExpedienteDerivado);

    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    expect(btnRecepcionar).toBeInTheDocument();
    expect(btnRecepcionar).toBeEnabled();
  });

  it("2. NO muestra el botón '✓ Recepcionar Expediente' si el estado ya es EN_REVISION", async () => {
    setupGetMock({ ...mockExpedienteDerivado, estadoActual: "EN_REVISION" });

    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
  });

  it("3. Al pulsar 'Recepcionar', invoca el endpoint POST /api/v1/expedientes/:id/recepcionar y muestra éxito", async () => {
    setupGetMock(mockExpedienteDerivado);

    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        mensaje: "Recepción formal registrada exitosamente.",
        nuevoEstado: "EN_REVISION",
        secuencia: "3",
      },
    } as AxiosResponse);

    renderDetalle();

    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    fireEvent.click(btnRecepcionar);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        `/api/v1/expedientes/${mockExpedienteDerivado.idExpediente}/recepcionar`,
        {},
      );
    });

    expect(await screen.findByText(/Expediente recepcionado formalmente/)).toBeInTheDocument();
  });

  it("4. Muestra mensaje de error cuando el servidor rechaza la recepción (409 Conflict)", async () => {
    setupGetMock(mockExpedienteDerivado);

    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: "EXPEDIENTE_YA_RECEPCIONADO",
          message: "El expediente ya fue recepcionado.",
        },
      },
    });

    renderDetalle();

    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    fireEvent.click(btnRecepcionar);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /El expediente cambió o la acción no corresponde a su estado actual/,
    );
  });

  it("5. Muestra el botón 'Proyectar Resolución' cuando el estado es EN_REVISION", async () => {
    setupGetMock({ ...mockExpedienteDerivado, estadoActual: "EN_REVISION" });

    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    const btnProyectar = await screen.findByRole("button", { name: "Proyectar Resolución" });
    expect(btnProyectar).toBeInTheDocument();
    expect(btnProyectar).toBeEnabled();
  });
});
