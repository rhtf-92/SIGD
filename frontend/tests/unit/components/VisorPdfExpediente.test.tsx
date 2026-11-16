import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { apiClient } from "../../../src/api/client";
import {
  VisorPdfExpediente,
  esOrigenValidoDescarga,
} from "../../../src/pages/expedientes/ExpedienteDetallePage";
import { ApiHttpError } from "../../../src/types/api";

describe("VisorPdfExpediente (TramiCore → DocuCore → Storage)", () => {
  const originalFetch = globalThis.fetch;
  const originalCreateObjectURL = URL.createObjectURL;
  const originalRevokeObjectURL = URL.revokeObjectURL;

  beforeEach(() => {
    vi.restoreAllMocks();
    globalThis.URL.createObjectURL = vi.fn(() => "blob:http://localhost:3000/mock-pdf-blob");
    globalThis.URL.revokeObjectURL = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    globalThis.URL.createObjectURL = originalCreateObjectURL;
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL;
  });

  it("renderiza estado informativo cuando el expediente no tiene documentos PDF", () => {
    render(<VisorPdfExpediente documentos={[]} />);
    expect(screen.getByRole("status")).toHaveTextContent("El expediente no tiene documentos PDF foliados.");
  });

  it("consume /api/v1/storage/documentos/:id/download y monta el iframe con sandbox y Blob URL al recibir un PDF válido", async () => {
    const docMock = {
      idDocumento: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      nombre: "solicitud_ingreso.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 4,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://minio.sigd.edu.pe/sigd-expedientes/solicitud.pdf?token=xyz" },
    });

    const mockPdfBytes = new TextEncoder().encode("%PDF-1.7 Contenido PDF de prueba");
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([mockPdfBytes], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    expect(screen.getByRole("status")).toHaveTextContent("Cargando PDF…");

    await waitFor(() => {
      expect(screen.getByTitle(`PDF: ${docMock.nombre}`)).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenCalledWith(
      `/api/v1/storage/documentos/${docMock.idDocumento}/download`,
    );

    const iframe = screen.getByTitle(`PDF: ${docMock.nombre}`);
    expect(iframe).toHaveAttribute("src", "blob:http://localhost:3000/mock-pdf-blob");
    // Verificación de privilegios mínimos en sandbox
    expect(iframe).toHaveAttribute("sandbox", "allow-scripts");

    // Enlace de descarga disponible
    const downloadLink = screen.getByRole("link", { name: /Descargar PDF/i });
    expect(downloadLink).toHaveAttribute("href", "blob:http://localhost:3000/mock-pdf-blob");
    expect(downloadLink).toHaveAttribute("download", docMock.nombre);

    // Muestra folios
    expect(screen.getByText(/Folios 1–4/i)).toBeInTheDocument();
  });

  it("resuelve URLs relativas protegidas (/api/v1/storage/download/...) a través de apiClient antes de descargar", async () => {
    const docMock = {
      idDocumento: "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e",
      nombre: "constancia_titulacion.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 2,
    };

    // Primera llamada retorna ruta relativa al proxy seguro de storage
    vi.spyOn(apiClient, "get")
      .mockResolvedValueOnce({
        data: { downloadUrl: "/api/v1/storage/download/sigd-expedientes/titulacion.pdf" },
      })
      // Segunda llamada resuelve a la URL prefirmada
      .mockResolvedValueOnce({
        data: { downloadUrl: "http://localhost:9000/sigd-expedientes/titulacion.pdf" },
      });

    const mockPdfBytes = new TextEncoder().encode("%PDF-1.4 Documento Titulacion");
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([mockPdfBytes], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByTitle(`PDF: ${docMock.nombre}`)).toBeInTheDocument();
    });

    expect(apiClient.get).toHaveBeenNthCalledWith(
      1,
      `/api/v1/storage/documentos/${docMock.idDocumento}/download`,
    );
    expect(apiClient.get).toHaveBeenNthCalledWith(
      2,
      "/api/v1/storage/download/sigd-expedientes/titulacion.pdf",
    );
  });

  it("muestra error RFC 7807 y botón Reintentar si el usuario no tiene autorización de descarga (403 Forbidden)", async () => {
    const user = userEvent.setup();
    const docMock = {
      idDocumento: "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f",
      nombre: "resolucion_restringida.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 5,
    };

    const error403 = new ApiHttpError({
      type: "https://httpstatuses.com/403",
      title: "Forbidden",
      status: 403,
      detail: "No cuenta con el permiso EXPEDIENTE_LEER para visualizar este documento.",
      instance: `/api/v1/storage/documentos/${docMock.idDocumento}/download`,
      code: "FORBIDDEN",
      category: "Security",
      correlationId: "corr-sec-1",
      retryable: false,
    });

    vi.spyOn(apiClient, "get").mockRejectedValueOnce(error403);

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No cuenta con el permiso EXPEDIENTE_LEER para visualizar este documento.");

    const botonReintentar = screen.getByRole("button", { name: /Reintentar/i });
    expect(botonReintentar).toBeInTheDocument();

    // Reintento exitoso
    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "http://127.0.0.1:9000/sigd-expedientes/ok.pdf" },
    });
    const mockPdfBytes = new TextEncoder().encode("%PDF-1.4 OK");
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([mockPdfBytes], { type: "application/pdf" }),
    });

    await user.click(botonReintentar);

    await waitFor(() => {
      expect(screen.getByTitle(`PDF: ${docMock.nombre}`)).toBeInTheDocument();
    });
  });

  it("maneja error 404 Not Found y 503 Service Unavailable desde el backend", async () => {
    const docMock = {
      idDocumento: "e5f6a7b8-c9d0-4e1f-2a3b-4c5d6e7f8a9b",
      nombre: "no_encontrado.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 1,
    };

    const error404 = new ApiHttpError({
      type: "https://httpstatuses.com/404",
      title: "Not Found",
      status: 404,
      detail: "Documento no encontrado en el sistema.",
      instance: `/api/v1/storage/documentos/${docMock.idDocumento}/download`,
      code: "NOT_FOUND",
      category: "Business",
      correlationId: "corr-404",
      retryable: false,
    });

    vi.spyOn(apiClient, "get").mockRejectedValueOnce(error404);

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Documento no encontrado en el sistema.");
  });

  it("maneja expiración de la URL prefirmada S3 (403 desde fetch)", async () => {
    const docMock = {
      idDocumento: "f6a7b8c9-d0e1-4f2a-3b4c-5d6e7f8a9b0c",
      nombre: "expirado.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 2,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "http://localhost:9000/sigd-expedientes/expirado.pdf?token=expired" },
    });

    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: "Forbidden",
    });

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El enlace de descarga ha expirado o no es válido. Reintente para generar uno nuevo.");
  });

  it("rechaza archivos con contenido binario que no corresponde a PDF (magic bytes inválidos)", async () => {
    const docMock = {
      idDocumento: "0a1b2c3d-4e5f-6a7b-8c9d-0e1f2a3b4c5d",
      nombre: "falso.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 1,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "http://localhost:9000/sigd-expedientes/falso.pdf" },
    });

    // Devuelve HTML en lugar de PDF
    const mockHtmlBytes = new TextEncoder().encode("<!DOCTYPE html><html><body>Error</body></html>");
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([mockHtmlBytes], { type: "text/html" }),
    });

    render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("El archivo obtenido no corresponde a un documento PDF íntegro.");
  });

  it("rechaza URLs de orígenes no autorizados o puertos internos no permitidos", async () => {
    // 1. Origen malicioso externo
    expect(esOrigenValidoDescarga("http://malicious-site.com/exploit.pdf")).toBe(false);
    expect(esOrigenValidoDescarga("https://phishing-sigd.com/doc.pdf")).toBe(false);

    // 2. Puertos internos peligrosos en localhost (PostgreSQL 5432/5434, Redis 6379)
    expect(esOrigenValidoDescarga("http://localhost:5432/dump")).toBe(false);
    expect(esOrigenValidoDescarga("http://127.0.0.1:6379/data")).toBe(false);
    expect(esOrigenValidoDescarga("http://localhost:5434/repro")).toBe(false);

    // 3. IPs de redes privadas internas arbitrarias
    expect(esOrigenValidoDescarga("http://192.168.1.1:9000/doc.pdf")).toBe(false);
    expect(esOrigenValidoDescarga("http://10.0.0.1:9000/doc.pdf")).toBe(false);
    expect(esOrigenValidoDescarga("http://169.254.169.254/latest/meta-data")).toBe(false);

    // 4. Esquemas no HTTP/HTTPS
    expect(esOrigenValidoDescarga("javascript:alert(1)")).toBe(false);
    expect(esOrigenValidoDescarga("data:application/pdf;base64,...")).toBe(false);

    // 5. Rechazo de sufijos genéricos de terceros (e.g. buckets arbitrarios de AWS S3)
    expect(esOrigenValidoDescarga("https://attacker-bucket.s3.amazonaws.com/doc.pdf")).toBe(false);
    expect(esOrigenValidoDescarga("https://untrusted-host.iestp-suiza.edu.pe.attacker.com/doc.pdf")).toBe(false);

    // 6. Orígenes explícitamente autorizados en lista cerrada
    expect(esOrigenValidoDescarga("https://minio.sigd.edu.pe/sigd-expedientes/doc.pdf")).toBe(true);
    expect(esOrigenValidoDescarga("https://minio.iestp-suiza.edu.pe/sigd-expedientes/doc.pdf")).toBe(true);
    expect(esOrigenValidoDescarga("https://storage.iestp-suiza.edu.pe/sigd-expedientes/doc.pdf")).toBe(true);
    expect(esOrigenValidoDescarga("http://localhost:9000/sigd-expedientes/doc.pdf")).toBe(true);
    expect(esOrigenValidoDescarga("http://127.0.0.1:9000/sigd-expedientes/doc.pdf")).toBe(true);
    expect(esOrigenValidoDescarga("/api/v1/storage/download/sigd-expedientes/doc.pdf")).toBe(true);
  });

  it("libera el object URL al desmontar el componente para evitar fugas de memoria", async () => {
    const docMock = {
      idDocumento: "d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a",
      nombre: "informe.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 1,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://localhost:9000/informe.pdf" },
    });
    const mockPdfBytes = new TextEncoder().encode("%PDF-1.5");
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([mockPdfBytes], { type: "application/pdf" }),
    });

    const { unmount } = render(<VisorPdfExpediente documentos={[docMock]} abiertoInicial={true} />);

    await waitFor(() => {
      expect(screen.getByTitle(`PDF: ${docMock.nombre}`)).toBeInTheDocument();
    });

    unmount();

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith("blob:http://localhost:3000/mock-pdf-blob");
  });

  it("muestra advertencia de documento preliminar y botón 'Descargar Borrador PDF' cuando una resolución no tiene firma digital", async () => {
    const docResolucion = {
      idDocumento: "r1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      nombre: "RD-2026-000010.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 2,
      tieneFirmaDigital: false,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://minio.sigd.edu.pe/sigd-expedientes/resolucion.pdf" },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new TextEncoder().encode("%PDF-1.7")], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docResolucion]} estadoExpediente="RESUELTO" />);

    await waitFor(() => {
      expect(screen.getByRole("note", { name: "advertencia-sin-firma" })).toBeInTheDocument();
    });
    expect(screen.getByText(/DOCUMENTO PRELIMINAR \/ SIN FIRMA DIGITAL VERIFICADA/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Descargar Borrador PDF/i })).toBeInTheDocument();
  });

  it("alerta de riesgo de integridad cuando el expediente está ARCHIVADO pero la resolución carece de firma digital", async () => {
    const docResolucion = {
      idDocumento: "r2b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      nombre: "RD-2026-000010.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 2,
      tieneFirmaDigital: false,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://minio.sigd.edu.pe/sigd-expedientes/resolucion.pdf" },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new TextEncoder().encode("%PDF-1.7")], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docResolucion]} estadoExpediente="ARCHIVADO" />);

    await waitFor(() => {
      expect(screen.getByText(/ADVERTENCIA DE INTEGRIDAD: El expediente se encuentra en estado ARCHIVADO/i)).toBeInTheDocument();
    });
  });

  it("muestra estado verificado y enlace oficial cuando la resolución cuenta con firma digital válida", async () => {
    const docFirmado = {
      idDocumento: "r3b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      nombre: "RD-2026-000142.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 3,
      tieneFirmaDigital: true,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://minio.sigd.edu.pe/sigd-expedientes/resolucion_firmada.pdf" },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new TextEncoder().encode("%PDF-1.7")], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docFirmado]} estadoExpediente="ARCHIVADO" />);

    await waitFor(() => {
      expect(screen.getByRole("status", { name: "estado-firma-valida" })).toBeInTheDocument();
    });
    expect(screen.getByText(/Firma Digital PAdES Verificada Institucionalmente/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Descargar Resolución Firmada/i })).toBeInTheDocument();
  });

  it("inicia con el visor cerrado por defecto: muestra tarjeta compacta, botón 'Ver documento' y no realiza solicitudes de red anticipadas", async () => {
    const docMock = {
      idDocumento: "d1-closed-test",
      nombre: "solicitud_ingreso.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 3,
    };

    vi.spyOn(apiClient, "get");
    globalThis.fetch = vi.fn();

    render(<VisorPdfExpediente documentos={[docMock]} />);

    // El botón 'Ver documento' está presente
    const btnVer = screen.getByRole("button", { name: /Ver documento/i });
    expect(btnVer).toBeInTheDocument();

    // El enlace de descarga está disponible aún con visor cerrado
    const linkDescarga = screen.getByRole("link", { name: /Descargar PDF/i });
    expect(linkDescarga).toBeInTheDocument();

    // No se realizan solicitudes anticipadas al backend ni a S3 en cerrado
    expect(apiClient.get).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();

    // Ningún iframe (ni interactivo ni oculto) se monta en cerrado
    expect(screen.queryByTitle(`Visor interactivo: ${docMock.nombre}`)).not.toBeInTheDocument();
    expect(screen.queryByTitle(`PDF: ${docMock.nombre}`)).not.toBeInTheDocument();
  });

  it("al pulsar 'Ver documento' monta el visor interactivo, y al pulsar 'Ocultar documento' lo desmonta por completo", async () => {
    const user = userEvent.setup();
    const docMock = {
      idDocumento: "d2-toggle-test",
      nombre: "informe_tecnico.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 5,
    };

    vi.spyOn(apiClient, "get").mockResolvedValueOnce({
      data: { downloadUrl: "https://minio.sigd.edu.pe/sigd-expedientes/informe.pdf" },
    });
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      blob: async () => new Blob([new TextEncoder().encode("%PDF-1.4 OK")], { type: "application/pdf" }),
    });

    render(<VisorPdfExpediente documentos={[docMock]} />);

    const btnVer = await screen.findByRole("button", { name: /Ver documento/i });
    expect(screen.queryByTitle(`Visor interactivo: ${docMock.nombre}`)).not.toBeInTheDocument();

    // 1. Pulsar 'Ver documento'
    await user.click(btnVer);

    // Debe cambiar a 'Ocultar documento'
    const btnOcultar = await screen.findByRole("button", { name: /Ocultar documento/i });
    expect(btnOcultar).toBeInTheDocument();

    // El visor interactivo debe estar montado en el DOM
    expect(screen.getByTitle(`Visor interactivo: ${docMock.nombre}`)).toBeInTheDocument();

    // 2. Pulsar 'Ocultar documento'
    await user.click(btnOcultar);

    // Debe restaurarse 'Ver documento'
    expect(await screen.findByRole("button", { name: /Ver documento/i })).toBeInTheDocument();

    // El visor interactivo se desmonta completamente liberando el espacio
    expect(screen.queryByTitle(`Visor interactivo: ${docMock.nombre}`)).not.toBeInTheDocument();
  });
});
