import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";

vi.mock("../../../src/components/tramite/CargoDigitalModal", () => ({
  default: () => null,
}));

describe("avisos de catálogo en Ventanilla Presencial", () => {
  it("advierte que el catálogo Pasco no es oficial para el IESTP Suiza", () => {
    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    expect(screen.getByRole("note", { name: /Catálogo TUPA referencial/i })).toBeInTheDocument();
    expect(screen.getByText(/provienen del TUPA 2026 del IESTP Pasco/i)).toBeInTheDocument();
    expect(screen.getByText(/la integración de su catálogo propio está pendiente/i)).toBeInTheDocument();
  });

  it("explica el estado sin ficha al seleccionar documentación general", async () => {
    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <VentanillaPresencialPage />
      </MemoryRouter>,
    );

    await user.selectOptions(screen.getByLabelText(/Procedimiento TUPA 2026/i), "NO_TUPA");

    expect(screen.getByRole("status")).toHaveTextContent(/No se muestran requisitos ni tarifas de catálogo/i);
  });
});
