import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpedienteDetallePage from "../../../src/pages/expedientes/ExpedienteDetallePage";
import { apiClient } from "../../../src/api/client";
import { useAuthStore } from "../../../src/stores/authStore";

const mockExpedienteId = "11111111-1111-4111-8111-111111111111";

describe("ExpedienteDetallePage - Consumo consolidado de /resumen y foliación bajo demanda (P1 / Codex)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    useAuthStore.setState({
      accessToken: "token-admin",
      usuario: {
        id: "usr-admin",
        correo: "admin@institucion.edu.pe",
        rol: "ADMINISTRADOR",
        nombreCompleto: "Administrador General",
      },
      isAuthenticated: true,
    });
  });

  it("A. carga inicial realiza 1 sola petición (/resumen) y 0 peticiones de foliación detallada", async () => {
    const llamadas: string[] = [];

    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      const ruta = new URL(url, "http://localhost:3000").pathname;
      llamadas.push(ruta);
      if (ruta === `/api/v1/expedientes/${mockExpedienteId}/resumen`) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "CUT-CONSOLIDADO-2026",
              asunto: "Solicitud con resumen consolidado",
              fechaRadicacion: "2026-10-27T10:00:00Z",
              estadoActual: "EN_TRAMITE",
              areaActualId: null,
              solicitanteId: null,
              resumenDocumentos: { cantidadDocumentos: 2, totalFolios: 5 },
            },
            estado: "EN_TRAMITE",
            slaResumen: {
              estado: "VERDE",
              diasHabilesRestantes: 20,
              porcentaje: 25.5,
              fechaLimite: "2026-11-20",
            },
            foliacionResumen: {
              cantidadDocumentos: 2,
              totalFolios: 5,
            },
            tupaResumen: {
              codigo: "TUPA-RESUMEN-01",
              denominacion: "Certificado Consolidado",
              clasificacion: "AUTOMATICO",
              plazoDias: 15,
              costo: 12.5,
            },
          },
        } as any;
      }
      if (ruta === `/api/v1/expedientes/${mockExpedienteId}/foliacion`) {
        return {
          data: [
            {
              idDocumento: "33333333-3333-4333-8333-333333333331",
              nombre: "Solicitud.pdf",
              tipo: "SOLICITUD",
              folioInicio: 1,
              folioFin: 2,
              cantidadFolios: 2,
              rango: "1-2",
              checksumSha256: null,
            },
            {
              idDocumento: "33333333-3333-4333-8333-333333333332",
              nombre: "Comprobante.pdf",
              tipo: "COMPROBANTE",
              folioInicio: 3,
              folioFin: 5,
              cantidadFolios: 3,
              rango: "3-5",
              checksumSha256: null,
            },
          ],
        } as any;
      }
      return { data: { expedienteId: mockExpedienteId, actuaciones: [] } } as any;
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${mockExpedienteId}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    // Verifica que se renderiza la vista inicial con los datos de /resumen
    expect(await screen.findByText("CUT-CONSOLIDADO-2026")).toBeInTheDocument();
    expect(screen.getByText("Solicitud con resumen consolidado")).toBeInTheDocument();
    expect(screen.getByText(/2 documentos, 5 folios asignados/i)).toBeInTheDocument();
    expect(screen.getByText("Certificado Consolidado")).toBeInTheDocument();

    // 1 sola petición inicial (/resumen) y 0 peticiones de foliación detallada ni trazabilidad
    expect(llamadas).toEqual([`/api/v1/expedientes/${mockExpedienteId}/resumen`]);
    expect(llamadas.length).toBe(1);
    expect(llamadas).not.toContain(`/api/v1/expedientes/${mockExpedienteId}/foliacion`);
    expect(llamadas).not.toContain(`/api/v1/expedientes/${mockExpedienteId}/trazabilidad`);

    // B. Al pulsar "Ver desglose detallado de documentos y folios", se ejecuta 1 request a /foliacion
    const botonDesglose = screen.getByRole("button", { name: "Ver desglose detallado de documentos y folios" });
    fireEvent.click(botonDesglose);

    await waitFor(() => {
      expect(llamadas).toContain(`/api/v1/expedientes/${mockExpedienteId}/foliacion`);
    });

    // C. El resumen exitoso NO bloqueó la foliación detallada y renderiza los documentos
    expect(await screen.findByText("Solicitud.pdf")).toBeInTheDocument();
    expect(screen.getByText("Comprobante.pdf")).toBeInTheDocument();

    // D. Trazabilidad sigue bajo demanda, pero abrir el panel ya inicia la consulta.
    expect(llamadas).not.toContain(`/api/v1/expedientes/${mockExpedienteId}/trazabilidad`);
    const panelTrazabilidad = screen.getByText("Trazabilidad").closest("details");
    expect(panelTrazabilidad).not.toBeNull();
    panelTrazabilidad!.open = true;
    fireEvent(panelTrazabilidad!, new Event("toggle", { bubbles: true }));

    await waitFor(() => {
      expect(llamadas).toContain(`/api/v1/expedientes/${mockExpedienteId}/trazabilidad`);
    });
    expect(await screen.findByText("Sin eventos registrados para este expediente.")).toBeInTheDocument();
  });
});
