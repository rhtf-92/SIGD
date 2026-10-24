/**
 * Suite de la página 404 del SIGD.
 * Verifica la escena del cavernícola desenchufando el cable, el texto
 * alternativo de la ilustración y el enlace de retorno al inicio.
 */
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import PaginaNoEncontrada from "../../../src/pages/PaginaNoEncontrada";
import AppRouter from "../../../src/routes/AppRouter";

function renderPagina() {
  return render(
    <MemoryRouter>
      <PaginaNoEncontrada />
    </MemoryRouter>,
  );
}

describe("Página 404 del SIGD", () => {
  it("1. Muestra el encabezado y la etiqueta del error 404", () => {
    renderPagina();
    expect(screen.getByText("Error 404")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { level: 1, name: /no existe en la caverna/i }),
    ).toBeInTheDocument();
  });

  it("2. Conserva la estructura base: .page_404 y .four_zero_four_bg", () => {
    const { container } = renderPagina();
    expect(container.querySelector(".page_404")).not.toBeNull();
    expect(container.querySelector(".four_zero_four_bg")).not.toBeNull();
  });

  it("3. Expone la ilustración del cavernícola con texto alternativo", () => {
    renderPagina();
    const ilustracion = screen.getByAltText(/cavernícola/i);
    expect(ilustracion).toBeInTheDocument();
    // La ilustración va embebida (data URI) para que también se pinte
    // cuando el navegador no tiene conexión a internet.
    expect(ilustracion.getAttribute("src")).toMatch(/^data:image\/svg\+xml/);
  });

  it("4. Ofrece una acción para volver al inicio", () => {
    renderPagina();
    expect(screen.getByRole("link", { name: /volver al inicio/i })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("5. La ruta catch-all del router renderiza la página 404", () => {
    render(
      <MemoryRouter initialEntries={["/ruta/que/no/existe"]}>
        <AppRouter />
      </MemoryRouter>,
    );
    expect(screen.getByText("Error 404")).toBeInTheDocument();
  });
});
