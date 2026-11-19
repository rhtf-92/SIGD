import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";
import {
  SeccionClasificacionCCD,
  SeccionVersionesDocumentales,
  VisorPdfExpediente,
} from "../../../src/pages/expedientes/ExpedienteDetallePage";
import ExpedienteTimeline from "../../../src/components/expedientes/ExpedienteTimeline";
import type {
  ClasificacionCCD,
  ExpedienteDetalleRutaDoc,
  ExpedienteSGD,
  VersionDocumento,
} from "../../../src/types/expediente";

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

function crearApiError(status: number, detail = "Error de prueba"): ApiHttpError {
  return new ApiHttpError({
    type: "about:blank",
    title: `Error ${status}`,
    status,
    detail,
    instance: "/api/v1/expedientes/clasificador-ccd",
    code: status === 403 ? "FORBIDDEN" : status === 401 ? "UNAUTHORIZED" : "INTERNAL_ERROR",
    category: status === 403 || status === 401 ? "Security" : "System",
    correlationId: "test-corr-id",
    retryable: status >= 500,
  });
}

const mockExpedienteBase: ExpedienteDetalleRutaDoc = {
  idExpediente: "cad71708-e867-42ce-86ac-a005915d257c",
  cut: "EXP-2026-000019",
  asunto: "Solicitud presencial para verificación de cargo CUT y confirmación institucional",
  fechaRadicacion: "2026-10-29T18:18:22.450Z",
  estadoActual: "REGISTRADO",
  areaActualId: "a1a3a496-ff7f-45d8-b63c-3e54fcf79de1",
  solicitanteId: "00000000-0000-0000-0000-000000000050",
  resumenDocumentos: { cantidadDocumentos: 0, totalFolios: 0 },
  documentos: [],
  ultimoMovimiento: null,
  sla: null,
};

describe("Fase 5: Pruebas de Clasificación CCD", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Expediente con clasificación válida: representa los datos reales del CCD", () => {
    const clasificacionValida: ClasificacionCCD = {
      fondo: "IESTP_SUIZA",
      seccion: "SECRETARIA_ACADEMICA",
      serieDocumental: "TITULACION_PROFESIONAL",
      subserieDocumental: "EXPEDICION_TITULOS",
      codigoSerie: "CCD-SA-TIT",
      codigoSubserie: "CCD-SA-TIT.01",
    };

    const expConCCD: ExpedienteSGD = {
      id: "exp-sgd-01",
      codigoExpediente: "EXP-2026-000099",
      asunto: "Tramite con clasificacion CCD completa",
      solicitante: {
        tipoPersona: "NATURAL",
        tipoDocumento: "DNI",
        numeroDocumento: "12345678",
        nombreOrazonSocial: "Juan Perez",
        correoNotificacion: "juan@example.com",
        telefonoContacto: "987654321",
      },
      clasificacionCCD: clasificacionValida,
      metadatos: {
        tipoDocumentoPrincipal: "SOLICITUD",
        palabrasClave: ["titulo"],
        creadorId: "usr-1",
        creadorNombre: "Operador Mesa",
      },
      areaOrigen: "MESA_DE_PARTES",
      areaActual: "SECRETARIA_ACADEMICA",
      estadoFlujo: "EN_PROCESO",
      prioridad: "NORMAL",
      fechaIngreso: "2026-10-29T10:00:00Z",
      fechaUltimoMovimiento: "2026-10-29T11:00:00Z",
      fechaLimiteAtencion: "2026-11-20T10:00:00Z",
      versionesDocumentos: [],
      cantidadFolios: 5,
    };

    render(<SeccionClasificacionCCD expediente={expConCCD} />, { wrapper: crearWrapper() });

    expect(screen.getByRole("heading", { name: "Clasificación Documental - CCD" })).toBeInTheDocument();
    expect(screen.getByText("CCD-SA-TIT.01")).toBeInTheDocument();
    expect(screen.getByText("Titulación Profesional")).toBeInTheDocument();
    expect(screen.getByText("EXPEDICION_TITULOS")).toBeInTheDocument();
  });

  it("2. Expediente sin clasificación asignada: muestra estado 'Sin clasificación asignada' y botón para consultar catálogo", async () => {
    render(<SeccionClasificacionCCD expediente={mockExpedienteBase} />, {
      wrapper: crearWrapper(),
    });

    expect(screen.getByText("Sin clasificación asignada")).toBeInTheDocument();
    expect(screen.getByText(/Expediente en estado REGISTRADO/i)).toBeInTheDocument();
    expect(
      screen.getByText(/todavía no tiene una serie o subserie documental del CCD asignada/i)
    ).toBeInTheDocument();

    const botonConsultar = screen.getByRole("button", { name: "Consultar catálogo CCD institucional" });
    expect(botonConsultar).toBeInTheDocument();

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: {
        elementos: [
          {
            id: "rutadoc-serie-demo-01",
            codigo: "DEMO-01",
            nombre: "Serie de ejemplo (no oficial)",
            tipo: "SERIE",
            hijos: [],
          },
        ],
      },
    });

    fireEvent.click(botonConsultar);

    await waitFor(() => {
      expect(screen.getByText("DEMO-01")).toBeInTheDocument();
      expect(screen.getByText(/Serie de ejemplo/i)).toBeInTheDocument();
    });
  });

  it("3. Catálogo vacío: muestra mensaje claro de catálogo sin series configuradas", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { elementos: [] },
    });

    render(<SeccionClasificacionCCD expediente={mockExpedienteBase} consultarAlMontar={true} />, {
      wrapper: crearWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Catálogo vacío")).toBeInTheDocument();
      expect(screen.getByText("Catálogo CCD sin series configuradas")).toBeInTheDocument();
    });
  });

  it("4. Error del servicio: muestra mensaje de indisponibilidad con opción de reintentar", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(
      crearApiError(500, "Error interno en clasificador")
    );

    render(<SeccionClasificacionCCD expediente={mockExpedienteBase} consultarAlMontar={true} />, {
      wrapper: crearWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Servicio de Clasificación CCD no disponible")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Reintentar consulta" })).toBeInTheDocument();
    });
  });

  it("5. Respuesta no autorizada (403): informa que la cuenta carece de privilegios para el CCD", async () => {
    vi.spyOn(apiClient, "get").mockRejectedValueOnce(
      crearApiError(403, "No tiene privilegios")
    );

    render(<SeccionClasificacionCCD expediente={mockExpedienteBase} consultarAlMontar={true} />, {
      wrapper: crearWrapper(),
    });

    await waitFor(() => {
      expect(screen.getByText("Sin autorización")).toBeInTheDocument();
      expect(screen.getByText(/Su cuenta no dispone de los privilegios requeridos/i)).toBeInTheDocument();
    });
  });
});

describe("Fase 5: Pruebas de Control de Versiones Documentales", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("1. Expediente con versiones existentes: representa el historial completo y sus huellas SHA-256", () => {
    const versionesMock: VersionDocumento[] = [
      {
        versionId: "v2.0",
        numeroVersion: 2,
        estado: "VIGENTE",
        nombreArchivo: "informe_tecnico_v2.pdf",
        urlArchivo: "http://storage.sigd.edu.pe/v2.pdf",
        autorCambioId: "usr-2",
        autorCambioNombre: "Ing. Especialista",
        fechaRegistro: "2026-10-29T15:00:00Z",
        motivoModificacion: "Incorporación de observaciones",
        hashIntegridad: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      },
      {
        versionId: "v1.0",
        numeroVersion: 1,
        estado: "HISTORICA",
        nombreArchivo: "informe_tecnico_v1.pdf",
        urlArchivo: "http://storage.sigd.edu.pe/v1.pdf",
        autorCambioId: "usr-1",
        autorCambioNombre: "Mesa de Partes",
        fechaRegistro: "2026-10-29T10:00:00Z",
        motivoModificacion: "Versión original recepcionada",
        hashIntegridad: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
      },
    ];

    const expConVersiones: ExpedienteSGD = {
      id: "exp-v-01",
      codigoExpediente: "EXP-2026-000088",
      asunto: "Tramite con versiones documentales",
      solicitante: {
        tipoPersona: "NATURAL",
        tipoDocumento: "DNI",
        numeroDocumento: "12345678",
        nombreOrazonSocial: "Ana Torres",
        correoNotificacion: "ana@example.com",
        telefonoContacto: "987654321",
      },
      clasificacionCCD: {
        fondo: "IESTP_SUIZA",
        seccion: "SECRETARIA",
        serieDocumental: "SERIE_1",
        codigoSerie: "CCD-01",
      },
      metadatos: {
        tipoDocumentoPrincipal: "INFORME",
        palabrasClave: ["informe"],
        creadorId: "usr-1",
        creadorNombre: "Operador",
      },
      areaOrigen: "MESA_DE_PARTES",
      areaActual: "DIRECCION",
      estadoFlujo: "EN_PROCESO",
      prioridad: "NORMAL",
      fechaIngreso: "2026-10-29T10:00:00Z",
      fechaUltimoMovimiento: "2026-10-29T15:00:00Z",
      fechaLimiteAtencion: "2026-11-20T10:00:00Z",
      versionesDocumentos: versionesMock,
      cantidadFolios: 8,
    };

    render(<SeccionVersionesDocumentales expediente={expConVersiones} />, { wrapper: crearWrapper() });

    expect(screen.getByRole("heading", { name: "Control de Versiones" })).toBeInTheDocument();
    expect(screen.getByText("Versión 2.0")).toBeInTheDocument();
    expect(screen.getByText("Versión 1.0")).toBeInTheDocument();
    expect(screen.getByText("informe_tecnico_v2.pdf")).toBeInTheDocument();
  });

  it("2. Expediente sin documentos adjuntos: muestra estado 'Sin documentos adjuntos'", () => {
    render(<SeccionVersionesDocumentales expediente={mockExpedienteBase} />, {
      wrapper: crearWrapper(),
    });

    expect(screen.getByText("Sin documentos adjuntos")).toBeInTheDocument();
    expect(
      screen.getByText("El expediente no cuenta con documentos digitalizados adjuntos.")
    ).toBeInTheDocument();
  });

  it("3. Documento existente sin versiones adicionales: representa v1.0 (Vigente) y rango de folios", () => {
    const expConDocumento: ExpedienteDetalleRutaDoc = {
      ...mockExpedienteBase,
      documentos: [
        {
          idDocumento: "doc-uuid-001",
          nombre: "solicitud_estudios_2026.pdf",
          mimeType: "application/pdf",
          folioInicio: 1,
          folioFin: 3,
        },
      ],
    };

    render(<SeccionVersionesDocumentales expediente={expConDocumento} />, {
      wrapper: crearWrapper(),
    });

    expect(screen.getByText("1 documento vigente")).toBeInTheDocument();
    expect(screen.getByText("v1.0 (Vigente)")).toBeInTheDocument();
    expect(screen.getByText("solicitud_estudios_2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("Folios 1 a 3 (3 folios)")).toBeInTheDocument();
    expect(
      screen.getByText(/Documento en versión original de ingreso/i)
    ).toBeInTheDocument();
  });
});

describe("Fase 5: Pruebas de Integridad y Trazabilidad", () => {
  it("1. Visor de Foliado informa legítima ausencia de documentos PDF foliados", () => {
    render(<VisorPdfExpediente documentos={[]} estadoExpediente="REGISTRADO" />);
    expect(screen.getByRole("status")).toHaveTextContent("El expediente no tiene documentos PDF foliados.");
    expect(
      screen.getByText(/documentación física recibida se encuentra pendiente de digitalización/i)
    ).toBeInTheDocument();
  });

  it("2. ExpedienteTimeline informa legítima ausencia de movimientos en expediente recién registrado", () => {
    render(<ExpedienteTimeline eventos={[]} />);
    expect(
      screen.getByText("Este expediente todavía no registra movimientos en su bitácora.")
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Expediente registrado en Mesa de Partes. Pendiente de primera derivación/i)
    ).toBeInTheDocument();
  });
});
