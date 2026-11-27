import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdministracionPage from "../../../src/pages/admin/AdministracionPage";
import { describe, test, expect, vi } from "vitest";

vi.mock("../../../src/hooks/useRbacConfig", () => ({
  useRbacConfig: () => ({
    puedeVerAuditoria: true,
    cargando: false,
  }),
}));

const renderConRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe("AdministracionPage (panel limpio)", () => {
  test("1. Conserva el encabezado del panel", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.getByRole("heading", { name: /Panel de Administración/i })
    ).toBeInTheDocument();
  });

  test("2. Conserva el bloque de bienvenida y sus accesos", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.getByRole("heading", { name: /Bienvenido al Panel de Control SIGD/i })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Directorio Personal/i })
    ).toBeEnabled();
  });

  test("3. Conserva los cuatro indicadores superiores", () => {
    renderConRouter(<AdministracionPage />);
    expect(screen.getByText("Directorio Activo")).toBeInTheDocument();
    expect(screen.getByText("Matriz de Acceso")).toBeInTheDocument();
    expect(screen.getByText("Auditoría WORM")).toBeInTheDocument();
    expect(screen.getByText("Corte Normativo")).toBeInTheDocument();
  });

  test("4. No renderiza la sección de módulos de configuración y control", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.queryByText("Módulos de Configuración y Control")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Selecciona una opción para administrar el SIGD.")
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Selecciona una opción para administrar el SIGD")
    ).not.toBeInTheDocument();
  });

  test("5. No renderiza las seis tarjetas ni sus botones Administrar", () => {
    renderConRouter(<AdministracionPage />);
    ["Usuarios", "Roles y Permisos", "Auditoría", "Tablas Maestras", "Calendario Laboral", "Seguridad"]
      .forEach((nombre) => {
        expect(screen.queryByText(nombre, { exact: true })).not.toBeInTheDocument();
      });
    expect(screen.queryByRole("button", { name: /Administrar/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Acceso Autorizado")).not.toBeInTheDocument();
  });
});
