import { render, screen, cleanup, fireEvent, act, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter, useLocation, Routes, Route } from "react-router-dom";
import HeaderInstitucional from "../../src/components/HeaderInstitucional";
import HomePage from "../../src/pages/HomePage";
import ConsultaPublicaPage from "../../src/pages/tramite/ConsultaPublicaPage";
import { apiClient } from "../../src/api/client";
import { useAuthStore } from "../../src/stores/authStore";

// Mock router navigate helper
const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

function setupStoreAuth(options: {
  isAuthenticated: boolean;
  rol?: string;
  nombreCompleto?: string;
  correo?: string;
}) {
  useAuthStore.setState({
    isAuthenticated: options.isAuthenticated,
    accessToken: options.isAuthenticated ? "mock-token-xyz" : null,
    refreshToken: options.isAuthenticated ? "mock-refresh-xyz" : null,
    usuario: options.isAuthenticated
      ? {
          id: "usr-001",
          nombreCompleto: options.nombreCompleto ?? "Carlos Mendoza",
          correo: options.correo ?? "cmendoza@iestpsuiza.edu.pe",
          rol: options.rol ?? "DOCENTE",
        }
      : null,
  });
}

describe("Adversarial Stress Testing: Navigation Filtering & Landing Cards (Milestone M2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      isAuthenticated: false,
      accessToken: null,
      refreshToken: null,
      usuario: null,
    });
    document.body.style.overflow = "";
  });

  afterEach(() => {
    cleanup();
    document.body.style.overflow = "";
  });

  describe("1. Dynamic Role Transitions & Auth Store Reactivity in Header", () => {
    it("1.1 Baseline Anónimo: Solo muestra enlaces públicos y oculta 100% de rutas privadas", () => {
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");

      // Enlaces públicos permitidos en Desktop
      expect(navDesktop).toHaveTextContent("Inicio");
      expect(navDesktop).toHaveTextContent("Trámites");
      expect(navDesktop).toHaveTextContent("Validador");

      // Enlaces privados estrictamente prohibidos para anónimos
      expect(navDesktop).not.toHaveTextContent("Expedientes");
      expect(navDesktop).not.toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");

      // Acciones derecha
      expect(screen.getByRole("link", { name: /ingresar/i })).toBeInTheDocument();
      expect(screen.queryByTitle("Cerrar sesión")).not.toBeInTheDocument();
    });

    it("1.2 Transición reactiva inmediata Anónimo -> ESTUDIANTE en useAuthStore sin desmontar", async () => {
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).not.toHaveTextContent("Casilla");
      expect(screen.queryByTitle("Cerrar sesión")).not.toBeInTheDocument();

      // Transición dinámica a ESTUDIANTE
      act(() => {
        setupStoreAuth({
          isAuthenticated: true,
          rol: "ESTUDIANTE",
          nombreCompleto: "Alondra Garcia",
          correo: "agarcia@estudiante.iestpsuiza.edu.pe",
        });
      });

      // El header debe reaccionar inmediatamente en el DOM
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Expedientes");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");

      // Perfil de usuario activo en Desktop
      expect(screen.getByText("Alondra Garcia")).toBeInTheDocument();
      expect(screen.getByText("ESTUDIANTE")).toBeInTheDocument();
      expect(screen.getByTitle("Cerrar sesión")).toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /ingresar/i })).not.toBeInTheDocument();
    });

    it("1.3 Transición reactiva secuencial ESTUDIANTE -> DOCENTE en useAuthStore", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "ESTUDIANTE",
        nombreCompleto: "Alondra Garcia",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Expedientes");

      // Cambio a DOCENTE
      act(() => {
        setupStoreAuth({
          isAuthenticated: true,
          rol: "DOCENTE",
          nombreCompleto: "Profesor Walter",
        });
      });

      expect(navDesktop).toHaveTextContent("Expedientes");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");
      expect(screen.getByText("Profesor Walter")).toBeInTheDocument();
      expect(screen.getByText("DOCENTE")).toBeInTheDocument();
    });

    it("1.4 Transición reactiva DOCENTE -> MESA_PARTES en useAuthStore", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "DOCENTE",
        nombreCompleto: "Profesor Walter",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).toHaveTextContent("Expedientes");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");

      // Cambio a MESA_PARTES
      act(() => {
        setupStoreAuth({
          isAuthenticated: true,
          rol: "MESA_PARTES",
          nombreCompleto: "Operador Ventanilla",
        });
      });

      expect(navDesktop).toHaveTextContent("Expedientes");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");
      expect(screen.getByText("MESA_PARTES")).toBeInTheDocument();
    });

    it("1.5 Transición reactiva MESA_PARTES -> DIRECTOR en useAuthStore", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "MESA_PARTES",
        nombreCompleto: "Operador Ventanilla",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");

      // Cambio a DIRECTOR
      act(() => {
        setupStoreAuth({
          isAuthenticated: true,
          rol: "DIRECTOR",
          nombreCompleto: "Director General",
        });
      });

      // DIRECTOR ve Expedientes, Casilla, Reportes MGD y Administración
      expect(navDesktop).toHaveTextContent("Expedientes");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).toHaveTextContent("Reportes MGD");
      expect(navDesktop).toHaveTextContent("Administración");
      expect(screen.getByText("DIRECTOR")).toBeInTheDocument();
    });

    it("1.6 Transición reactiva a SUPER_ADMIN en useAuthStore", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "SUPER_ADMIN",
        nombreCompleto: "Administrador Root",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).toHaveTextContent("Expedientes");
      expect(navDesktop).toHaveTextContent("Casilla");
      expect(navDesktop).toHaveTextContent("Reportes MGD");
      expect(navDesktop).toHaveTextContent("Administración");
      expect(screen.getByText("SUPER_ADMIN")).toBeInTheDocument();
    });

    it("1.7 Cierre de sesión reactivo: Botón de logout purga enlaces privados y redirige a /login", async () => {
      const user = userEvent.setup();
      setupStoreAuth({
        isAuthenticated: true,
        rol: "SUPER_ADMIN",
        nombreCompleto: "Administrador Root",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const logoutBtn = screen.getByTitle("Cerrar sesión");
      expect(logoutBtn).toBeInTheDocument();

      await user.click(logoutBtn);

      // useAuthStore debe estar limpio
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().usuario).toBeNull();
      expect(mockNavigate).toHaveBeenCalledWith("/login");

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      expect(navDesktop).not.toHaveTextContent("Expedientes");
      expect(navDesktop).not.toHaveTextContent("Casilla");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");
      expect(screen.getByRole("link", { name: /ingresar/i })).toBeInTheDocument();
    });

    it("1.8 Rol inesperado o malicioso: Falla cerrado a nivel de enlaces privados", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "INTRUSO_NO_AUTORIZADO",
        nombreCompleto: "Atacante Externo",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const navDesktop = screen.getByLabelText("Navegación principal de escritorio");
      // Casilla se concede a cualquier autenticado
      expect(navDesktop).toHaveTextContent("Casilla");

      // Pero los módulos con lista blanca de roles quedan cerrados
      expect(navDesktop).not.toHaveTextContent("Expedientes");
      expect(navDesktop).not.toHaveTextContent("Reportes MGD");
      expect(navDesktop).not.toHaveTextContent("Administración");
    });
  });

  describe("2. Mobile Drawer Toggle, Responsive Breakpoints & Accessibility", () => {
    it("2.1 Estado inicial del drawer: No visible, atributos ARIA correctos en el botón hamburguesa", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

      const hamburgerBtn = screen.getByRole("button", { name: /abrir menú principal/i });
      expect(hamburgerBtn).toBeInTheDocument();
      expect(hamburgerBtn).toHaveAttribute("aria-expanded", "false");
      expect(hamburgerBtn).toHaveAttribute("aria-controls", "menu-movil");
    });

    it("2.2 Apertura del drawer al pulsar hamburguesa y bloqueo de scroll en body", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const hamburgerBtn = screen.getByRole("button", { name: /abrir menú principal/i });
      await user.click(hamburgerBtn);

      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();
      expect(drawer).toHaveAttribute("id", "menu-movil");
      expect(drawer).toHaveAttribute("aria-modal", "true");

      // Botón debe cambiar etiqueta y aria-expanded
      expect(hamburgerBtn).toHaveAttribute("aria-expanded", "true");
      expect(hamburgerBtn).toHaveAttribute("aria-label", "Cerrar menú principal");

      // Body overflow bloqueado
      expect(document.body.style.overflow).toBe("hidden");
    });

    it("2.3 Cierre del drawer mediante el botón X de cabecera y desbloqueo de scroll", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      const closeBtn = screen.getByRole("button", { name: /cerrar panel de navegación/i });
      await user.click(closeBtn);

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
    });

    it("2.4 Cierre del drawer al hacer clic en el backdrop oscurecido", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();

      // Backdrop con aria-hidden="true"
      const backdrop = drawer.querySelector('div[aria-hidden="true"]');
      expect(backdrop).not.toBeNull();

      if (backdrop) {
        fireEvent.click(backdrop);
      }

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
    });

    it("2.5 Cierre accesible del drawer mediante la tecla Escape en cualquier parte del DOM", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Disparar Escape
      fireEvent.keyDown(window, { key: "Escape", code: "Escape" });

      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      expect(document.body.style.overflow).toBe("");
    });

    it("2.6 Drawer Móvil en modo anónimo: Despliega 100% de servicios públicos y oculta gestión interna", async () => {
      const user = userEvent.setup();
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Sección pública siempre visible
      expect(drawer).toHaveTextContent("Servicios Públicos a la Ciudadanía");
      expect(drawer).toHaveTextContent("Portal Principal");
      expect(drawer).toHaveTextContent("Mesa de Partes Virtual 24x7");
      expect(drawer).toHaveTextContent("Consulta Pública CUT");
      expect(drawer).toHaveTextContent("Validador Público CVD");
      expect(drawer).toHaveTextContent("Registro de Administrados");
      expect(drawer).toHaveTextContent("Acceso Institucional (Iniciar Sesión)");

      // Secciones privadas nunca visibles
      expect(drawer).not.toHaveTextContent("Gestión Operativa");
      expect(drawer).not.toHaveTextContent("Ventanilla Presencial");
      expect(drawer).not.toHaveTextContent("Bandeja de Expedientes");
      expect(drawer).not.toHaveTextContent("Flujo y Validez Legal");
      expect(drawer).not.toHaveTextContent("Dirección & Analítica MGD");
      expect(drawer).not.toHaveTextContent("Tablero Ejecutivo MGD");
      expect(drawer).not.toHaveTextContent("Panel de Administración");
    });

    it("2.7 Drawer Móvil en rol MESA_PARTES: Muestra Ventanilla Presencial y Expedientes, pero oculta Dirección", async () => {
      const user = userEvent.setup();
      setupStoreAuth({
        isAuthenticated: true,
        rol: "MESA_PARTES",
        nombreCompleto: "Operador Mesa",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Gestión Operativa visible para MESA_PARTES
      expect(drawer).toHaveTextContent("Gestión Operativa");
      expect(drawer).toHaveTextContent("Ventanilla Presencial");
      expect(drawer).toHaveTextContent("Bandeja de Expedientes");
      expect(drawer).toHaveTextContent("Casilla Electrónica");

      // Dirección & Analítica MGD oculta para MESA_PARTES
      expect(drawer).not.toHaveTextContent("Dirección & Analítica MGD");
      expect(drawer).not.toHaveTextContent("Tablero Ejecutivo MGD");
      expect(drawer).not.toHaveTextContent("Panel de Administración");

      // Botón de cerrar sesión en móvil
      expect(drawer).toHaveTextContent("Cerrar Sesión");
    });

    it("2.8 Drawer Móvil en rol DIRECTOR: Muestra Dirección y Analítica MGD, pero oculta Ventanilla Presencial", async () => {
      const user = userEvent.setup();
      setupStoreAuth({
        isAuthenticated: true,
        rol: "DIRECTOR",
        nombreCompleto: "Dra. Patricia Valenzuela",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Ventanilla Presencial oculta para DIRECTOR
      expect(drawer).not.toHaveTextContent("Ventanilla Presencial");

      // Enlaces directivos visibles
      expect(drawer).toHaveTextContent("Bandeja de Expedientes");
      expect(drawer).toHaveTextContent("Casilla Electrónica");
      expect(drawer).toHaveTextContent("Flujo y Validez Legal");
      expect(drawer).toHaveTextContent("Dirección & Analítica MGD");
      expect(drawer).toHaveTextContent("Tablero Ejecutivo MGD");
      expect(drawer).toHaveTextContent("Panel de Administración");
    });

    it("2.9 Cierre de sesión en Drawer Móvil ejecuta logout y redirige a /login", async () => {
      const user = userEvent.setup();
      setupStoreAuth({
        isAuthenticated: true,
        rol: "SUPER_ADMIN",
        nombreCompleto: "Admin Root",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      await user.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      const logoutBtnDrawer = within(drawer).getByRole("button", { name: /cerrar sesión/i });

      await user.click(logoutBtnDrawer);

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(mockNavigate).toHaveBeenCalledWith("/login");
    });

    it("2.10 Resiliencia defensiva ante datos incompletos en usuario (nombreCompleto vacío/nulo)", () => {
      setupStoreAuth({
        isAuthenticated: true,
        rol: "DOCENTE",
        nombreCompleto: "",
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // El avatar muestra "U" por defecto cuando nombreCompleto está vacío
      expect(screen.getByText("U")).toBeInTheDocument();
      expect(screen.getByText("DOCENTE")).toBeInTheDocument();
    });
  });

  describe("3. Landing Page Segregation & CUT Tracking Integration (HomePage)", () => {
    it("3.1 Estructura del Landing: Presencia de ambas secciones y tarjeta CUT pública (/consulta)", () => {
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Cabecera Sección Pública
      expect(screen.getByRole("heading", { name: "Servicios Públicos a la Ciudadanía" })).toBeInTheDocument();

      // Tarjeta Consulta Pública CUT
      const tituloCut = screen.getByRole("heading", { name: "Consulta Pública y Seguimiento CUT" });
      expect(tituloCut).toBeInTheDocument();

      // La tarjeta de Consulta CUT apunta directamente a /consulta
      const linkCut = tituloCut.closest("a");
      expect(linkCut).toHaveAttribute("href", "/consulta");
    });

    it("3.2 Las 4 tarjetas públicas apuntan directamente a sus rutas canónicas sin login", () => {
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      const tarjetasPublicasEsperadas = [
        { titulo: "Mesa de Partes Virtual", ruta: "/tramite/mesa-partes-virtual" },
        { titulo: "Consulta Pública y Seguimiento CUT", ruta: "/consulta" },
        { titulo: "Validador Público CVD / QR", ruta: "/validador-cvd" },
        { titulo: "Registro de Administrados", ruta: "/registro" },
      ];

      tarjetasPublicasEsperadas.forEach(({ titulo, ruta }) => {
        const heading = screen.getByRole("heading", { name: titulo });
        const link = heading.closest("a");
        expect(link).toHaveAttribute("href", ruta);
      });
    });

    it("3.3 En modo anónimo, los módulos internos se segregan y solo se exhiben servicios públicos e invitación a login", () => {
      setupStoreAuth({ isAuthenticated: false });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Cabecera de gestión interna NO se renderiza para anónimos
      expect(screen.queryByRole("heading", { name: "Servicios Internos y de Gestión Institucional" })).toBeNull();

      const tarjetasInternas = [
        "Flujo y Validez Legal",
        "Bandeja de Expedientes",
        "Ventanilla Presencial",
        "Workflow Académico de Titulación",
        "Proyector de Resoluciones",
        "Tablero Ejecutivo MGD",
        "Administración Institucional",
      ];

      tarjetasInternas.forEach((titulo) => {
        expect(screen.queryByRole("heading", { name: titulo })).toBeNull();
      });

      // El enlace a /login está disponible en el banner institucional
      const linkLogin = screen.getByRole("link", { name: /iniciar sesión en el sistema/i });
      expect(linkLogin).toHaveAttribute("href", "/login");
    });

    it("3.4 Verificación de disponibilidad de módulos: Ocultos en modo Anónimo y 100% operativos al Autenticar", () => {
      // Caso A: Anónimo
      setupStoreAuth({ isAuthenticated: false });

      const { rerender } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // En modo anónimo las tarjetas internas no existen en el DOM
      expect(screen.queryByRole("heading", { name: "Servicios Internos y de Gestión Institucional" })).toBeNull();

      // Caso B: Autenticado
      setupStoreAuth({ isAuthenticated: true, rol: "SUPER_ADMIN" });

      rerender(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Enlaces cambian a sus rutas reales y texto "Ingresar al módulo"
      const rutasEsperadas = [
        { titulo: "Flujo y Validez Legal", ruta: "/flujo-validez-legal" },
        { titulo: "Bandeja de Expedientes", ruta: "/expedientes" },
        { titulo: "Ventanilla Presencial", ruta: "/tramite/ventanilla-presencial" },
        { titulo: "Workflow Académico de Titulación", ruta: "/flujos/titulacion" },
        { titulo: "Proyector de Resoluciones", ruta: "/flujos/proyector-resoluciones" },
        { titulo: "Tablero Ejecutivo MGD", ruta: "/reportes" },
        { titulo: "Administración Institucional", ruta: "/administracion" },
      ];

      rutasEsperadas.forEach(({ titulo, ruta }) => {
        const heading = screen.getByRole("heading", { name: titulo });
        const link = heading.closest("a");
        expect(link).toHaveAttribute("href", ruta);
      });

      const linksIngresarModulo = screen.getAllByText("Ingresar al módulo");
      expect(linksIngresarModulo).toHaveLength(7);
      expect(screen.queryByText("Iniciar sesión")).not.toBeInTheDocument();
    });

    it("3.5 Clic en invitación a login en modo anónimo navega a /login", async () => {
      const user = userEvent.setup();
      setupStoreAuth({ isAuthenticated: false });

      function TestAppHarness() {
        const location = useLocation();
        return (
          <div>
            <HomePage />
            <div data-testid="target-route">{location.pathname}</div>
          </div>
        );
      }

      render(
        <MemoryRouter initialEntries={["/"]}>
          <TestAppHarness />
        </MemoryRouter>
      );

      const loginLink = screen.getByRole("link", { name: /iniciar sesión en el sistema/i });
      await user.click(loginLink);

      expect(screen.getByTestId("target-route")).toHaveTextContent("/login");
    });

    it("3.6 Clic en tarjeta pública 'Consulta Pública y Seguimiento CUT' navega sin state de restricción", async () => {
      const user = userEvent.setup();
      setupStoreAuth({ isAuthenticated: false });

      function TestAppHarness() {
        const location = useLocation();
        return (
          <div>
            <HomePage />
            <div data-testid="target-route">{location.pathname}</div>
            <div data-testid="target-state">{JSON.stringify(location.state)}</div>
          </div>
        );
      }

      render(
        <MemoryRouter initialEntries={["/"]}>
          <TestAppHarness />
        </MemoryRouter>
      );

      const cutHeading = screen.getByRole("heading", { name: "Consulta Pública y Seguimiento CUT" });
      const cutCard = cutHeading.closest("a")!;

      await user.click(cutCard);

      expect(screen.getByTestId("target-route")).toHaveTextContent("/consulta");
      expect(screen.getByTestId("target-state")).toHaveTextContent("null");
    });

    it("3.7 Las 7 tarjetas internas autenticadas conducen de forma directa a sus rutas canónicas sin login", async () => {
      setupStoreAuth({ isAuthenticated: true, rol: "SUPER_ADMIN" });

      const casos = [
        { titulo: "Flujo y Validez Legal", rutaEsperada: "/flujo-validez-legal" },
        { titulo: "Bandeja de Expedientes", rutaEsperada: "/expedientes" },
        { titulo: "Ventanilla Presencial", rutaEsperada: "/tramite/ventanilla-presencial" },
        { titulo: "Workflow Académico de Titulación", rutaEsperada: "/flujos/titulacion" },
        { titulo: "Proyector de Resoluciones", rutaEsperada: "/flujos/proyector-resoluciones" },
        { titulo: "Tablero Ejecutivo MGD", rutaEsperada: "/reportes" },
        { titulo: "Administración Institucional", rutaEsperada: "/administracion" },
      ];

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      for (const { titulo, rutaEsperada } of casos) {
        const cardHeading = screen.getByRole("heading", { name: titulo });
        const cardLink = cardHeading.closest("a")!;
        expect(cardLink).toHaveAttribute("href", rutaEsperada);
      }
    });

    it("3.8 Integración de Consulta CUT: Redirección desde Landing a /consulta y consulta funcional", async () => {
      const user = userEvent.setup();
      setupStoreAuth({ isAuthenticated: false });

      const spyGet = vi.spyOn(apiClient, "get").mockResolvedValueOnce({
        data: {
          cut: "EXP-2026-000142",
          anioFiscal: 2026,
          estadoTramite: "EN_TRAMITE",
          tipoTramite: "Certificado de Estudios",
          asunto: "Solicitud de Certificado Oficial",
          fechaEnvioReal: "2026-03-01T10:00:00.000Z",
          fechaRadicacionLegal: "2026-03-01T10:00:00.000Z",
          fueraDeHorario: false,
          canalRecepcion: "VIRTUAL",
          totalFolios: 3,
          administrado: {
            documentoEnmascarado: "47***123",
            nombreEnmascarado: "J*** P***",
          },
          documentos: [],
          proveidos: [],
          mensajeLegal: "Trámite recibido conforme a Ley 27444",
        },
      } as any);

      render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/consulta" element={<ConsultaPublicaPage />} />
            <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
          </Routes>
        </MemoryRouter>
      );

      // Clic en la tarjeta de CUT en el Landing
      const cutHeading = screen.getByRole("heading", { name: "Consulta Pública y Seguimiento CUT" });
      await user.click(cutHeading.closest("a")!);

      // Verificamos que aterrizamos en la página de Consulta Pública
      expect(screen.getByText("Consulta Pública de Trámites y Expedientes")).toBeInTheDocument();

      // Ingresamos un código CUT y consultamos
      const inputCut = screen.getByPlaceholderText("Ejemplo: EXP-2026-000104");
      await user.type(inputCut, "EXP-2026-000142");

      const botonConsultar = screen.getByRole("button", { name: /consultar estado/i });
      await user.click(botonConsultar);

      // handleBuscar navega canónicamente a la ruta parametrizada del expediente
      expect(mockNavigate).toHaveBeenCalledWith("/consulta/EXP-2026-000142");

      // Verificamos que montado con el parámetro :cut, la página recupera y renderiza el expediente
      cleanup();
      render(
        <MemoryRouter initialEntries={["/consulta/EXP-2026-000142"]}>
          <Routes>
            <Route path="/consulta/:cut" element={<ConsultaPublicaPage />} />
          </Routes>
        </MemoryRouter>
      );

      expect(spyGet).toHaveBeenCalledWith("/api/v1/tramites/consulta-publica/EXP-2026-000142");
      expect(await screen.findByText("Expediente Encontrado")).toBeInTheDocument();
      expect(screen.getByText("EXP-2026-000142")).toBeInTheDocument();
      expect(screen.getByText("EN_TRAMITE")).toBeInTheDocument();
      expect(screen.getByText("Solicitud de Certificado Oficial")).toBeInTheDocument();
    });
  });
});
