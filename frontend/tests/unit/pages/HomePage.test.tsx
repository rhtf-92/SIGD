import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, test, expect, beforeEach, vi } from "vitest";
import HomePage from "../../../src/pages/HomePage";
import { useAuthStore } from "../../../src/stores/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    Navigate: ({ to }: { to: string }) => <div data-testid="navigate-redirect">{to}</div>,
  };
});

describe("HomePage — Dashboard Central Reestructurado SIGD", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  const renderHomePage = () =>
    render(
      <BrowserRouter>
        <HomePage />
      </BrowserRouter>
    );

  test("1. Redirige a /login si el usuario no cuenta con sesión/token", () => {
    // Sin token en storage
    renderHomePage();

    const redirectEl = screen.getByTestId("navigate-redirect");
    expect(redirectEl).toHaveTextContent("/login");
  });

  test("2. Renderiza el panel ejecutivo y saludo cuando está autenticado", () => {
    window.localStorage.setItem("sigd_token", "jwt-test-123");
    window.localStorage.setItem("sigd_rol", "SUPER_ADMIN");
    window.localStorage.setItem("sigd_usuario_nombre", "Ing. Super Administrador");

    useAuthStore.setState({
      accessToken: "jwt-test-123",
      usuario: {
        id: "u1",
        nombreCompleto: "Ing. Super Administrador",
        correo: "admin@iestpsuiza.edu.pe",
        rol: "SUPER_ADMIN",
      },
      isAuthenticated: true,
    });

    renderHomePage();

    expect(
      screen.getByRole("heading", { name: /Bienvenido, Ing. Super Administrador/i })
    ).toBeInTheDocument();
    expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
    expect(screen.getByText(/IESTP "Suiza" • Pucallpa/i)).toBeInTheDocument();
  });

  test("3. Muestra las 4 tarjetas métricas ejecutivas estructuradas sobre fondo neutro", () => {
    window.localStorage.setItem("sigd_token", "jwt-test-123");

    renderHomePage();

    expect(screen.getByText("Expedientes Activos")).toBeInTheDocument();
    expect(screen.getByText("Casilla Electrónica")).toBeInTheDocument();
    expect(screen.getByText("Firma Digital & CVD")).toBeInTheDocument();
    expect(screen.getByText("Mesa de Partes")).toBeInTheDocument();
  });

  test("4. Permite realizar la búsqueda rápida por CUT y redirige", () => {
    window.localStorage.setItem("sigd_token", "jwt-test-123");

    renderHomePage();

    const cutInput = screen.getByPlaceholderText(/Ej. CUT-2026-00042/i);
    const searchBtn = screen.getByRole("button", { name: /Buscar/i });

    fireEvent.change(cutInput, { target: { value: "CUT-2026-00088" } });
    fireEvent.click(searchBtn);

    expect(mockNavigate).toHaveBeenCalledWith("/consulta/CUT-2026-00088");
  });

  test("5. No renderiza la cuadrícula obsoleta de 9 tarjetas de navegación", () => {
    window.localStorage.setItem("sigd_token", "jwt-test-123");

    renderHomePage();

    // Las antiguas tarjetas como "MOD-04 / Firma Digital" o "ENT-M01-03" ya no existen en el centro
    expect(screen.queryByText("MOD-04 / Firma Digital")).not.toBeInTheDocument();
    expect(screen.queryByText("ENT-M01-03")).not.toBeInTheDocument();
    expect(screen.queryByText("ENT-M02 / TUPA")).not.toBeInTheDocument();
  });
});
