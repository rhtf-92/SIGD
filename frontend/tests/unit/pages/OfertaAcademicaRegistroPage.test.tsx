import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, test } from "vitest";
import OfertaAcademicaRegistroPage from "../../../src/pages/registro/OfertaAcademicaRegistroPage";
import { PROGRAMAS_ESTUDIO_CATALOGO } from "../../../src/types/tramiteWizard";

describe("OfertaAcademicaRegistroPage", () => {
  test("muestra las 11 carreras oficiales y permite continuar al registro", () => {
    render(
      <MemoryRouter>
        <OfertaAcademicaRegistroPage />
      </MemoryRouter>,
    );

    const tarjetasCarreras = screen.getAllByRole("article");
    expect(tarjetasCarreras).toHaveLength(11);

    for (const [index, programa] of PROGRAMAS_ESTUDIO_CATALOGO.entries()) {
      expect(
        within(tarjetasCarreras[index]).getByRole("heading", {
          name: programa.label,
        }),
      ).toBeInTheDocument();
    }

    expect(
      screen.getAllByRole("link", { name: /Crear usuario externo|Crear usuario|Continuar al registro/i })
        .some((link) => link.getAttribute("href") === "/registro"),
    ).toBe(true);
  });

  test("permite consultar y cerrar la información de cada carrera", async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <OfertaAcademicaRegistroPage />
      </MemoryRouter>,
    );

    const tarjetasCarreras = screen.getAllByRole("article");
    for (const tarjeta of tarjetasCarreras) {
      expect(
        within(tarjeta).getByRole("button", { name: /Ver información/i }),
      ).toHaveAttribute("aria-expanded", "false");
    }

    const tarjetaSistemas = tarjetasCarreras.find((tarjeta) =>
      within(tarjeta).queryByRole("heading", {
        name: "Desarrollo de Sistemas de Información",
      }),
    );
    expect(tarjetaSistemas).toBeDefined();
    if (!tarjetaSistemas) {
      throw new Error("No se encontró la ficha de Desarrollo de Sistemas de Información");
    }

    const botonInformacion = within(tarjetaSistemas).getByRole("button", {
      name: /Ver información/i,
    });
    await user.click(botonInformacion);

    expect(botonInformacion).toHaveAttribute("aria-expanded", "true");
    expect(
      within(tarjetaSistemas).getByText(/Qué aprenderás/i),
    ).toBeInTheDocument();
    expect(
      within(tarjetaSistemas).getByText(/Dónde podrás trabajar/i),
    ).toBeInTheDocument();
    expect(
      within(tarjetaSistemas).getByText(/Programación y desarrollo web/i),
    ).toBeInTheDocument();

    await user.click(botonInformacion);
    expect(botonInformacion).toHaveAttribute("aria-expanded", "false");
  });

  test("cada programa del catálogo tiene información descriptiva", () => {
    render(
      <MemoryRouter>
        <OfertaAcademicaRegistroPage />
      </MemoryRouter>,
    );

    expect(screen.getAllByRole("button", { name: /Ver información/i })).toHaveLength(
      PROGRAMAS_ESTUDIO_CATALOGO.length,
    );
  });
});
