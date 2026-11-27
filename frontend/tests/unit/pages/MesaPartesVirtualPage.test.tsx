import { webcrypto } from "node:crypto";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/api/client", () => ({
  apiClient: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

import { apiClient } from "@/api/client";
import MesaPartesVirtualPage from "../../../src/pages/tramite/MesaPartesVirtualPage";

const get = vi.mocked(apiClient.get);
const post = vi.mocked(apiClient.post);
const put = vi.mocked(apiClient.put);

function pdfFile() {
  return new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x30])],
    "solicitud.pdf",
    { type: "application/pdf" },
  );
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/tramite/mesa-partes-virtual"]}>
        <MesaPartesVirtualPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("MesaPartesVirtualPage — radicación real", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, "crypto", {
      value: webcrypto,
      configurable: true,
    });
    put.mockResolvedValue({ data: { confirmado: true } } as never);

    get.mockImplementation(async (url: string) => {
      if (url === "/api/v1/auth/me") {
        return {
          data: {
            idPersona: "00000000-0000-0000-0000-000000000011",
            correo: "admin.demo@iestpsuiza.edu.pe",
          },
        } as never;
      }
      if (url === "/api/v1/tramites/tipos") {
        return {
          data: [
            {
              id: "00000000-0000-0000-0000-000000000001",
              codigo: "TUPA-01",
              denominacion: "Constancia de estudios",
            },
          ],
        } as never;
      }
      throw new Error(`URL no esperada: ${url}`);
    });

    post.mockImplementation(async (url: string) => {
      if (url === "/api/v1/storage/presigned-url") {
        return {
          data: {
            uploadUrl: "https://storage.local/presigned",
            s3Key: "expedientes/2026/solicitud.pdf",
          },
        } as never;
      }
      if (url === "/api/v1/tramites/radicacion-virtual") {
        return {
          data: {
            cut: "EXP-2026-000001",
            fechaEnvioReal: "2026-11-24T18:00:00.000Z",
            fechaRadicacionLegal: "2026-11-24T13:00:00.000Z",
          },
        } as never;
      }
      throw new Error(`URL no esperada: ${url}`);
    });
  });

  it("carga la identidad del backend y el catálogo TUPA real", async () => {
    renderPage();

    await waitFor(() => {
      expect(get).toHaveBeenCalledWith("/api/v1/auth/me");
      expect(get).toHaveBeenCalledWith("/api/v1/tramites/tipos");
      expect(screen.getByDisplayValue("admin.demo@iestpsuiza.edu.pe")).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /TUPA-01/ })).toBeInTheDocument();
    });
  });

  it("calcula el hash real, transmite el PDF y radica con CUT del servidor", async () => {
    renderPage();
    const user = userEvent.setup();

    await waitFor(() =>
      expect(screen.getByRole("option", { name: /TUPA-01/ })).toBeInTheDocument()
    );

    await user.type(
      screen.getByPlaceholderText("Nombres y Apellidos del administrado"),
      "Ana Pérez",
    );
    await user.type(
      screen.getByPlaceholderText("Descripción detallada del trámite"),
      "Solicitud de constancia",
    );

    const inputArchivo = document.querySelector('input[type="file"]');
    expect(inputArchivo).not.toBeNull();
    fireEvent.change(inputArchivo as HTMLInputElement, {
      target: { files: [pdfFile()] },
    });

    await waitFor(() =>
      expect(screen.getByText(/^Archivo listo: solicitud.pdf$/)).toBeInTheDocument()
    );

    await user.click(
      screen.getByRole("button", { name: /Iniciar Carga Segura y Registrar Trámite/i }),
    );

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(
        "/api/v1/storage/upload-binario",
        expect.objectContaining({ name: "solicitud.pdf" }),
        expect.objectContaining({
          params: { s3Key: "expedientes/2026/solicitud.pdf" },
          headers: expect.objectContaining({
            "Content-Type": "application/pdf",
            "X-SHA256": expect.stringMatching(/^[0-9a-f]{64}$/),
          }),
        }),
      );
      expect(post).toHaveBeenCalledWith(
        "/api/v1/tramites/radicacion-virtual",
        expect.objectContaining({
          idPersona: "00000000-0000-0000-0000-000000000011",
          idTipoTramiteTupa: "00000000-0000-0000-0000-000000000001",
          documentos: [
            expect.objectContaining({
              storagePath: "expedientes/2026/solicitud.pdf",
              contentType: "application/pdf",
            }),
          ],
        }),
      );
      expect(screen.getByText(/EXP-2026-000001/)).toBeInTheDocument();
    });
  });

  it("muestra error si no se puede cargar la identidad", async () => {
    get.mockImplementation(async () => {
      throw new Error("401");
    });
    renderPage();

    await waitFor(() =>
      expect(
        screen.getByText(/Inicie sesión para radicar un trámite/i),
      ).toBeInTheDocument()
    );
  });
});
