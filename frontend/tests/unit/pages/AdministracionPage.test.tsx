import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import AdministracionPage from "../../../src/pages/administracion/AdministracionPage";
import AdminPageHeader from "../../../src/components/administracion/AdminPageHeader";
import { describe, test, expect, vi } from "vitest";

vi.mock("../../../src/hooks/useRbacConfig", () => ({
  useRbacConfig: () => ({
    puedeVerAuditoria: true,
    cargando: false,
  }),
}));

function RutaActual() {
  const location = useLocation();
  return (
    <p data-testid="ruta-actual" data-portada-admin={(location.state as { mostrarPortadaAdministrador?: boolean } | null)?.mostrarPortadaAdministrador ? "true" : "false"}>
      {location.pathname}
    </p>
  );
}

const renderConRouter = (ui: React.ReactElement, initialPath = "/administracion") => render(
  <MemoryRouter initialEntries={[initialPath]}>
    <Routes>
      <Route path="*" element={<>{ui}<RutaActual /></>} />
    </Routes>
  </MemoryRouter>,
);

describe("AdministracionPage (F_GONZALES - ENT-M05-01)", () => {
  test("1. Renderiza el título del panel de administración", () => {
    renderConRouter(<AdministracionPage />);
    expect(
      screen.getByRole("heading", { name: /Panel de Administración/i })
    ).toBeInTheDocument();
  });

  test("2. Muestra las 6 opciones administrativas más Tesorería", () => {
    const { container } = renderConRouter(<AdministracionPage />);
    expect(screen.getByText("Usuarios")).toBeInTheDocument();
    expect(screen.getByText("Roles y Permisos")).toBeInTheDocument();
    expect(screen.getByText("Auditoría")).toBeInTheDocument();
    expect(screen.getByText("Tablas Maestras")).toBeInTheDocument();
    expect(screen.getByText("Calendario Laboral")).toBeInTheDocument();
    expect(screen.getByText("Seguridad")).toBeInTheDocument();
    expect(screen.getByText("Tesorería")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /Administrar/i })).toHaveLength(7);
    expect(container.querySelectorAll("article")).toHaveLength(7);
  });

  test("3. Cada tarjeta cuenta con botón 'Administrar' accesible", () => {
    renderConRouter(<AdministracionPage />);
    const botones = screen.getAllByRole("button", { name: /Administrar/i });
    expect(botones).toHaveLength(7);
    botones.forEach((btn) => expect(btn).toBeEnabled());
  });

  test("4. Navega a /administracion/usuarios al hacer clic en Usuarios", () => {
    renderConRouter(<AdministracionPage />);
    const btnUsuarios = screen.getByRole("button", { name: /Administrar Usuarios/i });
    expect(btnUsuarios).toBeInTheDocument();
    fireEvent.click(btnUsuarios);
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/administracion/usuarios");
    expect(btnUsuarios).toBeInTheDocument();
  });

  test("5. Navega a /administracion/tablas-maestras al hacer clic", () => {
    renderConRouter(<AdministracionPage />);
    const btnTablas = screen.getByRole("button", {
      name: /Administrar Tablas Maestras/i,
    });
    expect(btnTablas).toBeInTheDocument();
    fireEvent.click(btnTablas);
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/administracion/tablas-maestras");
    expect(btnTablas).toBeInTheDocument();
  });

  test("7. La tarjeta Tesorería abre su ruta existente y el retorno administrativo vuelve al panel", () => {
    renderConRouter(<AdministracionPage />);
    fireEvent.click(screen.getByRole("button", { name: "Administrar Tesorería" }));
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/tesoreria");
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/i }));
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/administracion");
  });

  test("el botón del panel principal vuelve a la portada institucional", () => {
    renderConRouter(<AdministracionPage />);
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/i }));
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/");
    expect(screen.getByTestId("ruta-actual")).toHaveAttribute("data-portada-admin", "true");
  });

  test("el botón de una sección interna conserva el retorno al panel de siete tarjetas", () => {
    renderConRouter(<AdminPageHeader title="Usuarios" description="Administración de usuarios" />, "/administracion/usuarios");
    fireEvent.click(screen.getByRole("button", { name: /Volver al inicio/i }));
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent("/administracion");
  });

  test.each([
    ["Roles y Permisos", "/administracion/roles-permisos"],
    ["Auditoría", "/administracion/auditoria"],
    ["Calendario Laboral", "/administracion/calendario-laboral"],
    ["Seguridad", "/administracion/seguridad"],
  ])("La tarjeta %s navega a su ruta existente", (titulo, ruta) => {
    renderConRouter(<AdministracionPage />);
    fireEvent.click(screen.getByRole("button", { name: `Administrar ${titulo}` }));
    expect(screen.getByTestId("ruta-actual")).toHaveTextContent(ruta);
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
