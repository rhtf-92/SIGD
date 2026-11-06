import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import AppRouter from "../../src/routes/AppRouter";
import LoginPage from "../../src/pages/LoginPage";
import { tienePermisoAlmacenado } from "../../src/routes/ProtectedRoute";
import { permisosIniciales } from "../../src/hooks/useRbacConfig";
import { useAuthStore } from "../../src/stores/authStore";

// Mock de todas las páginas para aislar el enrutador y observar el montaje exacto
vi.mock("../../src/pages/HomePage", () => ({
  default: () => <div data-testid="page-home">HomePage</div>,
}));
vi.mock("../../src/pages/AccesoDenegadoPage", () => ({
  default: () => <div data-testid="page-acceso-denegado">AccesoDenegadoPage</div>,
}));
vi.mock("../../src/pages/tramite/ConsultaPublicaPage", () => ({
  default: () => <div data-testid="page-consulta-publica">ConsultaPublicaPage</div>,
}));
vi.mock("../../src/pages/casilla/CasillaElectronicaPage", () => ({
  default: () => <div data-testid="page-casilla">CasillaElectronicaPage</div>,
}));
vi.mock("../../src/pages/registro/RegistroCiudadanoPage", () => ({
  default: () => <div data-testid="page-registro">RegistroCiudadanoPage</div>,
}));
vi.mock("../../src/pages/tramite/TramitePage", () => ({
  default: () => <div data-testid="page-tramite">TramitePage</div>,
}));
vi.mock("../../src/pages/tramite/VentanillaPresencialPage", () => ({
  default: () => <div data-testid="page-ventanilla">VentanillaPresencialPage</div>,
}));
vi.mock("../../src/pages/flujos/FlujoValidezLegalPage", () => ({
  default: () => <div data-testid="page-flujo-validez">FlujoValidezLegalPage</div>,
}));
vi.mock("../../src/pages/flujos/WorkflowAcademicoPage", () => ({
  default: () => <div data-testid="page-workflow-titulacion">WorkflowAcademicoPage</div>,
}));
vi.mock("../../src/pages/flujos/ProyectorResolucionesPage", () => ({
  default: () => <div data-testid="page-proyector-resoluciones">ProyectorResolucionesPage</div>,
}));
vi.mock("../../src/pages/flujos/PasarelaFirmaPage", () => ({
  default: () => <div data-testid="page-pasarela-firma">PasarelaFirmaPage</div>,
}));
vi.mock("../../src/pages/flujos/VisorCvdPage", () => ({
  default: () => <div data-testid="page-visor-cvd">VisorCvdPage</div>,
}));
vi.mock("../../src/pages/validador/ValidadorPublicoCvdPage", () => ({
  default: () => <div data-testid="page-validador-cvd">ValidadorPublicoCvdPage</div>,
}));
vi.mock("../../src/pages/expedientes/BandejaExpedientesPage", () => ({
  default: () => <div data-testid="page-bandeja-expedientes">BandejaExpedientesPage</div>,
}));
vi.mock("../../src/pages/expedientes/ExpedienteDetallePage", () => ({
  default: () => <div data-testid="page-expediente-detalle">ExpedienteDetallePage</div>,
}));
vi.mock("../../src/pages/DashboardEjecutivoPage", () => ({
  default: () => <div data-testid="page-reportes-dashboard">DashboardEjecutivoPage</div>,
}));
vi.mock("../../src/pages/administracion/AdministracionPage", () => ({
  default: () => <div data-testid="page-admin-hub">AdministracionPage</div>,
}));
vi.mock("../../src/pages/administracion/UsuariosPage", () => ({
  default: () => <div data-testid="page-admin-usuarios">UsuariosPage</div>,
}));
vi.mock("../../src/pages/administracion/RolesPermisosPage", () => ({
  default: () => <div data-testid="page-admin-roles">RolesPermisosPage</div>,
}));
vi.mock("../../src/pages/administracion/AuditoriaPage", () => ({
  default: () => <div data-testid="page-admin-auditoria">AuditoriaPage</div>,
}));
vi.mock("../../src/pages/administracion/TablasMaestrasPage", () => ({
  default: () => <div data-testid="page-admin-tablas">TablasMaestrasPage</div>,
}));
vi.mock("../../src/pages/administracion/CalendarioLaboralPage", () => ({
  default: () => <div data-testid="page-admin-calendario">CalendarioLaboralPage</div>,
}));
vi.mock("../../src/pages/administracion/SeguridadPage", () => ({
  default: () => <div data-testid="page-admin-seguridad">SeguridadPage</div>,
}));

// Rastreador de ubicación para certificar redirecciones y state.from
function LocationTracker() {
  const location = useLocation();
  return (
    <div
      data-testid="location-tracker"
      data-pathname={location.pathname}
      data-search={location.search}
      data-hash={location.hash}
      data-state={JSON.stringify(location.state ?? null)}
    />
  );
}

function renderRouter(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <LocationTracker />
      <AppRouter />
    </MemoryRouter>
  );
}

function setupUserSession(rol: string, token: string = "jwt-mock-valid-token") {
  localStorage.setItem("sigd_token", token);
  localStorage.setItem("sigd_rol", rol);
  localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
}

describe("Adversarial Verification Suite: Route Guarding & RBAC Integrity (SIGD M1)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  // =========================================================================
  // 1. ANONYMOUS VISITOR BYPASS ATTEMPTS
  // =========================================================================
  describe("1. Anonymous Visitor Bypass Attempts (0 Tokens in LocalStorage)", () => {
    const protectedRoutes = [
      { path: "/casilla", name: "Casilla Electrónica" },
      { path: "/casilla-electronica", name: "Casilla Electrónica (Alias)" },
      { path: "/tramite/ventanilla-presencial", name: "Ventanilla Presencial" },
      { path: "/ventanilla", name: "Ventanilla Presencial (Alias)" },
      { path: "/expedientes", name: "Bandeja Expedientes" },
      { path: "/expedientes/EXP-2026-0001", name: "Detalle Expediente" },
      { path: "/flujos/titulacion", name: "Workflow Titulación" },
      { path: "/flujos/proyector-resoluciones", name: "Proyector Resoluciones" },
      { path: "/flujo-validez-legal/firma", name: "Pasarela Firma Refirma" },
      { path: "/flujo-validez-legal", name: "Flujo Validez Legal" },
      { path: "/flujo-validez-legal/visor-cvd", name: "Visor CVD Interno" },
      { path: "/reportes", name: "Dashboard Reportes MGD" },
      { path: "/reportes/dashboard", name: "Dashboard Reportes (Alias)" },
      { path: "/administracion", name: "Hub Administración" },
      { path: "/administracion/seguridad", name: "Seguridad Institucional" },
      { path: "/administracion/usuarios", name: "Directorio Usuarios" },
      { path: "/administracion/roles-permisos", name: "Roles y Permisos" },
      { path: "/administracion/tablas-maestras", name: "Tablas Maestras" },
      { path: "/administracion/calendario-laboral", name: "Calendario Laboral" },
      { path: "/administracion/auditoria", name: "Bitácora Auditoría" },
      { path: "/admin", name: "Alias /admin" },
    ];

    for (const r of protectedRoutes) {
      it(`Adversarial Check: Anonymous access to ${r.path} (${r.name}) MUST redirect to /login preserving state.from`, () => {
        renderRouter(r.path);

        const tracker = screen.getByTestId("location-tracker");
        expect(tracker.getAttribute("data-pathname")).toBe("/login");

        const rawState = tracker.getAttribute("data-state");
        expect(rawState).not.toBe("null");
        const parsedState = JSON.parse(rawState || "{}");

        // Verifica que state.from preserve la ruta exacta solicitada (o su resolución canónica)
        const expectedTarget = r.path === "/admin" ? "/administracion" : r.path;
        expect(parsedState.from.pathname).toBe(expectedTarget);

        // Certifica que el contenido protegido jamás fue montado
        expect(screen.queryByTestId("page-casilla")).toBeNull();
        expect(screen.queryByTestId("page-ventanilla")).toBeNull();
        expect(screen.queryByTestId("page-bandeja-expedientes")).toBeNull();
        expect(screen.queryByTestId("page-workflow-titulacion")).toBeNull();
        expect(screen.queryByTestId("page-reportes-dashboard")).toBeNull();
        expect(screen.queryByTestId("page-admin-seguridad")).toBeNull();
        expect(screen.queryByTestId("page-admin-hub")).toBeNull();
      });
    }
  });

  // =========================================================================
  // 2. PRIVILEGE ESCALATION & ROLE RESTRICTION CHECKS
  // =========================================================================
  describe("2. RBAC Privilege Escalation & Role Boundaries (DOCENTE / ESTUDIANTE / DIRECTOR)", () => {
    it("Adversarial Check: DOCENTE trying to access /administracion/seguridad MUST be blocked (redirect to /acceso-denegado)", () => {
      setupUserSession("DOCENTE");
      renderRouter("/administracion/seguridad");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      expect(screen.queryByTestId("page-admin-seguridad")).toBeNull();
    });

    it("Adversarial Check: DOCENTE trying to access /flujos/proyector-resoluciones MUST be blocked (redirect to /acceso-denegado)", () => {
      setupUserSession("DOCENTE");
      renderRouter("/flujos/proyector-resoluciones");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      expect(screen.queryByTestId("page-proyector-resoluciones")).toBeNull();
    });

    it("Adversarial Check: DOCENTE trying to access /reportes MUST be blocked", () => {
      setupUserSession("DOCENTE");
      renderRouter("/reportes");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-reportes-dashboard")).toBeNull();
    });

    it("Legitimate Access: DOCENTE can access /flujos/titulacion and /expedientes", () => {
      setupUserSession("DOCENTE");
      renderRouter("/flujos/titulacion");
      expect(screen.getByTestId("page-workflow-titulacion")).toBeInTheDocument();

      cleanup();
      setupUserSession("DOCENTE");
      renderRouter("/expedientes");
      expect(screen.getByTestId("page-bandeja-expedientes")).toBeInTheDocument();
    });

    it("Adversarial Check: ESTUDIANTE trying to access /administracion/seguridad MUST be blocked", () => {
      setupUserSession("ESTUDIANTE");
      renderRouter("/administracion/seguridad");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-admin-seguridad")).toBeNull();
    });

    it("Adversarial Check: ESTUDIANTE trying to access /flujos/proyector-resoluciones MUST be blocked", () => {
      setupUserSession("ESTUDIANTE");
      renderRouter("/flujos/proyector-resoluciones");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-proyector-resoluciones")).toBeNull();
    });

    it("Adversarial Check: ESTUDIANTE trying to access /expedientes or /ventanilla MUST be blocked", () => {
      setupUserSession("ESTUDIANTE");
      renderRouter("/expedientes");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();

      cleanup();
      setupUserSession("ESTUDIANTE");
      renderRouter("/ventanilla");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("Legitimate Access: ESTUDIANTE can access /casilla", () => {
      setupUserSession("ESTUDIANTE");
      renderRouter("/casilla");
      expect(screen.getByTestId("page-casilla")).toBeInTheDocument();
    });

    it("Adversarial Check: DIRECTOR can access /administracion but is BLOCKED from /administracion/seguridad", () => {
      setupUserSession("DIRECTOR");
      renderRouter("/administracion");
      expect(screen.getByTestId("page-admin-hub")).toBeInTheDocument();

      cleanup();
      setupUserSession("DIRECTOR");
      renderRouter("/administracion/seguridad");
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-admin-seguridad")).toBeNull();
    });

    it("Adversarial Check: DIRECTOR is BLOCKED from /administracion/roles-permisos and /administracion/tablas-maestras", () => {
      setupUserSession("DIRECTOR");
      renderRouter("/administracion/roles-permisos");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();

      cleanup();
      setupUserSession("DIRECTOR");
      renderRouter("/administracion/tablas-maestras");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("Legitimate Access: DIRECTOR can access /flujos/proyector-resoluciones and /reportes", () => {
      setupUserSession("DIRECTOR");
      renderRouter("/flujos/proyector-resoluciones");
      expect(screen.getByTestId("page-proyector-resoluciones")).toBeInTheDocument();

      cleanup();
      setupUserSession("DIRECTOR");
      renderRouter("/reportes");
      expect(screen.getByTestId("page-reportes-dashboard")).toBeInTheDocument();
    });

    it("Legitimate Access: SUPER_ADMIN has full access to /administracion/seguridad and all submodules", () => {
      setupUserSession("SUPER_ADMIN");
      renderRouter("/administracion/seguridad");
      expect(screen.getByTestId("page-admin-seguridad")).toBeInTheDocument();

      cleanup();
      setupUserSession("SUPER_ADMIN");
      renderRouter("/administracion/roles-permisos");
      expect(screen.getByTestId("page-admin-roles")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 3. TOKEN ABSENT, CORRUPTED, OR TAMPERED STORAGE
  // =========================================================================
  describe("3. Storage Edge Cases (Absent, Corrupted Token & Tampered Permissions)", () => {
    it("Token is empty string '' -> Redirected to /login", () => {
      localStorage.setItem("sigd_token", "");
      renderRouter("/casilla");

      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/login");
      expect(screen.queryByTestId("page-casilla")).toBeNull();
    });

    it("Token present, but sigd_permisos is corrupted JSON -> Safe handling without unhandled exception, denies permission", () => {
      localStorage.setItem("sigd_token", "valid-token");
      localStorage.setItem("sigd_rol", "DOCENTE");
      localStorage.setItem("sigd_permisos", "{bad-json-malformed-data");

      // tienePermisoAlmacenado no debe arrojar error; debe retornar false
      const permiso = tienePermisoAlmacenado("Expedientes", "ver");
      expect(permiso).toBe(false);

      // En el router: ruta que exige permisos de módulo
      renderRouter("/flujos/titulacion");
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-workflow-titulacion")).toBeNull();
    });

    it("Token present, but sigd_rol is unknown forged role ('INTRUDER') -> Redirected to /acceso-denegado", () => {
      localStorage.setItem("sigd_token", "valid-token");
      localStorage.setItem("sigd_rol", "INTRUDER");
      localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));

      renderRouter("/expedientes");
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-bandeja-expedientes")).toBeNull();
    });

    it("Token present, but rol lacks permission in sigd_permisos -> Redirected to /acceso-denegado", () => {
      localStorage.setItem("sigd_token", "valid-token");
      localStorage.setItem("sigd_rol", "SUPER_ADMIN");
      // Modificamos matriz para revocar 'ver' en Expedientes
      const permisosRevocados = {
        SUPER_ADMIN: [
          { modulo: "Expedientes", ver: false, crear: true, editar: true, derivar: true, archivar: true, eliminar: true, exportar: true },
        ],
      };
      localStorage.setItem("sigd_permisos", JSON.stringify(permisosRevocados));

      renderRouter("/expedientes");
      const tracker = screen.getByTestId("location-tracker");
      expect(tracker.getAttribute("data-pathname")).toBe("/acceso-denegado");
    });
  });

  // =========================================================================
  // 4. PUBLIC ROUTES FULL ACCESSIBILITY WITHOUT TOKEN
  // =========================================================================
  describe("4. Public Routes Accessibility (100% Open to Anonymous Visitors)", () => {
    const publicRoutes = [
      { path: "/", testId: "page-home", name: "Portal Institucional" },
      { path: "/tramite", testId: "page-tramite", name: "Trámite" },
      { path: "/tramite/mesa-partes-virtual", testId: "page-tramite", name: "Mesa de Partes Virtual" },
      { path: "/tramite/mesa-partes", testId: "page-tramite", name: "Mesa de Partes (Redirect)" },
      { path: "/mesa-partes", testId: "page-tramite", name: "Mesa Partes Directo" },
      { path: "/consulta", testId: "page-consulta-publica", name: "Consulta Pública" },
      { path: "/consulta/EXP-2026-0001", testId: "page-consulta-publica", name: "Consulta CUT" },
      { path: "/validador-cvd", testId: "page-validador-cvd", name: "Validador CVD Público" },
      { path: "/registro", testId: "page-registro", name: "Registro Ciudadano" },
      { path: "/login", testId: "location-tracker", name: "Login Institucional" },
      { path: "/acceso-denegado", testId: "page-acceso-denegado", name: "Acceso Denegado" },
    ];

    for (const p of publicRoutes) {
      it(`Public Access: ${p.path} (${p.name}) is fully accessible without any token`, () => {
        renderRouter(p.path);

        if (p.path === "/login") {
          const tracker = screen.getByTestId("location-tracker");
          expect(tracker.getAttribute("data-pathname")).toBe("/login");
        } else {
          expect(screen.getByTestId(p.testId)).toBeInTheDocument();
        }
      });
    }

    it("Fallback route wildcard '*' redirects cleanly to '/' (HomePage) without errors", () => {
      renderRouter("/ruta-inexistente-totalmente-aleatoria");
      expect(screen.getByTestId("page-home")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // 5. POST-LOGIN RETURN PRESERVATION (LoginPage.tsx)
  // =========================================================================
  describe("5. Post-Login Return Preservation (LoginPage.tsx)", () => {
    it("Preserves return route when location.state.from is an object with pathname, search, and hash", async () => {
      // Mock de login exitoso en useAuthStore
      const mockLogin = vi.fn().mockImplementation(async () => {
        useAuthStore.setState({
          accessToken: "token-docente",
          usuario: {
            id: "1",
            nombreCompleto: "Profesor Prueba",
            correo: "docente@iestpsuiza.edu.pe",
            rol: "DOCENTE",
          },
          isAuthenticated: true,
        });
      });
      useAuthStore.setState({ login: mockLogin });

      const fromLocation = {
        pathname: "/flujos/titulacion",
        search: "?estudianteId=45",
        hash: "#expediente",
      };

      render(
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: fromLocation } }]}>
          <LocationTracker />
          <LoginPage />
        </MemoryRouter>
      );

      const submitButton = screen.getByRole("button", { name: /Ingresar con Credenciales/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const tracker = screen.getByTestId("location-tracker");
        expect(tracker.getAttribute("data-pathname")).toBe("/flujos/titulacion");
        expect(tracker.getAttribute("data-search")).toBe("?estudianteId=45");
        expect(tracker.getAttribute("data-hash")).toBe("#expediente");
      });
    });

    it("Preserves return route when location.state.from is a plain string", async () => {
      const mockLogin = vi.fn().mockImplementation(async () => {
        useAuthStore.setState({
          accessToken: "token-estudiante",
          usuario: {
            id: "2",
            nombreCompleto: "Estudiante Prueba",
            correo: "estudiante@iestpsuiza.edu.pe",
            rol: "ESTUDIANTE",
          },
          isAuthenticated: true,
        });
      });
      useAuthStore.setState({ login: mockLogin });

      render(
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: "/casilla" } }]}>
          <LocationTracker />
          <LoginPage />
        </MemoryRouter>
      );

      const submitButton = screen.getByRole("button", { name: /Ingresar con Credenciales/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        const tracker = screen.getByTestId("location-tracker");
        expect(tracker.getAttribute("data-pathname")).toBe("/casilla");
      });
    });

    it("Redirects to role canonical default destination when location.state.from is absent", async () => {
      const testCases = [
        { rol: "ESTUDIANTE", expected: "/casilla" },
        { rol: "DOCENTE", expected: "/flujos/titulacion" },
        { rol: "MESA_PARTES", expected: "/tramite/ventanilla-presencial" },
        { rol: "SUPER_ADMIN", expected: "/administracion" },
        { rol: "DIRECTOR", expected: "/administracion" },
      ];

      for (const tc of testCases) {
        cleanup();
        const mockLogin = vi.fn().mockImplementation(async () => {
          useAuthStore.setState({
            accessToken: `token-${tc.rol}`,
            usuario: {
              id: "99",
              nombreCompleto: "Usuario Prueba",
              correo: `${tc.rol.toLowerCase()}@iestpsuiza.edu.pe`,
              rol: tc.rol,
            },
            isAuthenticated: true,
          });
        });
        useAuthStore.setState({ login: mockLogin });

        render(
          <MemoryRouter initialEntries={["/login"]}>
            <LocationTracker />
            <LoginPage />
          </MemoryRouter>
        );

        const submitButton = screen.getByRole("button", { name: /Ingresar con Credenciales/i });
        fireEvent.click(submitButton);

        await waitFor(() => {
          const tracker = screen.getByTestId("location-tracker");
          expect(tracker.getAttribute("data-pathname")).toBe(tc.expected);
        });
      }
    });
  });
});
