import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import ErrorBoundary from "../../../src/components/common/ErrorBoundary";

function ComponenteConError({ debeFallar }: { debeFallar: boolean }) {
  if (debeFallar) {
    throw new Error("Simulación de fallo en renderizado de componente");
  }
  return <div>Contenido renderizado correctamente</div>;
}

describe("ErrorBoundary Institutional Component", () => {
  const originalConsoleError = console.error;

  beforeEach(() => {
    console.error = vi.fn();
  });

  afterEach(() => {
    console.error = originalConsoleError;
  });

  it("debe renderizar los hijos cuando no hay errores", () => {
    render(
      <ErrorBoundary>
        <ComponenteConError debeFallar={false} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Contenido renderizado correctamente")).toBeInTheDocument();
  });

  it("debe capturar el error y renderizar la interfaz de contingencia con correlation_id", () => {
    render(
      <ErrorBoundary fallbackTitle="Error de Contingencia Institucional">
        <ComponenteConError debeFallar={true} />
      </ErrorBoundary>,
    );

    expect(screen.getByText("Error de Contingencia Institucional")).toBeInTheDocument();
    expect(screen.getByText(/X-Correlation-ID:/i)).toBeInTheDocument();
    expect(screen.getByText("Reintentar operación")).toBeInTheDocument();
    expect(screen.getByText("Volver al inicio")).toBeInTheDocument();
  });

  it("debe alternar la visualización de los detalles técnicos del error", () => {
    render(
      <ErrorBoundary>
        <ComponenteConError debeFallar={true} />
      </ErrorBoundary>,
    );

    const btnDetalles = screen.getByText("Ver detalles técnicos");
    fireEvent.click(btnDetalles);

    expect(screen.getByText("Simulación de fallo en renderizado de componente")).toBeInTheDocument();
    expect(screen.getByText("Ocultar detalles técnicos")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Ocultar detalles técnicos"));
    expect(screen.queryByText("Simulación de fallo en renderizado de componente")).not.toBeInTheDocument();
  });
});
