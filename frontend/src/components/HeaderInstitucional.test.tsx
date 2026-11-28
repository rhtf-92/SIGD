import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import HeaderInstitucional from "./HeaderInstitucional";

function LocationDisplay() {
  const location = useLocation();
  return <div data-testid="location-display">{location.pathname}</div>;
}

describe("HeaderInstitucional - Navegación según Rol", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  it("renderiza enlaces públicos cuando el usuario no está autenticado", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByRole("button", { name: "TUPA vigente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Casilla Electrónica" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Administración" })).not.toBeInTheDocument();
  });

  it("muestra módulos exclusivos de Mesa de Partes al autenticar como MESA_PARTES", () => {
    useAuthStore.setState({
      accessToken: "token-mp",
      isAuthenticated: true,
      usuario: {
        id: "usr-mp",
        nombreCompleto: "Noelia - Mesa de Partes",
        correo: "mesapartes@iestpsuiza.edu.pe",
        rol: "MESA_PARTES",
      },
    });

    render(
      <MemoryRouter initialEntries={["/expedientes"]}>
        <HeaderInstitucional />
        <LocationDisplay />
      </MemoryRouter>
    );

    // Debe mostrar la insignia del rol
    expect(screen.getByText("Mesa de Partes")).toBeInTheDocument();
    expect(screen.getByText("Noelia - Mesa de Partes")).toBeInTheDocument();

    // Módulos que corresponden a Mesa de Partes
    const btnExpedientes = screen.getByRole("button", { name: "Bandeja de Expedientes" });
    const btnVentanilla = screen.getByRole("button", { name: "Ventanilla Presencial" });
    const btnAtencion = screen.getByRole("button", { name: "Atención de Trámites" });
    const btnMesaVirtual = screen.getByRole("button", { name: "Mesa Virtual" });
    const btnTupa = screen.getByRole("button", { name: "TUPA" });
    const btnCerrar = screen.getByRole("button", { name: "Cerrar sesión" });

    expect(btnExpedientes).toBeInTheDocument();
    expect(btnVentanilla).toBeInTheDocument();
    expect(btnAtencion).toBeInTheDocument();
    expect(btnMesaVirtual).toBeInTheDocument();
    expect(btnTupa).toBeInTheDocument();
    expect(btnCerrar).toBeInTheDocument();

    // No debe mostrar "Administración" (evita acceso denegado)
    expect(screen.queryByRole("button", { name: "Administración" })).not.toBeInTheDocument();

    // La pestaña activa debe ser Bandeja de Expedientes en /expedientes
    expect(btnExpedientes).toHaveClass("header-nav-active");

    // Al hacer clic en Ventanilla Presencial debe navegar a /ventanilla
    fireEvent.click(btnVentanilla);
    expect(screen.getByTestId("location-display")).toHaveTextContent("/ventanilla");
  });

  it("muestra módulo de Administración para ADMINISTRADOR", () => {
    useAuthStore.setState({
      accessToken: "token-admin",
      isAuthenticated: true,
      usuario: {
        id: "usr-adm",
        nombreCompleto: "Administrador General",
        correo: "admin@iestpsuiza.edu.pe",
        rol: "ADMINISTRADOR",
      },
    });

    render(
      <MemoryRouter initialEntries={["/administracion"]}>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText("Administrador")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Administración" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expedientes" })).toBeInTheDocument();
  });
});
