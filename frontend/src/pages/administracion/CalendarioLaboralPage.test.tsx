import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("../../api/client", () => ({
  apiClient: { get: apiMocks.get },
}));

import { apiClient } from "../../api/client";
import CalendarioLaboralPage from "./CalendarioLaboralPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <CalendarioLaboralPage />
    </MemoryRouter>,
  );
}

describe("CalendarioLaboralPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra solo los feriados devueltos por la API", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        calendario: [
          {
            fecha: "2099-01-02",
            descripcion: "AUDITORIA - feriado ficticio uno",
            es_laborable: false,
          },
          {
            fecha: "2099-03-04",
            descripcion: "AUDITORIA - feriado ficticio dos",
            es_laborable: false,
          },
          {
            fecha: "2099-05-06",
            descripcion: "AUDITORIA - habilitación laborable ficticia",
            es_laborable: true,
          },
        ],
      },
    } as never);

    renderPage();

    expect(
      await screen.findByText("AUDITORIA - feriado ficticio uno"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AUDITORIA - feriado ficticio dos"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("AUDITORIA - habilitación laborable ficticia"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /agregar|quitar|guardar/i }),
    ).toBeNull();
  });

  it("muestra el estado vacío cuando la API no devuelve feriados", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { calendario: [] },
    } as never);

    renderPage();

    expect(
      await screen.findByText(
        "No hay feriados registrados en el calendario laboral.",
      ),
    ).toBeInTheDocument();
  });

  it("muestra el error de carga y permite reintentar", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("AUDITORIA - error ficticio de carga"))
      .mockResolvedValueOnce({ data: { calendario: [] } } as never);

    renderPage();

    expect(
      await screen.findByText("AUDITORIA - error ficticio de carga"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(
        "No hay feriados registrados en el calendario laboral.",
      ),
    ).toBeInTheDocument();
  });
});
