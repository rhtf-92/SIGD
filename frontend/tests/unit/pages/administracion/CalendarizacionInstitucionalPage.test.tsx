import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import CalendarizacionInstitucionalPage from "../../../../src/pages/administracion/CalendarizacionInstitucionalPage";
import { apiClient } from "../../../../src/api/client";

vi.mock("../../../../src/api/client", () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

describe("CalendarizacionInstitucionalPage Component", () => {
  const mockDatos = {
    data: {
      fuente: {
        nombre: "Calendarización Institucional 2026",
        anio: 2026,
        referenciaSeccion: "7.2",
        hashExtraccionSha256: "648c5ad1aea1abbe6a6eeb20586a7c172365ce29d41e3c33b0616b3873a0bec7",
      },
      total: 2,
      actividades: [
        {
          numero: 1,
          actividad: "Reincorporación, Traslados Internos y Externos",
          fechaInicio: "2026-03-03",
          fechaFin: "2026-03-31",
          fechaTextoOriginal: "Del 03/03/2026 al 31/03/2026",
          responsables: "Dirección General, Secretaría Académica.",
          anio: 2026,
          referenciaSeccion: "7.2",
        },
        {
          numero: 2,
          actividad: "Matrícula del III - V ciclo",
          fechaInicio: "2026-03-16",
          fechaFin: "2026-04-30",
          fechaTextoOriginal: "Del 16/03/2026 al 30/04/2026",
          responsables: "Unidad Administrativa.",
          anio: 2026,
          referenciaSeccion: "7.2",
        },
      ],
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renderiza el título y el aviso normativo de separación con SLA", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockDatos);

    render(
      <MemoryRouter>
        <CalendarizacionInstitucionalPage />
      </MemoryRouter>
    );

    expect(
      screen.getByText(/Calendarización Institucional 2026/i)
    ).toBeInTheDocument();

    expect(
      screen.getByRole("note", { name: /Aviso normativo de calendarización/i })
    ).toBeInTheDocument();

    expect(
      screen.getByText(/no altera los plazos legales de atención, feriados ni el cálculo de días hábiles del SLA/i)
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("Reincorporación, Traslados Internos y Externos")).toBeInTheDocument();
      expect(screen.getByText("Matrícula del III - V ciclo")).toBeInTheDocument();
    });
  });

  it("permite filtrar actividades mediante el buscador", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(mockDatos);
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <CalendarizacionInstitucionalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Reincorporación, Traslados Internos y Externos")).toBeInTheDocument();
    });

    const buscador = screen.getByPlaceholderText(/Buscar por actividad, responsable o fecha/i);
    await user.type(buscador, "Matrícula");

    expect(screen.queryByText("Reincorporación, Traslados Internos y Externos")).not.toBeInTheDocument();
    expect(screen.getByText("Matrícula del III - V ciclo")).toBeInTheDocument();
  });

  it("despliega alerta clara en caso de fallo en la API", async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error("Fallo de red"));

    render(
      <MemoryRouter>
        <CalendarizacionInstitucionalPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(
        screen.getByRole("alert")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/No se pudo cargar la calendarización institucional/i)
      ).toBeInTheDocument();
    });
  });
});
