import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConsultaPublicaPage, {
  InsigniaEstadoTramite,
  LineaTiempoExpediente,
  type DtoConsultaPublica,
} from "./ConsultaPublicaPage";

vi.mock("../../api/client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from "../../api/client";

describe("LineaTiempoExpediente y ConsultaPublicaPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("ordena cronológicamente los eventos en la lista ordenada (<ol>): envío, radicación y proveídos", () => {
    // Proveídos en orden inverso para verificar que el componente los ordene cronológicamente
    const proveidos = [
      {
        numero: "002-2026",
        fechaEmision: "2026-03-26",
        resumen: "Emisión de informe final de procedencia",
      },
      {
        numero: "001-2026",
        fechaEmision: "2026-03-25",
        resumen: "Derivación a coordinación académica",
      },
    ];

    const { container } = render(
      <LineaTiempoExpediente
        fechaEnvioReal="2026-03-24T08:15:00.000Z"
        fechaRadicacionLegal="2026-03-24T09:30:00.000Z"
        proveidos={proveidos}
      />,
    );

    const ol = screen.getByRole("list");
    expect(ol).toBeInTheDocument();
    expect(ol.tagName.toLowerCase()).toBe("ol");

    const items = container.querySelectorAll("ol > li");
    expect(items).toHaveLength(4);

    // 1. Envío (24 de marzo 08:15)
    expect(items[0]).toHaveTextContent(/envío/i);
    // 2. Radicación Legal (24 de marzo 09:30)
    expect(items[1]).toHaveTextContent(/radicación legal/i);
    // 3. Proveído 001-2026 (25 de marzo)
    expect(items[2]).toHaveTextContent(/proveído 001-2026/i);
    expect(items[2]).toHaveTextContent(/coordinación académica/i);
    // 4. Proveído 002-2026 (26 de marzo)
    expect(items[3]).toHaveTextContent(/proveído 002-2026/i);
    expect(items[3]).toHaveTextContent(/informe final/i);
  });

  it("omite pasos que no cuentan con fecha registrada (fecha faltante omitida sin inventar datos)", () => {
    const proveidos = [
      {
        numero: "001-2026",
        fechaEmision: "2026-03-25",
        resumen: "Pase a Dirección",
      },
      {
        numero: "002-2026",
        fechaEmision: "", // Fecha vacía: debe ser omitido
        resumen: "Borrador de proveído sin emisión formal",
      },
    ];

    const { container } = render(
      <LineaTiempoExpediente
        fechaEnvioReal="2026-03-24T08:00:00.000Z"
        fechaRadicacionLegal={null} // Fecha faltante: debe ser omitido
        proveidos={proveidos}
      />,
    );

    const items = container.querySelectorAll("ol > li");
    expect(items).toHaveLength(2);

    // Envío y Proveído 001 deben existir
    expect(screen.getByText(/envío/i)).toBeInTheDocument();
    expect(screen.getByText(/proveído 001-2026/i)).toBeInTheDocument();

    // Radicación legal y Proveído 002 omitidos
    expect(screen.queryByText(/radicación legal/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/proveído 002-2026/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/borrador de proveído sin emisión/i)).not.toBeInTheDocument();
  });

  it("muestra la insignia del estado actual con color y texto explícito (no solo color)", () => {
    const { rerender } = render(<InsigniaEstadoTramite estado="REGISTRADO" />);

    const badge = screen.getByRole("status");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent("REGISTRADO");
    expect(badge).toHaveClass("text-blue-900", "bg-blue-100");

    // Probar otro estado normativo
    rerender(<InsigniaEstadoTramite estado="OBSERVADO" />);
    expect(screen.getByRole("status")).toHaveTextContent("OBSERVADO");
    expect(screen.getByRole("status")).toHaveClass("text-amber-900", "bg-amber-100");

    // Probar estado en trámite
    rerender(<InsigniaEstadoTramite estado="EN_TRAMITE" />);
    expect(screen.getByRole("status")).toHaveTextContent("EN_TRAMITE");
    expect(screen.getByRole("status")).toHaveClass("text-indigo-900", "bg-indigo-100");
  });

  it("ConsultaPublicaPage integra el estado visible y la línea de tiempo cronológica al consultar un CUT", async () => {
    const mockExpediente: DtoConsultaPublica = {
      cut: "EXP-2026-000104",
      anioFiscal: 2026,
      estadoTramite: "REGISTRADO",
      tipoTramite: "Certificado Modular",
      asunto: "Solicitud de Certificación",
      fechaEnvioReal: "2026-03-24T08:00:00.000Z",
      fechaRadicacionLegal: "2026-03-24T09:00:00.000Z",
      fueraDeHorario: false,
      canalRecepcion: "MESA_PARTES_VIRTUAL",
      totalFolios: 8,
      administrado: {
        documentoEnmascarado: "45***123",
        nombreEnmascarado: "J*** P*** S***",
      },
      documentos: [
        {
          nombreArchivo: "solicitud_firmada.pdf",
          contentType: "application/pdf",
          hashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
        },
      ],
      proveidos: [
        {
          numero: "001-2026-DIR",
          fechaEmision: "2026-03-25",
          resumen: "Pase a Dirección Académica",
        },
      ],
      mensajeLegal: "Información pública pursuant a la Ley N° 29733.",
    };

    vi.mocked(apiClient.get).mockResolvedValue({ data: mockExpediente });

    render(
      <MemoryRouter initialEntries={["/consulta/EXP-2026-000104"]}>
        <Routes>
          <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
        </Routes>
      </MemoryRouter>,
    );

    // Esperar a que cargue la información del expediente
    await waitFor(() => {
      expect(screen.getByText("EXP-2026-000104")).toBeInTheDocument();
    });

    // Insignia de estado visible con texto
    const statusBadge = screen.getByRole("status");
    expect(statusBadge).toHaveTextContent("REGISTRADO");
    expect(statusBadge).toHaveClass("text-blue-900");

    // Folios mostrados
    expect(screen.getByText("8")).toBeInTheDocument();

    // Documento adjunto
    expect(screen.getByText("solicitud_firmada.pdf")).toBeInTheDocument();

    // Lista ordenada (<ol>) de la línea de tiempo
    const timelineList = screen.getByRole("list", {
      name: /línea de tiempo del expediente/i,
    });
    expect(timelineList.tagName.toLowerCase()).toBe("ol");

    // Pasos cronológicos dentro de la línea de tiempo
    expect(within(timelineList).getByText(/envío del trámite/i)).toBeInTheDocument();
    expect(within(timelineList).getByText(/radicación legal/i)).toBeInTheDocument();
    expect(within(timelineList).getByText(/proveído 001-2026-DIR/i)).toBeInTheDocument();
  });
});
