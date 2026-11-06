import { render, screen, cleanup, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../../src/pages/LoginPage";
import { useAuthStore } from "../../src/stores/authStore";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe("Adversarial Stress Testing: LoginPage Redirection & State Handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
    window.localStorage.clear();
  });

  function renderLoginPage(initialState?: unknown) {
    return render(
      <MemoryRouter
        initialEntries={[
          {
            pathname: "/login",
            state: initialState,
          },
        ]}
      >
        <LoginPage />
      </MemoryRouter>
    );
  }

  it("1. Redirige fielmente al destino preservado cuando state.from es un objeto Location con search y hash", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "1", nombreCompleto: "Admin", correo: "a@a.pe", rol: "SUPER_ADMIN" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage({
      from: {
        pathname: "/expedientes/EXP-2026-987",
        search: "?tab=atendidos&orden=desc",
        hash: "#actuaciones",
      },
    });

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/expedientes/EXP-2026-987?tab=atendidos&orden=desc#actuaciones",
        { replace: true }
      );
    });
  });

  it("2. Redirige fielmente al destino preservado cuando state.from es un string simple", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "1", nombreCompleto: "Docente", correo: "d@d.pe", rol: "DOCENTE" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage({ from: "/flujos/titulacion" });

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/flujos/titulacion", { replace: true });
    });
  });

  it("3. Redirige a rutas anidadas profundas bajo /administracion con query params", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "1", nombreCompleto: "Admin", correo: "a@a.pe", rol: "SUPER_ADMIN" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage({
      from: {
        pathname: "/administracion/usuarios",
        search: "?filtro=DIRECTOR&estado=ACTIVO",
      },
    });

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/administracion/usuarios?filtro=DIRECTOR&estado=ACTIVO",
        { replace: true }
      );
    });
  });

  it("4. Fallback de destino por rol cuando state.from es null: ESTUDIANTE -> /casilla", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "2", nombreCompleto: "Estudiante", correo: "e@e.pe", rol: "ESTUDIANTE" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/casilla", { replace: true });
    });
  });

  it("5. Fallback de destino por rol cuando state.from es null: DOCENTE -> /flujos/titulacion", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "3", nombreCompleto: "Docente", correo: "d@d.pe", rol: "DOCENTE" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/flujos/titulacion", { replace: true });
    });
  });

  it("6. Fallback de destino por rol cuando state.from es null: MESA_PARTES -> /tramite/ventanilla-presencial", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "4", nombreCompleto: "Operador MP", correo: "mp@mp.pe", rol: "MESA_PARTES" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/tramite/ventanilla-presencial", { replace: true });
    });
  });

  it("7. Fallback de destino por rol cuando state.from es null: DIRECTOR -> /administracion", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "5", nombreCompleto: "Director", correo: "dir@dir.pe", rol: "DIRECTOR" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/administracion", { replace: true });
    });
  });

  it("8. Fallback de destino por rol cuando state.from es null: SUPER_ADMIN -> /administracion", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "1", nombreCompleto: "Admin", correo: "adm@adm.pe", rol: "SUPER_ADMIN" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/administracion", { replace: true });
    });
  });

  it("9. Fallback defensivo ante rol desconocido o ausente: redirige a /administracion", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockImplementation(async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        usuario: { id: "99", nombreCompleto: "Anon", correo: "anon@anon.pe", rol: "ROL_DESCONOCIDO" },
        isAuthenticated: true,
      });
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith("/administracion", { replace: true });
    });
  });

  it("10. Captura de errores 401 RFC 7807 y despliegue del mensaje en pantalla", async () => {
    const user = userEvent.setup();
    const mockLogin = vi.fn().mockRejectedValue({
      response: {
        data: {
          title: "Unauthorized",
          detail: "Contraseña incorrecta o cuenta deshabilitada.",
        },
      },
    });
    useAuthStore.setState({ login: mockLogin });

    renderLoginPage(null);

    const submitBtn = screen.getByRole("button", { name: /Ingresar con Credenciales Oficiales/i });
    await user.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByRole("alert")).toBeInTheDocument();
      expect(screen.getByText("Contraseña incorrecta o cuenta deshabilitada.")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });
});
