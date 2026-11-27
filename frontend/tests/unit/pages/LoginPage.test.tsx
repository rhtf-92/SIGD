import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock("../../../src/api/client", () => ({
  apiClient: { post: vi.fn() },
}));

import { apiClient } from "../../../src/api/client";
import LoginPage from "../../../src/pages/LoginPage";
import { useAuthStore } from "../../../src/stores/authStore";
import { ApiHttpError, type ApiProblemDetails } from "../../../src/types/api";

const post = vi.mocked(apiClient.post);

function respuestaLogin(rol: string, nombreCompleto: string) {
  return {
    data: {
      accessToken: "access-token-real",
      refreshToken: "refresh-token-real",
      usuario: {
        id: "00000000-0000-0000-0000-000000000011",
        nombreCompleto,
        correo: "admin.demo@iestpsuiza.edu.pe",
        rol,
      },
    },
  };
}

function problema(status: number, code: string, detail: string) {
  return new ApiHttpError({
    type: "https://sigd.iestpsuiza.edu.pe/errors/security",
    title: "Error",
    status,
    detail,
    instance: "/api/v1/auth/login",
    code,
    category: "Security",
    correlationId: "corr-test",
    retryable: false,
  } satisfies ApiProblemDetails);
}

const renderLoginPage = () =>
  render(
    <BrowserRouter>
      <LoginPage />
    </BrowserRouter>
  );

describe("LoginPage — Componente de Inicio de Sesión SIGD IESTP 'Suiza'", () => {
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

  describe("1. Columna Izquierda — Branding Institucional", () => {
    test("Renderiza el logotipo oficial 'S', texto institucional y badge de portal", () => {
      renderLoginPage();

      expect(screen.getByLabelText(/Logotipo oficial S del IESTP Suiza/i)).toBeInTheDocument();
      expect(screen.getByText("S")).toBeInTheDocument();
      expect(screen.getByText("IESTP SUIZA")).toBeInTheDocument();
      expect(screen.getByText(/PUCALLPA • UCAYALI/i)).toBeInTheDocument();
      expect(screen.getByText("Portal Oficial v1.0")).toBeInTheDocument();
    });

    test("Renderiza etiquetas temáticas, título SIGD y subtítulo institucional", () => {
      renderLoginPage();

      expect(screen.getByText("Trámite Documentario")).toBeInTheDocument();
      expect(screen.getByText("Firma Digital Legal")).toBeInTheDocument();
      expect(screen.getByText("Cero Papel")).toBeInTheDocument();
      expect(screen.getByRole("heading", { name: "SIGD" })).toBeInTheDocument();
      expect(screen.getByText("Sistema Integral de Gestión Documentaria")).toBeInTheDocument();
      expect(
        screen.getByText(/Plataforma oficial para la administración, tramitación y seguimiento de expedientes/i)
      ).toBeInTheDocument();
    });

    test("Renderiza distintivo de licenciamiento MINEDU y footer de República del Perú", () => {
      renderLoginPage();

      expect(screen.getByText("INSTITUCIÓN LICENCIADA POR MINEDU")).toBeInTheDocument();
      expect(screen.getByText(/Resolución Ministerial N° 409-2019-MINEDU/i)).toBeInTheDocument();
      expect(screen.getByText('IESTP "Suiza"')).toBeInTheDocument();
      expect(screen.getByText("Dirección Regional de Educación de Ucayali")).toBeInTheDocument();
      expect(screen.getByText("REPÚBLICA DEL PERÚ")).toBeInTheDocument();
    });
  });

  describe("2. Columna Derecha — Formulario de Login", () => {
    test("Renderiza encabezado del formulario y campos requeridos con iconos", () => {
      renderLoginPage();

      expect(screen.getByRole("heading", { name: "Iniciar Sesión" })).toBeInTheDocument();
      expect(
        screen.getByText(/Ingrese sus credenciales institucionales para acceder a su casilla/i)
      ).toBeInTheDocument();
      expect(screen.getByLabelText(/Usuario, DNI o Correo Institucional/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/^Contraseña$/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/Recordar sesión/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /¿Olvidó su clave\?/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Ingresar/i })).toBeInTheDocument();
      expect(screen.queryByLabelText(/Perfil \/ Rol Institucional/i)).not.toBeInTheDocument();
    });

    test("Permite alternar interactivamente la visibilidad de la contraseña", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const inputPassword = screen.getByLabelText(/^Contraseña$/i) as HTMLInputElement;
      const toggleBtn = screen.getByRole("button", { name: /Mostrar contraseña/i });

      expect(inputPassword.type).toBe("password");
      await user.click(toggleBtn);
      expect(inputPassword.type).toBe("text");
      expect(screen.getByRole("button", { name: /Ocultar contraseña/i })).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Ocultar contraseña/i }));
      expect(inputPassword.type).toBe("password");
    });

    test("Muestra mensaje de error cuando los campos están vacíos al enviar", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /Ingresar/i }));

      expect(
        screen.getByText(/Por favor, ingrese su usuario, DNI o correo institucional/i)
      ).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      expect(post).not.toHaveBeenCalled();
    });

    test("Muestra modal de asistencia al hacer clic en '¿Olvidó su clave?' y permite cerrarlo", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      await user.click(screen.getByRole("button", { name: /¿Olvidó su clave\?/i }));

      expect(screen.getByRole("heading", { name: /Restablecimiento de Credenciales/i })).toBeInTheDocument();
      expect(screen.getByText(/Oficina de Tecnologías de la Información/i)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Entendido/i }));
      expect(screen.queryByRole("heading", { name: /Restablecimiento de Credenciales/i })).not.toBeInTheDocument();
    });

    test("Enlace a la Mesa de Partes Virtual está presente y apunta a la ruta oficial", () => {
      renderLoginPage();

      const linkMesa = screen.getByRole("link", {
        name: /Presentar solicitud en Mesa de Partes Virtual/i,
      });
      expect(linkMesa).toHaveAttribute("href", "/tramite/mesa-partes-virtual");
    });
  });

  describe("3. Footer del Login y Datos Operativos", () => {
    test("Renderiza horario de atención, correo de soporte y copyright dinámico con año actual", () => {
      renderLoginPage();

      const anioActual = new Date().getFullYear();
      expect(screen.getByText(/Atención: Lun - Vie 08:00 a 16:30 hrs/i)).toBeInTheDocument();
      expect(screen.getByText("soporte.sigd@iestpsuiza.edu.pe")).toBeInTheDocument();
      expect(
        screen.getByText(new RegExp(`© ${anioActual} IESTP "Suiza" — Pucallpa, Ucayali`, "i"))
      ).toBeInTheDocument();
    });
  });

  describe("4. Flujo de Autenticación Real", () => {
    test("Autentica contra la API, persiste la sesión y redirige según el rol del backend", async () => {
      post.mockResolvedValueOnce(
        respuestaLogin("SUPER_ADMIN", "Ing. Super Administrador") as never
      );
      renderLoginPage();
      const user = userEvent.setup();

      await user.type(
        screen.getByLabelText(/Usuario, DNI o Correo Institucional/i),
        "admin.demo"
      );
      await user.type(screen.getByLabelText(/^Contraseña$/i), "ClaveSegura2026");
      await user.click(screen.getByLabelText(/Recordar sesión/i));
      await user.click(screen.getByRole("button", { name: /Ingresar/i }));

      await waitFor(() => {
        expect(post).toHaveBeenCalledWith("/api/v1/auth/login", {
          identificador: "admin.demo",
          password: "ClaveSegura2026",
        });
        expect(window.localStorage.getItem("sigd_token")).toBe("access-token-real");
        expect(window.localStorage.getItem("sigd_rol")).toBe("SUPER_ADMIN");
        expect(window.localStorage.getItem("sigd_remembered_user")).toBe("admin.demo");
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      });
    });

    test("Redirige al destino canónico del rol devuelto por el backend", async () => {
      post.mockResolvedValueOnce(
        respuestaLogin("DOCENTE", "Lic. Docente / Coordinador") as never
      );
      renderLoginPage();
      const user = userEvent.setup();

      await user.type(
        screen.getByLabelText(/Usuario, DNI o Correo Institucional/i),
        "docente@iestpsuiza.edu.pe"
      );
      await user.type(screen.getByLabelText(/^Contraseña$/i), "Docente2026!");
      await user.click(screen.getByRole("button", { name: /Ingresar/i }));

      await waitFor(() => {
        expect(window.localStorage.getItem("sigd_rol")).toBe("DOCENTE");
        expect(mockNavigate).toHaveBeenCalledWith("/flujos/titulacion", { replace: true });
      });
    });
  });

  describe("5. Seguridad y Bloqueo de Acceso Indebido", () => {
    test("Muestra alerta si el backend rechaza credenciales (401)", async () => {
      post.mockRejectedValueOnce(
        problema(401, "UNAUTHORIZED", "Credenciales inválidas. Verifique su usuario o contraseña.")
      );
      renderLoginPage();
      const user = userEvent.setup();

      await user.type(
        screen.getByLabelText(/Usuario, DNI o Correo Institucional/i),
        "99998888"
      );
      await user.type(screen.getByLabelText(/^Contraseña$/i), "ClaveCualquiera123");
      await user.click(screen.getByRole("button", { name: /Ingresar/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/Credenciales inválidas/i)).toBeInTheDocument();
        expect(window.localStorage.getItem("sigd_token")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    test("Muestra alerta si la cuenta está deshabilitada (403 ACCOUNT_DISABLED)", async () => {
      post.mockRejectedValueOnce(
        problema(403, "ACCOUNT_DISABLED", "Su cuenta institucional se encuentra suspendida.")
      );
      renderLoginPage();
      const user = userEvent.setup();

      await user.type(
        screen.getByLabelText(/Usuario, DNI o Correo Institucional/i),
        "inactivo"
      );
      await user.type(screen.getByLabelText(/^Contraseña$/i), "ClaveSegura2026");
      await user.click(screen.getByRole("button", { name: /Ingresar/i }));

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/suspendida/i)).toBeInTheDocument();
        expect(window.localStorage.getItem("sigd_token")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });
  });
});
