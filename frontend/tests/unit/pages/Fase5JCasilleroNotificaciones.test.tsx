import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import ConsultaPublicaPage from "../../../src/pages/tramite/ConsultaPublicaPage";
import CasillaElectronicaPage from "../../../src/pages/casilla/CasillaElectronicaPage";
import { apiClient } from "../../../src/api/client";
import { casillaService } from "../../../src/services/casillaService";
import { useAuthStore } from "../../../src/stores/authStore";

vi.mock("../../../src/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock("../../../src/services/casillaService", () => ({
  casillaService: {
    getNotificaciones: vi.fn(),
    getNotificacionById: vi.fn(),
    marcarComoLeido: vi.fn(),
    generarAcuseLegal: vi.fn(),
    getEstadisticas: vi.fn(),
    descargarDocumento: vi.fn(),
    descargarAcuse: vi.fn(),
  },
}));

describe("Fase 5J Frontend: Consulta Pública, Casilla y Notificaciones", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    useAuthStore.setState({
      usuario: { id: "user-123", email: "ciudadano@suiza.edu.pe", nombres: "Juan", apellidos: "Perez", rol: "CIUDADANO" } as any,
      accessToken: "mock-valid-token",
      isAuthenticated: true,
    });
  });

  const renderWithProviders = (ui: React.ReactElement, initialRoute = "/") => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[initialRoute]}>
          <Routes>
            <Route path="/" element={ui} />
            <Route path="/consulta" element={<ConsultaPublicaPage />} />
            <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
            <Route path="/casilla" element={<CasillaElectronicaPage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("ConsultaPublicaPage: busca por CUT y DNI mostrando datos públicos mínimos sin PII sensible", async () => {
    const mockExpedientePublico = {
      cut: "EXP-2026-000100",
      anioFiscal: 2026,
      estadoTramite: "EN PROCESO",
      tipoTramite: "Certificado de Estudios",
      asunto: "Solicitud de trámite regular",
      fechaEnvioReal: "2026-03-01T10:00:00Z",
      fechaRadicacionLegal: "2026-03-01T10:00:00Z",
      fueraDeHorario: false,
      canalRecepcion: "MESA_VIRTUAL",
      totalFolios: 3,
      pasoSiguiente: "En revisión por el área responsable",
      estadoPago: "PAGADO",
      documentos: [],
      proveidos: [],
      mensajeLegal: "Información pública Ley N° 29733.",
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockExpedientePublico } as any);

    renderWithProviders(<ConsultaPublicaPage />, "/consulta");

    expect(screen.getByText(/Consulta Pública de Trámites/i)).toBeInTheDocument();
    const inputCut = screen.getByLabelText(/Código Único de Trámite/i);
    const inputDoc = screen.getByLabelText(/Documento del Solicitante/i);
    const botonBuscar = screen.getByRole("button", { name: /Consultar Estado/i });

    await userEvent.type(inputCut, "EXP-2026-000100");
    await userEvent.type(inputDoc, "45678901");
    await userEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 2, name: "EXP-2026-000100" })).toBeInTheDocument();
      expect(screen.getByText("EN PROCESO")).toBeInTheDocument();
      expect(screen.getByText("En revisión por el área responsable")).toBeInTheDocument();
    });

    // Verificación de privacidad: NO se muestran DNI, nombres, área interna ni S3 keys
    expect(screen.queryByText(/45\*\*\*901/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/J\*\*\* P\*\*\*\* G\*\*\*\*\*/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Secretaría Académica/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/s3:\/\//i)).not.toBeInTheDocument();
  });

  it("ConsultaPublicaPage: maneja respuesta uniforme 404 ante CUT inexistente o documento erróneo", async () => {
    vi.mocked(apiClient.get).mockRejectedValue({
      response: {
        status: 404,
        data: { detail: "Consulta no disponible para los datos proporcionados." },
      },
    });

    renderWithProviders(<ConsultaPublicaPage />, "/consulta");

    const inputCut = screen.getByLabelText(/Código Único de Trámite/i);
    const inputDoc = screen.getByLabelText(/Documento del Solicitante/i);
    const botonBuscar = screen.getByRole("button", { name: /Consultar Estado/i });

    await userEvent.type(inputCut, "EXP-2026-999999");
    await userEvent.type(inputDoc, "00000000");
    await userEvent.click(botonBuscar);

    await waitFor(() => {
      expect(screen.getByText(/No se encontró ningún expediente con los datos provistos/i)).toBeInTheDocument();
    });
  });

  it("CasillaElectronicaPage: lista notificaciones con estados neutros (PUESTA_A_DISPOSICION, VISUALIZADA)", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        nombreCompleto: "Juan Perez Garcia",
        tipoDocumento: "DNI",
        numeroDocumento: "45678901",
        correo: "juan@iestpsuiza.edu.pe",
      },
    } as any);

    vi.mocked(casillaService.getEstadisticas).mockResolvedValue({
      total: 1,
      noLeidos: 1,
      leidos: 0,
      notificados: 0,
      urgentes: 0,
    });

    vi.mocked(casillaService.getNotificaciones).mockResolvedValue({
      data: [
        {
          id: "notif-01",
          numeroNotificacion: "NOT-2026-000001",
          numeroExpediente: "EXP-2026-000100",
          asunto: "Resolución Directoral Disponible",
          tipo: "RESOLUCION",
          estado: "PUESTA_A_DISPOSICION",
          prioridad: "NORMAL",
          unidadEmisora: "Secretaría General",
          fechaDepositoIso: "2026-03-01T10:00:00Z",
          requiereAcuse: true,
          actoAdministrativo: {
            tipoActo: "Resolución Directoral",
            numeroDocumento: "RD-001-2026",
            anio: 2026,
            asunto: "Resolución Final",
            resumenLegal: "Resolución otorgando certificación oficial.",
            nombreArchivoPdf: "resolucion_final.pdf",
            tamanoArchivo: "1.2 MB",
            hashIntegridadSha256: "abc123hash",
            cvd: "CVD-2026-RES-000100-A1B2",
            firmantes: [],
          },
        },
      ],
      meta: {
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        itemsPerPage: 10,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    });

    renderWithProviders(<CasillaElectronicaPage />, "/casilla");

    await waitFor(() => {
      expect(screen.getByText(/Bandeja de Casilla Electrónica Ciudadana/i)).toBeInTheDocument();
      expect(screen.getByText("Resolución Directoral Disponible")).toBeInTheDocument();
      expect(screen.getByText("Puesta a disposición")).toBeInTheDocument();
    });
  });
});
