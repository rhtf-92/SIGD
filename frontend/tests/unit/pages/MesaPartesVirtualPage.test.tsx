import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import HeaderInstitucional from "../../../src/components/HeaderInstitucional";
import { ThemeProvider } from "../../../src/contexts/ThemeContext";
import MesaPartesVirtualPage from "../../../src/pages/tramite/MesaPartesVirtualPage";

function pdfFile() {
  return new File(
    [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x30])],
    "solicitud.pdf",
    { type: "application/pdf" },
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/tramite/mesa-partes-virtual"]}>
      <ThemeProvider>
        <HeaderInstitucional />
        <MesaPartesVirtualPage />
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("MesaPartesVirtualPage", () => {
  it("cambia entre los temas normal, oscuro y claro", () => {
    renderPage();
    const main = screen.getByRole("main");

    expect(main).toHaveClass("bg-blue-50");
    expect(screen.getByText("Claro")).toBeVisible();
    expect(screen.getByText("Oscuro")).toBeVisible();
    expect(screen.getByText("Normal")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Tema oscuro" }));
    expect(main).toHaveClass("bg-[#070b19]");
    expect(
      screen.getByRole("button", { name: "Tema oscuro" }),
    ).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(screen.getByRole("button", { name: "Tema claro" }));
    expect(main).toHaveClass("bg-slate-100");

    fireEvent.click(
      screen.getByRole("button", { name: "Tema normal (institucional)" }),
    );
    expect(main).toHaveClass("bg-blue-50");
  });

  it("muestra los créditos del Grupo SIGD y la rama F_SORIA", () => {
    renderPage();

    expect(
      screen.getByRole("heading", { name: /Grupo SIGD · Equipo de Desarrollo/ }),
    ).toBeInTheDocument();
    expect(screen.getByText("F_SORIA")).toBeVisible();
    expect(screen.getByText("Rama oficial: F_SORIA")).toBeVisible();

    for (const nombre of [
      "Isaac",
      "Perea",
      "Clider",
      "Cristiam",
      "Urquia",
      "Jhonatan",
      "Arevalo",
      "Vargas Lloner",
      "Azañero",
      "Bolaños",
      "Pool Carranza",
      "Serruche",
    ]) {
      expect(screen.getByText(nombre)).toBeVisible();
    }
  });

  it("permite cargar, escribir, cambiar horario y registrar", async () => {
    renderPage();

    const inputSolicitante = screen.getByPlaceholderText(
      "Nombre del administrado",
    );
    fireEvent.change(inputSolicitante, { target: { value: "Ana Pérez" } });
    expect(inputSolicitante).toHaveValue("Ana Pérez");

    fireEvent.change(
      screen.getByPlaceholderText("Descripción breve del trámite"),
      { target: { value: "Solicitud de constancia" } },
    );

    fireEvent.change(screen.getByLabelText("Seleccionar archivo PDF"), {
      target: { files: [pdfFile()] },
    });

    await waitFor(
      () =>
        expect(
          screen.getByText(/Documento validado y firmado \(simulación\)/),
        ).toBeInTheDocument(),
      { timeout: 5000 },
    );

    fireEvent.change(screen.getByLabelText("Fecha y hora de simulación"), {
      target: { value: "2026-10-23T17:00" },
    });

    expect(screen.getByTestId("condicion-horario")).toHaveTextContent(
      "Corte o día inhábil: proyectar",
    );

    fireEvent.click(
      screen.getByRole("button", {
        name: /Registrar Trámite \/ Enviar Solicitud/,
      }),
    );

    await waitFor(
      () => expect(screen.getByText("Registrado con éxito")).toBeInTheDocument(),
      { timeout: 3000 },
    );

    expect(screen.getByText(/MPV-\d{8}-\d{6}/)).toBeInTheDocument();
    expect(screen.getAllByText("Ana Pérez").length).toBeGreaterThanOrEqual(2);
  });
});
