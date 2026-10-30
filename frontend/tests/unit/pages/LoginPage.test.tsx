import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { BrowserRouter } from "react-router-dom";
import { describe, test, expect, beforeEach, vi } from "vitest";
import LoginPage from "../../../src/pages/LoginPage";

const mockNavigate = vi.fn();

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

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
  });

  describe("1. Columna Izquierda — Branding Institucional", () => {
    test("Renderiza el logotipo oficial 'S', texto institucional y badge de portal", () => {
      renderLoginPage();

      // Logotipo oficial 'S'
      expect(screen.getByLabelText(/Logotipo oficial S del IESTP Suiza/i)).toBeInTheDocument();
      expect(screen.getByText("S")).toBeInTheDocument();

      // Textos del instituto
      expect(screen.getByText("IESTP SUIZA")).toBeInTheDocument();
      expect(screen.getByText(/PUCALLPA • UCAYALI/i)).toBeInTheDocument();

      // Badge oficial
      expect(screen.getByText("Portal Oficial v1.0")).toBeInTheDocument();
    });

    test("Renderiza etiquetas temáticas, título SIGD y subtítulo institucional", () => {
      renderLoginPage();

      // Etiquetas de gestión documentaria
      expect(screen.getByText("Trámite Documentario")).toBeInTheDocument();
      expect(screen.getByText("Firma Digital Legal")).toBeInTheDocument();
      expect(screen.getByText("Cero Papel")).toBeInTheDocument();

      // Título y Subtítulo
      expect(screen.getByRole("heading", { name: "SIGD" })).toBeInTheDocument();
      expect(screen.getByText("Sistema Integral de Gestión Documentaria")).toBeInTheDocument();

      // Descripción institucional
      expect(
        screen.getByText(/Plataforma oficial para la administración, tramitación y seguimiento de expedientes/i)
      ).toBeInTheDocument();
    });

    test("Renderiza distintivo de licenciamiento MINEDU y footer de República del Perú", () => {
      renderLoginPage();

      // Distintivo MINEDU
      expect(screen.getByText("INSTITUCIÓN LICENCIADA POR MINEDU")).toBeInTheDocument();
      expect(screen.getByText(/Resolución Ministerial N° 409-2019-MINEDU/i)).toBeInTheDocument();

      // Footer institucional
      expect(screen.getByText('IESTP "Suiza"')).toBeInTheDocument();
      expect(screen.getByText("Dirección Regional de Educación de Ucayali")).toBeInTheDocument();
      expect(screen.getByText("REPÚBLICA DEL PERÚ")).toBeInTheDocument();
    });
  });

  describe("2. Columna Derecha — Formulario de Login", () => {
    test("Renderiza encabezado del formulario y campos requeridos con iconos", () => {
      renderLoginPage();

      // Encabezado
      expect(screen.getByRole("heading", { name: "Iniciar Sesión" })).toBeInTheDocument();
      expect(
        screen.getByText(/Ingrese sus credenciales institucionales para acceder a su casilla/i)
      ).toBeInTheDocument();

      // Campo de Usuario / DNI / Correo
      expect(screen.getByLabelText(/Usuario, DNI o Correo Institucional/i)).toBeInTheDocument();

      // Campo de Contraseña
      expect(screen.getByLabelText(/^Contraseña$/i)).toBeInTheDocument();

      // Checkbox y enlace de olvido
      expect(screen.getByLabelText(/Recordar sesión/i)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /¿Olvidó su clave\?/i })).toBeInTheDocument();

      // Botón principal
      expect(screen.getByRole("button", { name: /Ingresar/i })).toBeInTheDocument();
    });

    test("Permite alternar interactivamente la visibilidad de la contraseña", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const inputPassword = screen.getByLabelText(/^Contraseña$/i) as HTMLInputElement;
      const toggleBtn = screen.getByRole("button", { name: /Mostrar contraseña/i });

      // Estado inicial es password
      expect(inputPassword.type).toBe("password");

      // Clic para mostrar contraseña
      await user.click(toggleBtn);
      expect(inputPassword.type).toBe("text");
      expect(screen.getByRole("button", { name: /Ocultar contraseña/i })).toBeInTheDocument();

      // Clic para volver a ocultar
      await user.click(screen.getByRole("button", { name: /Ocultar contraseña/i }));
      expect(inputPassword.type).toBe("password");
    });

    test("Muestra mensaje de error cuando los campos están vacíos al enviar", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });
      await user.click(btnIngresar);

      expect(
        screen.getByText(/Por favor, ingrese su usuario, DNI o correo institucional/i)
      ).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    test("Muestra modal de asistencia al hacer clic en '¿Olvidó su clave?' y permite cerrarlo", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const forgotBtn = screen.getByRole("button", { name: /¿Olvidó su clave\?/i });
      await user.click(forgotBtn);

      expect(screen.getByRole("heading", { name: /Restablecimiento de Credenciales/i })).toBeInTheDocument();
      expect(screen.getByText(/Oficina de Tecnologías de la Información/i)).toBeInTheDocument();

      // Cerrar modal
      const closeBtn = screen.getByRole("button", { name: /Entendido/i });
      await user.click(closeBtn);

      expect(screen.queryByRole("heading", { name: /Restablecimiento de Credenciales/i })).not.toBeInTheDocument();
    });

    test("Enlace a la Mesa de Partes Virtual está presente y apunta a la ruta oficial", () => {
      renderLoginPage();

      const linkMesa = screen.getByRole("link", {
        name: /Presentar solicitud en Mesa de Partes Virtual/i,
      });
      expect(linkMesa).toBeInTheDocument();
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

  describe("4. Flujo de Autenticación y Persistencia", () => {
    test("Autentica credenciales, persiste sesión demo y redirige", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i);
      const passInput = screen.getByLabelText(/^Contraseña$/i);
      const rememberCheckbox = screen.getByLabelText(/Recordar sesión/i);
      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });

      await user.type(userInput, "70123456");
      await user.type(passInput, "ClaveSegura2026");
      await user.click(rememberCheckbox);

      await user.click(btnIngresar);

      await waitFor(() => {
        expect(window.localStorage.getItem("sigd_token")).toBeTruthy();
        expect(window.localStorage.getItem("sigd_rol")).toBe("SUPER_ADMIN");
        expect(window.localStorage.getItem("sigd_remembered_user")).toBe("70123456");
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      });
    });

    test("Permite seleccionar otro rol canónico (DOCENTE) y redirige a su destino", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i);
      const passInput = screen.getByLabelText(/^Contraseña$/i);
      const roleSelect = screen.getByLabelText(/Perfil \/ Rol Institucional Canónico/i);
      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });

      await user.type(userInput, "docente@iestpsuiza.edu.pe");
      await user.type(passInput, "Docente2026!");
      fireEvent.change(roleSelect, { target: { value: "DOCENTE" } });

      await user.click(btnIngresar);

      await waitFor(() => {
        expect(window.localStorage.getItem("sigd_rol")).toBe("DOCENTE");
        expect(mockNavigate).toHaveBeenCalledWith("/flujos/titulacion", { replace: true });
      });
    });
  });

  describe("5. Seguridad, Bloqueo de Acceso Indebido y Validación de Roles RBAC", () => {
    test("Deniega acceso con alerta visual si el usuario o DNI no existe en el sistema", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i);
      const passInput = screen.getByLabelText(/^Contraseña$/i);
      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });

      await user.type(userInput, "99998888");
      await user.type(passInput, "ClaveCualquiera123");
      await user.click(btnIngresar);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/Usuario o DNI no registrado en el sistema institucional/i)).toBeInTheDocument();
        expect(window.localStorage.getItem("sigd_token")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    test("Deniega acceso con alerta visual si la contraseña es incorrecta", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i);
      const passInput = screen.getByLabelText(/^Contraseña$/i);
      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });

      await user.type(userInput, "70123456");
      await user.type(passInput, "ClaveIncorrecta123");
      await user.click(btnIngresar);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/Contraseña incorrecta/i)).toBeInTheDocument();
        expect(window.localStorage.getItem("sigd_token")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
      });
    });

    test("Deniega acceso si el rol seleccionado en el selector no corresponde al usuario (RBAC)", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i);
      const passInput = screen.getByLabelText(/^Contraseña$/i);
      const roleSelect = screen.getByLabelText(/Perfil \/ Rol Institucional Canónico/i);
      const btnIngresar = screen.getByRole("button", { name: /Ingresar/i });

      // Usuario es SUPER_ADMIN pero se selecciona intencionalmente ESTUDIANTE
      await user.type(userInput, "70123456");
      await user.type(passInput, "ClaveSegura2026");
      fireEvent.change(roleSelect, { target: { value: "ESTUDIANTE" } });

      await user.click(btnIngresar);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
        expect(screen.getByText(/Acceso denegado \(RBAC\)/i)).toBeInTheDocument();
        expect(screen.getByText(/Su rol autorizado es 'SUPER_ADMIN'/i)).toBeInTheDocument();
        expect(window.localStorage.getItem("sigd_token")).toBeNull();
        expect(mockNavigate).not.toHaveBeenCalled();
      });

      // El botón de ajuste rápido a SUPER_ADMIN debe estar disponible en la alerta
      const btnAjustar = screen.getByRole("button", { name: /Ajustar a SUPER_ADMIN/i });
      expect(btnAjustar).toBeInTheDocument();

      // Al pulsar el botón de ajuste rápido, se sincroniza el rol y se limpia el error
      await user.click(btnAjustar);
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
      expect((roleSelect as HTMLSelectElement).value).toBe("SUPER_ADMIN");

      // Ahora reintentar login con el rol corregido debe autenticar y redirigir
      await user.click(btnIngresar);

      await waitFor(() => {
        expect(window.localStorage.getItem("sigd_token")).toBeTruthy();
        expect(window.localStorage.getItem("sigd_rol")).toBe("SUPER_ADMIN");
        expect(mockNavigate).toHaveBeenCalledWith("/", { replace: true });
      });
    });

    test("Permite alternar el panel asistente de credenciales autorizadas de prueba", async () => {
      renderLoginPage();
      const user = userEvent.setup();

      const btnAsistente = screen.getByRole("button", {
        name: /Ver usuarios de prueba autorizados \(5 Roles RBAC\)/i,
      });
      expect(btnAsistente).toBeInTheDocument();

      // Abrir acordeón
      await user.click(btnAsistente);
      expect(
        screen.getByText(/Haga clic sobre un rol para cargar automáticamente sus credenciales/i)
      ).toBeInTheDocument();

      // Cargar credenciales de MESA_PARTES con un clic
      const btnRolMesa = screen.getByRole("button", { name: /Cargar credenciales MESA_PARTES/i });
      await user.click(btnRolMesa);

      const userInput = screen.getByLabelText(/Usuario, DNI o Correo Institucional/i) as HTMLInputElement;
      const roleSelect = screen.getByLabelText(/Perfil \/ Rol Institucional Canónico/i) as HTMLSelectElement;

      expect(userInput.value).toBe("30456789");
      expect(roleSelect.value).toBe("MESA_PARTES");
    });
  });
});
