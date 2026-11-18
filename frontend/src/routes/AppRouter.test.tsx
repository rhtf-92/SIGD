import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import AppRouter from "./AppRouter";

describe("AppRouter - Ruta desconocida (404)", () => {
  it("la ruta desconocida muestra la 404 con título y opciones de navegación", () => {
    render(
      <MemoryRouter initialEntries={["/ruta-totalmente-desconocida-404"]}>
        <AppRouter />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Página no encontrada" }),
    ).toBeInTheDocument();

    expect(
      screen.getByText(/la página o trámite que buscas no existe/i),
    ).toBeInTheDocument();

    const enlaceInicio = screen.getByRole("link", { name: "Ir al inicio" });
    expect(enlaceInicio).toBeInTheDocument();
    expect(enlaceInicio).toHaveAttribute("href", "/");

    const enlaceTupa = screen.getByRole("link", { name: "Buscar un trámite" });
    expect(enlaceTupa).toBeInTheDocument();
    expect(enlaceTupa).toHaveAttribute("href", "/tupa");

    const enlaceConsulta = screen.getByRole("link", {
      name: "Consultar expediente",
    });
    expect(enlaceConsulta).toBeInTheDocument();
    expect(enlaceConsulta).toHaveAttribute("href", "/consulta");
  });
});
