import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../src/api/client", () => ({
  apiClient: { get: vi.fn() },
}));

import { apiClient } from "../../../src/api/client";
import ConsultaPublicaPage from "../../../src/pages/tramite/ConsultaPublicaPage";

const get = vi.mocked(apiClient.get);

describe("ConsultaPublicaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra el expediente encontrado para el CUT de la ruta", async () => {
    get.mockResolvedValue({
      data: {
        cut: "EXP-2026-000006",
        anioFiscal: 2026,
        estadoTramite: "REGISTRADO",
        tipoTramite: "Emisión de Certificado de Estudios Oficial",
        asunto: "Certificado de estudios",
        fechaEnvioReal: "2026-11-25T13:00:00.000Z",
        fechaRadicacionLegal: "2026-11-25T13:00:00.000Z",
        fueraDeHorario: false,
        canalRecepcion: "MESA_VIRTUAL",
        totalFolios: 1,
        administrado: {
          documentoEnmascarado: "45***315",
          nombreEnmascarado: "A** Q***** R****",
        },
        documentos: [
          {
            nombreArchivo: "solicitud.pdf",
            contentType: "application/pdf",
            hashSha256: "abc123def456",
          },
        ],
        proveidos: [],
        mensajeLegal: "Información pública.",
      },
    } as never);

    render(
      <MemoryRouter initialEntries={["/consulta/EXP-2026-000006"]}>
        <Routes>
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() =>
      expect(screen.getByText("Expediente Encontrado")).toBeInTheDocument(),
    );
    expect(get).toHaveBeenCalledWith(
      "/api/v1/tramites/consulta-publica/EXP-2026-000006",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.getByText("EXP-2026-000006")).toBeInTheDocument();
    expect(screen.getByText("Certificado de estudios")).toBeInTheDocument();
  });
});
