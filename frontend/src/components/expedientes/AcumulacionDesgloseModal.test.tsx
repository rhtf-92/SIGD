import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DesacumulacionModal from "./DesacumulacionModal";
import DesgloseModal from "./DesgloseModal";
import type { ItemAcumulacion, DocumentoAdjuntoRutaDoc } from "../../types/expediente";

// Mock client
vi.mock("../../api/client", () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: { ok: true, mensaje: "Operación completada exitosamente." } }),
  },
}));

describe("DesacumulacionModal", () => {
  const mockAcumulacion: ItemAcumulacion = {
    id_acumulacion: "acum-001",
    expediente_principal_id: "exp-principal-1",
    principal_codigo: "EXP-2026-000100",
    expediente_accesorio_id: "exp-accesorio-2",
    accesorio_codigo: "EXP-2026-000105",
    acto_resolutivo: "R.D. N° 012-2026",
    estado: "ACUMULADO",
    fecha_acumulacion: "2026-11-18T10:00:00Z",
    rol_en_acumulacion: "PRINCIPAL",
  };

  it("renderiza correctamente los datos de la relación a desacumular", () => {
    render(
      <DesacumulacionModal
        open={true}
        onClose={vi.fn()}
        acumulacion={mockAcumulacion}
        onExito={vi.fn()}
      />
    );

    expect(screen.getByText("Desacumular expediente conexo")).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000100")).toBeInTheDocument();
    expect(screen.getByText("EXP-2026-000105")).toBeInTheDocument();
  });

  it("exige acto administrativo y motivo antes de confirmar", async () => {
    const user = userEvent.setup();
    render(
      <DesacumulacionModal
        open={true}
        onClose={vi.fn()}
        acumulacion={mockAcumulacion}
        onExito={vi.fn()}
      />
    );

    const btnSubmit = screen.getByRole("button", { name: /Revisar desacumulación/i });
    await user.click(btnSubmit);

    expect(screen.getByText(/Debe especificar el acto administrativo/i)).toBeInTheDocument();
  });
});

describe("DesgloseModal", () => {
  const mockDocumentos: DocumentoAdjuntoRutaDoc[] = [
    {
      idDocumento: "doc-1",
      nombre: "Certificado_Estudios_Original.pdf",
      mimeType: "application/pdf",
      folioInicio: 5,
      folioFin: 8,
      desglosado: false,
    },
    {
      idDocumento: "doc-2",
      nombre: "Titulo_Profesional_Antiguo.pdf",
      mimeType: "application/pdf",
      folioInicio: 9,
      folioFin: 10,
      desglosado: true, // ya desglosado
    },
  ];

  it("filtra documentos ya desglosados y muestra rango de folios del documento activo", () => {
    render(
      <DesgloseModal
        open={true}
        onClose={vi.fn()}
        expedienteId="exp-1"
        codigoCut="EXP-2026-000100"
        documentos={mockDocumentos}
        onExito={vi.fn()}
      />
    );

    expect(screen.getByText(/Desglose documental \(Art. 170 LPAG\)/i)).toBeInTheDocument();
    expect(screen.getByText(/Certificado_Estudios_Original.pdf/i)).toBeInTheDocument();
    // Doc 2 está desglosado, no debe estar elegible en el select
    expect(screen.queryByText(/Titulo_Profesional_Antiguo.pdf \(Folios 9/i)).not.toBeInTheDocument();
    // Muestra fojas afectadas: 8 - 5 + 1 = 4
    expect(screen.getByText(/4 foja\(s\) afectada\(s\)/i)).toBeInTheDocument();
  });

  it("valida campos obligatorios de identificación del solicitante", async () => {
    const user = userEvent.setup();
    render(
      <DesgloseModal
        open={true}
        onClose={vi.fn()}
        expedienteId="exp-1"
        codigoCut="EXP-2026-000100"
        documentos={mockDocumentos}
        onExito={vi.fn()}
      />
    );

    const btnSubmit = screen.getByRole("button", { name: /Revisar desglose/i });
    await user.click(btnSubmit);

    expect(screen.getByText(/Debe especificar el acto de autorización/i)).toBeInTheDocument();
  });
});
