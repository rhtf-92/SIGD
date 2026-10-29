import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, test, expect, beforeEach, vi } from "vitest";
import SidebarInstitucional from "../../../src/components/layout/SidebarInstitucional";
import { useAuthStore } from "../../../src/stores/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("SidebarInstitucional — Menú Lateral Persistente SIGD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      accessToken: "mock-token",
      usuario: {
        id: "u-123",
        nombreCompleto: "Ing. Super Administrador",
        correo: "admin.sigd@iestpsuiza.edu.pe",
        rol: "SUPER_ADMIN",
      },
      isAuthenticated: true,
    });
  });

  const renderSidebar = () =>
    render(
      <BrowserRouter>
        <SidebarInstitucional />
      </BrowserRouter>
    );

  test("1. Renderiza el branding institucional del Sidebar", () => {
    renderSidebar();

    expect(screen.getByText("SIGD SUIZA")).toBeInTheDocument();
    expect(screen.getByText(/PUCALLPA • UCAYALI/i)).toBeInTheDocument();
    expect(screen.getByText("Portal Oficial v1.0")).toBeInTheDocument();
  });

  test("2. Renderiza de forma limpia los 8 módulos institucionales requeridos", () => {
    renderSidebar();

    // 1. Mesa de Partes Virtual
    expect(
      screen.getByRole("link", { name: /Mesa de Partes Virtual/i })
    ).toHaveAttribute("href", "/tramite/mesa-partes-virtual");

    // 2. Casilla Electrónica
    expect(
      screen.getByRole("link", { name: /Casilla Electrónica/i })
    ).toHaveAttribute("href", "/casilla");

    // 3. Validador CVD
    expect(
      screen.getByRole("link", { name: /Validador CVD/i })
    ).toHaveAttribute("href", "/validador-cvd");

    // 4. Registro Ciudadano
    expect(
      screen.getByRole("link", { name: /Registro Ciudadano/i })
    ).toHaveAttribute("href", "/registro");

    // 5. Bandeja de Expedientes
    expect(
      screen.getByRole("link", { name: /Bandeja de Expedientes/i })
    ).toHaveAttribute("href", "/expedientes");

    // 6. Flujo y Firma Digital
    expect(
      screen.getByRole("link", { name: /Flujo y Firma Digital/i })
    ).toHaveAttribute("href", "/flujo-validez-legal");

    // 7. Reportes & Métricas
    expect(
      screen.getByRole("link", { name: /Reportes & Métricas/i })
    ).toHaveAttribute("href", "/reportes/dashboard");

    // 8. Panel de Administración
    expect(
      screen.getByRole("link", { name: /Panel de Administración/i })
    ).toHaveAttribute("href", "/administracion");
  });

  test("3. Muestra en la parte inferior la tarjeta de perfil de 'Usuario Activo'", () => {
    renderSidebar();

    const perfilContainer = screen.getByLabelText(/Información del usuario activo/i);
    expect(perfilContainer).toBeInTheDocument();

    expect(screen.getByText("Ing. Super Administrador")).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
    expect(screen.getByText("admin.sigd@iestpsuiza.edu.pe")).toBeInTheDocument();
  });

  test("4. Incluye el botón de cerrar sesión (Logout) y ejecuta la desconexión", async () => {
    renderSidebar();
    const user = userEvent.setup();

    const btnLogout = screen.getByRole("button", { name: /Cerrar Sesión/i });
    expect(btnLogout).toBeInTheDocument();

    await user.click(btnLogout);

    // Debe limpiar el token y navegar a /login
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(mockNavigate).toHaveBeenCalledWith("/login", { replace: true });
  });
});
