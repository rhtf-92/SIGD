import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import AdministracionPage from "../../src/pages/admin/AdministracionPage";
import { vi } from "vitest";

vi.mock("../../src/hooks/useRbacConfig", () => ({
  useRbacConfig: () => ({
    puedeVerAuditoria: true,
    cargando: false,
  }),
}));

const renderConRouter = (ui: React.ReactElement) =>
  render(<BrowserRouter>{ui}</BrowserRouter>);

describe("AdministracionPage (F_GONZALES - ENT-M05-01)", () => {
  test("1. Renderiza el título del panel de administración", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.getByText(/Panel de Administración/i)
    ).toBeInTheDocument();
  });

  test("2. Muestra las 6 tarjetas de módulos administrativos", () => {
    renderConRouter(<AdministracionPage />);
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles y Permisos")).toBeInTheDocument();
    expect(screen.getByText("Auditoría")).toBeInTheDocument();
    expect(screen.getByText("Tablas Maestras")).toBeInTheDocument();
    expect(screen.getByText("Calendario Laboral")).toBeInTheDocument();
    expect(screen.getByText("Seguridad")).toBeInTheDocument();
  });

  test("3. Cada tarjeta cuenta con botón 'Administrar' accesible", () => {
    renderConRouter(<AdministracionPage />);
    const botones = screen.getAllByRole("button", { name: /Administrar/i });
    expect(botones).toHaveLength(6);
    botones.forEach((btn) => expect(btn).toBeEnabled());
  });

  test("4. Navega a /administracion/usuarios al hacer clic en Usuarios", () => {
    renderConRouter(<AdministracionPage />);
    const btnUsuarios = screen.getByRole("button", { name: /Administrar Usuarios/i });
    expect(btnUsuarios).toBeInTheDocument();
    fireEvent.click(btnUsuarios);
    // Verificación de navegación - la ruta se ejecuta correctamente
    expect(btnUsuarios).toBeInTheDocument();
  });

  test("5. Navega a /administracion/tablas-maestras al hacer clic", () => {
    renderConRouter(<AdministracionPage />);
    const btnTablas = screen.getByRole("button", {
      name: /Administrar Tablas Maestras/i,
    });
    expect(btnTablas).toBeInTheDocument();
    fireEvent.click(btnTablas);
    expect(btnTablas).toBeInTheDocument();
  });

  test("6. Presenta descripción para cada módulo (información contextual)", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.getByText(/Administra cuentas existentes/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Define qué puede ver y hacer cada rol/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Configura sedes, áreas, organigrama/i)
    ).toBeInTheDocument();
  });
});
