import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MainLayout from "../layouts/MainLayout";
import ErrorBoundary from "./ErrorBoundary";

function ComponenteConFallo({ debeFallar }: { debeFallar: boolean }) {
  if (debeFallar) {
    throw new Error("Fallo interno simulado sensible: DB_CONNECTION_LOST_XYZ");
  }
  return <p>Contenido funcionando con normalidad</p>;
}

describe("ErrorBoundary", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("ErrorBoundary muestra su mensaje y botón Reintentar sin detalles técnicos", () => {
    render(
      <ErrorBoundary>
        <ComponenteConFallo debeFallar={true} />
      </ErrorBoundary>,
    );

    // Mensaje claro presente
    expect(
      screen.getByRole("heading", { name: "Ha ocurrido un problema" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/no se pudo cargar esta sección/i),
    ).toBeInTheDocument();

    // Botón Reintentar presente
    const botonReintentar = screen.getByRole("button", { name: "Reintentar" });
    expect(botonReintentar).toBeInTheDocument();

    // Sin detalles técnicos ni stack trace
    expect(
      screen.queryByText(/DB_CONNECTION_LOST_XYZ/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Fallo interno simulado/i),
    ).not.toBeInTheDocument();
  });

  it("permite reintentar la renderización al pulsar Reintentar", () => {
    let fallo = true;
    function ComponenteDinamico() {
      if (fallo) {
        throw new Error("Fallo inicial");
      }
      return <p>Recuperado con éxito</p>;
    }

    const onResetMock = vi.fn(() => {
      fallo = false;
    });

    const { rerender } = render(
      <ErrorBoundary onReset={onResetMock}>
        <ComponenteDinamico />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    expect(onResetMock).toHaveBeenCalledTimes(1);

    rerender(
      <ErrorBoundary onReset={onResetMock}>
        <ComponenteDinamico />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Recuperado con éxito")).toBeInTheDocument();
  });

  it("MainLayout protege su contenido con ErrorBoundary manteniendo la cabecera institucional", () => {
    render(
      <MemoryRouter>
        <MainLayout>
          <ComponenteConFallo debeFallar={true} />
        </MainLayout>
      </MemoryRouter>,
    );

    // ErrorBoundary activo dentro de MainLayout
    expect(
      screen.getByRole("heading", { name: "Ha ocurrido un problema" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reintentar" }),
    ).toBeInTheDocument();

    // La interfaz de MainLayout sigue disponible
    expect(screen.getByRole("link", { name: /saltar al contenido/i })).toBeInTheDocument();
  });
});
