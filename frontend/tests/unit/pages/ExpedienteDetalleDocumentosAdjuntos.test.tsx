import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ExpedienteDetallePage from "../../../src/pages/expedientes/ExpedienteDetallePage";
import { apiClient } from "../../../src/api/client";
import { useAuthStore } from "../../../src/stores/authStore";

const mockExpedienteId = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const mockDocId1 = "d1111111-1111-4111-8111-111111111111";
const mockDocId2 = "d2222222-2222-4222-8222-222222222222";

describe("SIGD 2026 — Mesa de Partes: Sección de Documentos Adjuntos, Preview y Descarga", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.restoreAllMocks();
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    useAuthStore.setState({
      accessToken: "token-mp",
      usuario: {
        id: "usr-mp",
        correo: "mesapartes@institucion.edu.pe",
        rol: "MESA_PARTES",
        nombreCompleto: "Operador de Mesa de Partes",
      },
      isAuthenticated: true,
    });
  });

  const renderPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={[`/expedientes/${mockExpedienteId}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );
  };

  it("1 & 2 & 7. expediente con 1 documento no foliado muestra sección, datos del archivo y no aparece como inexistente (Resumen: 1 documento, 0 folios)", async () => {
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000014",
              asunto: "Trámite de grado académico",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
              areaActualId: null,
              solicitanteId: "6c30a40b-d0d4-4b1b-9b68-75bb2f5827b3",
              resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 0, cantidadFoliados: 0 },
            },
            estado: "REGISTRADO",
            foliacionResumen: {
              cantidadDocumentos: 1,
              totalFolios: 0,
              cantidadFoliados: 0,
            },
            tupaResumen: null,
            documentos: [
              {
                idDocumento: mockDocId1,
                nombreArchivo: "S06_Enterprise_Secret_Management_Standards.pdf",
                tamanoBytes: 1810090,
                mimeType: "application/pdf",
                sha256: "222bf661e3dd784228f83914fae6bd65115da72342f62c9bd1c87a8237630a24",
                tipoDocumental: "Solicitud",
                creadoEn: "2026-10-28T20:38:45.653Z",
                foliado: false,
                folios: null,
              },
            ],
          },
        } as any;
      }
      return { data: {} } as any;
    });

    renderPage();

    // 1. Resumen general muestra 1 documento y 0 folios asignados
    expect(await screen.findByText(/1 documento, 0 folios asignados/i)).toBeInTheDocument();

    // 2. Sección Documentos adjuntos visible con badge de 1 documento
    expect(screen.getByRole("heading", { name: "Documentos adjuntos" })).toBeInTheDocument();
    expect(screen.getByText("S06_Enterprise_Secret_Management_Standards.pdf")).toBeInTheDocument();
    expect(screen.getByText("1.73 MB")).toBeInTheDocument();
    expect(screen.getByText("Sin foliar")).toBeInTheDocument();
    expect(screen.getByText(/Integridad verificada/i)).toBeInTheDocument();
    // Al pulsar Detalles técnicos se revela el hash SHA-256 completo
    fireEvent.click(screen.getByRole("button", { name: "Detalles técnicos" }));
    expect(screen.getByText(/222bf661e3dd784228f83914fae6bd65115da72342f62c9bd1c87a8237630a24/i)).toBeInTheDocument();

    // 3. Botones Ver PDF y Descargar disponibles
    expect(screen.getByRole("button", { name: "Ver PDF" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Descargar" })).toBeInTheDocument();
  });

  it("3. soporta múltiples documentos adjuntos (2 o más documentos)", async () => {
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000015",
              asunto: "Trámite con dos documentos",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
              resumenDocumentos: { cantidadDocumentos: 2, totalFolios: 4 },
            },
            estado: "REGISTRADO",
            foliacionResumen: { cantidadDocumentos: 2, totalFolios: 4 },
            documentos: [
              {
                idDocumento: mockDocId1,
                nombreArchivo: "solicitud_principal.pdf",
                tamanoBytes: 1048576,
                mimeType: "application/pdf",
                sha256: "a".repeat(64),
                tipoDocumental: "Solicitud",
                creadoEn: "2026-10-28T10:00:00Z",
                foliado: true,
                folios: "F. 0001 - F. 0002",
              },
              {
                idDocumento: mockDocId2,
                nombreArchivo: "anexo_sustento.pdf",
                tamanoBytes: 2097152,
                mimeType: "application/pdf",
                sha256: "b".repeat(64),
                tipoDocumental: "Anexo",
                creadoEn: "2026-10-28T10:05:00Z",
                foliado: true,
                folios: "F. 0003 - F. 0004",
              },
            ],
          },
        } as any;
      }
      return { data: {} } as any;
    });

    renderPage();

    expect(await screen.findByText("solicitud_principal.pdf")).toBeInTheDocument();
    expect(screen.getByText("anexo_sustento.pdf")).toBeInTheDocument();
    expect(screen.getByText("2 documentos")).toBeInTheDocument();
    expect(screen.getByText("Foliado (F. 0001 - F. 0002)")).toBeInTheDocument();
    expect(screen.getByText("Foliado (F. 0003 - F. 0004)")).toBeInTheDocument();
  });

  it("4. Ver PDF llama endpoint presigned bajo demanda y abre el modal visor", async () => {
    let endpointLlamado = false;
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000014",
              asunto: "Prueba preview",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
            },
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 0 },
            documentos: [
              {
                idDocumento: mockDocId1,
                nombreArchivo: "documento_preview.pdf",
                tamanoBytes: 500000,
                mimeType: "application/pdf",
                sha256: "c".repeat(64),
                tipoDocumental: "Solicitud",
                creadoEn: "2026-10-28T10:00:00Z",
                foliado: false,
                folios: null,
              },
            ],
          },
        } as any;
      }
      if (url.includes(`/documentos/${mockDocId1}/url-archivo`)) {
        endpointLlamado = true;
        return {
          data: {
            url: "http://127.0.0.1:9000/sigd-expedientes/expedientes/2026/preview.pdf?token=abc",
            downloadUrl: "http://127.0.0.1:9000/sigd-expedientes/expedientes/2026/preview.pdf?token=abc",
            nombreArchivo: "documento_preview.pdf",
            mimeType: "application/pdf",
            tamanoBytes: 500000,
            sha256: "c".repeat(64),
            expiraEnSegundos: 900,
          },
        } as any;
      }
      return { data: {} } as any;
    });

    renderPage();

    expect(await screen.findByText("documento_preview.pdf")).toBeInTheDocument();
    expect(endpointLlamado).toBe(false);

    // Al hacer clic en Ver PDF, se solicita URL presigned y se abre visor
    const botonVer = screen.getByRole("button", { name: "Ver PDF" });
    fireEvent.click(botonVer);

    await waitFor(() => {
      expect(endpointLlamado).toBe(true);
    });

    expect(await screen.findByRole("dialog", { name: "documento_preview.pdf" })).toBeInTheDocument();
    expect(screen.getByTitle("Visor de documento_preview.pdf")).toHaveAttribute(
      "src",
      "http://127.0.0.1:9000/sigd-expedientes/expedientes/2026/preview.pdf?token=abc"
    );

    // Botón Cerrar cierra el visor
    const botonCerrar = screen.getByRole("button", { name: "Cerrar visor PDF" });
    fireEvent.click(botonCerrar);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("5. Descargar llama endpoint bajo demanda y gatilla descarga del archivo", async () => {
    let descargaLlamada = false;
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000014",
              asunto: "Prueba descarga",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
            },
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 0 },
            documentos: [
              {
                idDocumento: mockDocId1,
                nombreArchivo: "descarga_test.pdf",
                tamanoBytes: 1000,
                mimeType: "application/pdf",
                sha256: "d".repeat(64),
                tipoDocumental: "Solicitud",
                creadoEn: "2026-10-28T10:00:00Z",
                foliado: false,
                folios: null,
              },
            ],
          },
        } as any;
      }
      if (url.includes(`/documentos/${mockDocId1}/url-archivo`)) {
        descargaLlamada = true;
        return {
          data: {
            url: "http://127.0.0.1:9000/sigd-expedientes/expedientes/2026/descarga.pdf?token=xyz",
            downloadUrl: "http://127.0.0.1:9000/sigd-expedientes/expedientes/2026/descarga.pdf?token=xyz",
            nombreArchivo: "descarga_test.pdf",
            mimeType: "application/pdf",
            tamanoBytes: 1000,
            sha256: "d".repeat(64),
            expiraEnSegundos: 900,
          },
        } as any;
      }
      return { data: {} } as any;
    });

    renderPage();

    expect(await screen.findByText("descarga_test.pdf")).toBeInTheDocument();
    expect(descargaLlamada).toBe(false);

    const botonDescargar = screen.getByRole("button", { name: "Descargar" });
    fireEvent.click(botonDescargar);

    await waitFor(() => {
      expect(descargaLlamada).toBe(true);
    });
  });

  it("6. sin documentos adjuntos muestra estado vacío informativo", async () => {
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000016",
              asunto: "Sin adjuntos",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
            },
            foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
            documentos: [],
          },
        } as any;
      }
      return { data: {} } as any;
    });

    renderPage();

    expect(await screen.findByText("0 documentos")).toBeInTheDocument();
    expect(
      screen.getByText("No se han registrado documentos adjuntos en este expediente.")
    ).toBeInTheDocument();
  });

  it("8. error de preview se muestra amigablemente sin romper la interfaz", async () => {
    vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
      if (url.includes(`/api/v1/expedientes/${mockExpedienteId}/resumen`)) {
        return {
          data: {
            expediente: {
              idExpediente: mockExpedienteId,
              cut: "EXP-2026-000014",
              asunto: "Error preview",
              fechaRadicacion: "2026-10-28T10:00:00Z",
              estadoActual: "REGISTRADO",
            },
            foliacionResumen: { cantidadDocumentos: 1, totalFolios: 0 },
            documentos: [
              {
                idDocumento: mockDocId1,
                nombreArchivo: "archivo_error.pdf",
                tamanoBytes: 50000,
                mimeType: "application/pdf",
                sha256: "e".repeat(64),
                tipoDocumental: "Solicitud",
                creadoEn: "2026-10-28T10:00:00Z",
                foliado: false,
                folios: null,
              },
            ],
          },
        } as any;
      }
      if (url.includes(`/documentos/${mockDocId1}/url-archivo`)) {
        throw new Error("El archivo físico no se encuentra disponible en el almacenamiento MinIO.");
      }
      return { data: {} } as any;
    });

    renderPage();

    expect(await screen.findByText("archivo_error.pdf")).toBeInTheDocument();

    const botonVer = screen.getByRole("button", { name: "Ver PDF" });
    fireEvent.click(botonVer);

    expect(
      await screen.findByText("El archivo físico no se encuentra disponible en el almacenamiento MinIO.")
    ).toBeInTheDocument();
  });
});
