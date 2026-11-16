import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";
import DigitalizacionModal from "../../../src/components/expedientes/DigitalizacionModal";
import * as digitalizacionApi from "../../../src/api/digitalizacionApi";
import type { ExpedienteDetalleRutaDoc } from "../../../src/types/expediente";
import { ApiHttpError } from "../../../src/types/api";

// Mock de FileUploadDropzone para aislar las pruebas del modal
vi.mock("../../../src/components/common/FileUploadDropzone", () => ({
  default: ({
    onStatusChange,
    onUploaded,
  }: {
    onStatusChange?: (status: string) => void;
    onUploaded?: (file: { file: File; sha256: string; s3Key: string }) => void;
  }) => (
    <div data-testid="mock-dropzone">
      <button
        type="button"
        onClick={() => {
          onStatusChange?.("success");
          onUploaded?.({
            file: new File(["%PDF-1.4 contenido de prueba"], "documento_escaneado.pdf", {
              type: "application/pdf",
            }),
            sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
            s3Key: "expedientes/2026/11111111-2222-3333-4444-555555555555.pdf",
          });
        }}
      >
        Simular Carga Exitosa
      </button>
    </div>
  ),
}));

function crearWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

const mockExpediente: ExpedienteDetalleRutaDoc = {
  idExpediente: "cad71708-e867-42ce-86ac-a005915d257c",
  cut: "EXP-2026-000019",
  asunto: "Solicitud presencial para verificación de cargo CUT",
  fechaRadicacion: "2026-10-29T18:18:22.450Z",
  estadoActual: "REGISTRADO",
  areaActualId: "a1a3a496-ff7f-45d8-b63c-3e54fcf79de1",
  solicitanteId: "00000000-0000-0000-0000-000000000050",
  resumenDocumentos: { cantidadDocumentos: 0, totalFolios: 0 },
  documentos: [],
  ultimoMovimiento: null,
  sla: null,
};

describe("DigitalizacionModal (Componente de carga documental posterior)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("no renderiza nada si abierto es false", () => {
    const { container } = render(
      <DigitalizacionModal
        expediente={mockExpediente}
        abierto={false}
        onCerrar={vi.fn()}
      />,
      { wrapper: crearWrapper() }
    );
    expect(container.firstChild).toBeNull();
  });

  it("renderiza el modal accesible con los datos del expediente al estar abierto", () => {
    render(
      <DigitalizacionModal
        expediente={mockExpediente}
        abierto={true}
        onCerrar={vi.fn()}
      />,
      { wrapper: crearWrapper() }
    );

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Digitalización y Foliación Documental" })
    ).toBeInTheDocument();
    expect(screen.getAllByText("EXP-2026-000019").length).toBeGreaterThanOrEqual(1);
    expect(
      screen.getByText("Solicitud presencial para verificación de cargo CUT")
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Cantidad de folios/i)).toHaveValue(1);
    expect(
      screen.getByRole("button", { name: /Confirmar e Incorporar al Expediente/i })
    ).toBeDisabled();
  });

  it("invoca onCerrar al presionar el botón Cancelar", () => {
    const onCerrar = vi.fn();
    render(
      <DigitalizacionModal
        expediente={mockExpediente}
        abierto={true}
        onCerrar={onCerrar}
      />,
      { wrapper: crearWrapper() }
    );

    fireEvent.click(screen.getByRole("button", { name: "Cancelar" }));
    expect(onCerrar).toHaveBeenCalledTimes(1);
  });

  it("habilita el botón de confirmar tras subir el PDF y procesa la vinculación exitosa", async () => {
    const mockRespuesta: digitalizacionApi.DigitalizacionResponse = {
      documentoId: "doc-uuid-999",
      expedienteId: "cad71708-e867-42ce-86ac-a005915d257c",
      nombreArchivo: "documento_escaneado.pdf",
      folios: {
        folioInicio: 1,
        folioFin: 3,
        cantidad: 3,
      },
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      s3Bucket: "sigd-sandbox-e2e",
      s3Key: "expedientes/2026/11111111-2222-3333-4444-555555555555.pdf",
      creadoEn: "2026-10-29T20:30:00.000Z",
    };

    const spyAdjuntar = vi
      .spyOn(digitalizacionApi, "adjuntarDocumentoDigitalizado")
      .mockResolvedValueOnce(mockRespuesta);

    const onExito = vi.fn();

    render(
      <DigitalizacionModal
        expediente={mockExpediente}
        abierto={true}
        onCerrar={vi.fn()}
        onExito={onExito}
      />,
      { wrapper: crearWrapper() }
    );

    // Cambiar folios a 3
    const inputFolios = screen.getByLabelText(/Cantidad de folios/i);
    fireEvent.change(inputFolios, { target: { value: "3" } });
    expect(inputFolios).toHaveValue(3);

    // Simular subida en Dropzone
    fireEvent.click(screen.getByText("Simular Carga Exitosa"));

    // El botón debe habilitarse
    const botonConfirmar = screen.getByRole("button", {
      name: /Confirmar e Incorporar al Expediente/i,
    });
    expect(botonConfirmar).not.toBeDisabled();

    // Confirmar
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(spyAdjuntar).toHaveBeenCalledWith("cad71708-e867-42ce-86ac-a005915d257c", {
        nombreArchivo: "documento_escaneado.pdf",
        tamanoBytes: expect.any(Number),
        mimeType: "application/pdf",
        sha256Hash: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
        storagePath: "expedientes/2026/11111111-2222-3333-4444-555555555555.pdf",
        folios: 3,
      });
      expect(onExito).toHaveBeenCalledWith(mockRespuesta);
      expect(
        screen.getByText("¡Digitalización e incorporación completada!")
      ).toBeInTheDocument();
      expect(screen.getByText("F. 0001 a F. 0003 (3 folios)")).toBeInTheDocument();
    });
  });

  it("muestra alerta de error si el endpoint devuelve un fallo", async () => {
    vi.spyOn(digitalizacionApi, "adjuntarDocumentoDigitalizado").mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Conflict",
        status: 409,
        detail: "Este documento PDF ya se encuentra registrado en el expediente.",
        instance: "/api/v1/expedientes/cad71708/documentos",
        code: "DOCUMENTO_YA_ADJUNTO",
        category: "System",
        correlationId: "corr-123",
        retryable: false,
      })
    );

    render(
      <DigitalizacionModal
        expediente={mockExpediente}
        abierto={true}
        onCerrar={vi.fn()}
      />,
      { wrapper: crearWrapper() }
    );

    fireEvent.click(screen.getByText("Simular Carga Exitosa"));
    fireEvent.click(
      screen.getByRole("button", { name: /Confirmar e Incorporar al Expediente/i })
    );

    await waitFor(() => {
      expect(
        screen.getByText(
          "Este documento PDF ya se encuentra registrado en el expediente."
        )
      ).toBeInTheDocument();
    });
  });
});
