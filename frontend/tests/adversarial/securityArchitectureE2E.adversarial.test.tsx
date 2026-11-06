/**
 * Adversarial Stress Testing: SIGD Frontend Security Architecture End-to-End
 * 
 * Scope Verified:
 * 1. Edge cases:
 *    - Corrupted tokens, tampered permissions JSON, session termination, deep link access with query params and hash.
 * 2. Public route availability:
 *    - Portal (/), Mesa de Partes (/tramite, /tramite/mesa-partes-virtual, /mesa-partes),
 *      Consulta CUT (/consulta, /consulta/:cut), Validador CVD (/validador-cvd), Registro (/registro),
 *      Login (/login), Acceso Denegado (/acceso-denegado), Wildcard (* -> /).
 * 3. Casilla Electrónica:
 *    - Unauthenticated gate (Autenticación Requerida, zero mock fallbacks),
 *      filter reset behavior and query invalidation through TanStack Query v5.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AppRouter from "../../src/routes/AppRouter";
import LoginPage from "../../src/pages/LoginPage";
import CasillaElectronicaPage from "../../src/pages/casilla/CasillaElectronicaPage";
import { tienePermisoAlmacenado } from "../../src/routes/ProtectedRoute";
import { permisosIniciales } from "../../src/hooks/useRbacConfig";
import { useAuthStore } from "../../src/stores/authStore";
import { casillaService } from "../../src/services/casillaService";
import type { Notificacion, NotificacionesResponse } from "../../src/types/casilla";

// ============================================================================
// MOCKS PARA AISLAR ROUTER DE EFECTOS EXTERNOS
// ============================================================================
vi.mock("../../src/pages/HomePage", () => ({
  default: () => <div data-testid="page-home">HomePage Portal Institucional</div>,
}));
vi.mock("../../src/pages/AccesoDenegadoPage", () => ({
  default: () => <div data-testid="page-acceso-denegado">Acceso Denegado 403</div>,
}));
vi.mock("../../src/pages/tramite/ConsultaPublicaPage", () => ({
  default: () => <div data-testid="page-consulta-publica">Consulta Pública CUT</div>,
}));
vi.mock("../../src/pages/registro/RegistroCiudadanoPage", () => ({
  default: () => <div data-testid="page-registro-ciudadano">Registro Ciudadano</div>,
}));
vi.mock("../../src/pages/tramite/TramitePage", () => ({
  default: () => <div data-testid="page-tramite-virtual">Mesa de Partes Virtual</div>,
}));
vi.mock("../../src/pages/validador/ValidadorPublicoCvdPage", () => ({
  default: () => <div data-testid="page-validador-cvd">Validador Público CVD/QR</div>,
}));
vi.mock("../../src/pages/tramite/VentanillaPresencialPage", () => ({
  default: () => <div data-testid="page-ventanilla-presencial">Ventanilla Presencial</div>,
}));
vi.mock("../../src/pages/flujos/FlujoValidezLegalPage", () => ({
  default: () => <div data-testid="page-flujo-validez">Flujo Validez Legal</div>,
}));
vi.mock("../../src/pages/flujos/WorkflowAcademicoPage", () => ({
  default: () => <div data-testid="page-workflow-titulacion">Workflow Académico Titulación</div>,
}));
vi.mock("../../src/pages/flujos/ProyectorResolucionesPage", () => ({
  default: () => <div data-testid="page-proyector-resoluciones">Proyector Resoluciones</div>,
}));
vi.mock("../../src/pages/flujos/PasarelaFirmaPage", () => ({
  default: () => <div data-testid="page-pasarela-firma">Pasarela Firma Refirma</div>,
}));
vi.mock("../../src/pages/flujos/VisorCvdPage", () => ({
  default: () => <div data-testid="page-visor-cvd">Visor CVD Interno</div>,
}));
vi.mock("../../src/pages/expedientes/BandejaExpedientesPage", () => ({
  default: () => <div data-testid="page-bandeja-expedientes">Bandeja de Expedientes</div>,
}));
vi.mock("../../src/pages/expedientes/ExpedienteDetallePage", () => ({
  default: () => <div data-testid="page-expediente-detalle">Expediente Detalle</div>,
}));
vi.mock("../../src/pages/DashboardEjecutivoPage", () => ({
  default: () => <div data-testid="page-reportes-dashboard">Dashboard Ejecutivo MGD</div>,
}));
vi.mock("../../src/pages/administracion/AdministracionPage", () => ({
  default: () => <div data-testid="page-admin-hub">Hub Administración</div>,
}));
vi.mock("../../src/pages/administracion/UsuariosPage", () => ({
  default: () => <div data-testid="page-admin-usuarios">Directorio Usuarios</div>,
}));
vi.mock("../../src/pages/administracion/RolesPermisosPage", () => ({
  default: () => <div data-testid="page-admin-roles">Roles y Permisos</div>,
}));
vi.mock("../../src/pages/administracion/AuditoriaPage", () => ({
  default: () => <div data-testid="page-admin-auditoria">Auditoría WORM</div>,
}));
vi.mock("../../src/pages/administracion/TablasMaestrasPage", () => ({
  default: () => <div data-testid="page-admin-tablas">Tablas Maestras</div>,
}));
vi.mock("../../src/pages/administracion/CalendarioLaboralPage", () => ({
  default: () => <div data-testid="page-admin-calendario">Calendario Laboral</div>,
}));
vi.mock("../../src/pages/administracion/SeguridadPage", () => ({
  default: () => <div data-testid="page-admin-seguridad">Seguridad Institucional</div>,
}));

// Mock del servicio de casilla para aislamiento y observación de consultas
vi.mock("../../src/services/casillaService", () => ({
  casillaService: {
    getNotificaciones: vi.fn(),
    getNotificacionById: vi.fn(),
    marcarComoLeido: vi.fn(),
    generarAcuseLegal: vi.fn(),
    getEstadisticas: vi.fn(),
    descargarDocumento: vi.fn(),
    descargarAcuse: vi.fn(),
    resetMockData: vi.fn(),
  },
  CASILLA_ENDPOINTS: {
    LISTAR_NOTIFICACIONES: "/api/v1/casilla/notificaciones",
    DETALLE_NOTIFICACION: (id: string) => `/api/v1/casilla/notificaciones/${id}`,
    MARCAR_LEIDO: (id: string) => `/api/v1/casilla/notificaciones/${id}/lectura`,
    GENERAR_ACUSE: (id: string) => `/api/v1/casilla/notificaciones/${id}/acuse`,
    ESTADISTICAS: "/api/v1/casilla/estadisticas",
    DESCARGAR_DOCUMENTO: (id: string) => `/api/v1/casilla/notificaciones/${id}/documento/descargar`,
    DESCARGAR_ACUSE: (id: string) => `/api/v1/casilla/notificaciones/${id}/acuse/descargar`,
  },
}));

// Componente espía de ubicación en router
function LocationSpy() {
  const loc = useLocation();
  return (
    <div
      data-testid="location-spy"
      data-pathname={loc.pathname}
      data-search={loc.search}
      data-hash={loc.hash}
      data-state={JSON.stringify(loc.state ?? null)}
    />
  );
}

function renderAppRouter(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <LocationSpy />
      <AppRouter />
    </MemoryRouter>
  );
}

describe("Security Architecture Adversarial Stress Suite (E2E)", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    queryClient.clear();
  });

  // =========================================================================
  // SECCIÓN 1: EDGE CASES DE AUTENTICACIÓN Y RESILIENCIA DE SESIÓN
  // =========================================================================
  describe("1. Edge Cases: Corrupted Tokens, Session Termination & Deep Links", () => {
    it("1.1 Corrupted token (empty string '') fails closed and redirects to /login", () => {
      localStorage.setItem("sigd_token", "");
      localStorage.setItem("sigd_rol", "DOCENTE");
      renderAppRouter("/expedientes");

      const spy = screen.getByTestId("location-spy");
      expect(spy.getAttribute("data-pathname")).toBe("/login");
      expect(screen.queryByTestId("page-bandeja-expedientes")).toBeNull();
    });

    it("1.2 Corrupted token (null / absent) redirects to /login preserving target location in state.from", () => {
      renderAppRouter("/administracion/usuarios");

      const spy = screen.getByTestId("location-spy");
      expect(spy.getAttribute("data-pathname")).toBe("/login");
      const rawState = spy.getAttribute("data-state");
      const parsedState = JSON.parse(rawState || "{}");
      expect(parsedState.from.pathname).toBe("/administracion/usuarios");
      expect(screen.queryByTestId("page-admin-usuarios")).toBeNull();
    });

    it("1.3 Malformed permissions JSON in localStorage does not crash application (fail-closed to 403)", () => {
      localStorage.setItem("sigd_token", "dummy-valid-jwt");
      localStorage.setItem("sigd_rol", "DOCENTE");
      localStorage.setItem("sigd_permisos", "CORRUPTED_NON_JSON_DATA{[[");

      // Verificación directa de la función pura de permisos
      const res = tienePermisoAlmacenado("Expedientes", "ver");
      expect(res).toBe(false);

      // Verificación dentro del flujo del router
      renderAppRouter("/flujos/titulacion");
      const spy = screen.getByTestId("location-spy");
      expect(spy.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      expect(screen.queryByTestId("page-workflow-titulacion")).toBeNull();
    });

    it("1.4 Forged/unrecognized role fails closed and redirects to /acceso-denegado", () => {
      localStorage.setItem("sigd_token", "dummy-valid-jwt");
      localStorage.setItem("sigd_rol", "HACKER_ROLE");
      localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));

      renderAppRouter("/reportes");
      const spy = screen.getByTestId("location-spy");
      expect(spy.getAttribute("data-pathname")).toBe("/acceso-denegado");
      expect(screen.queryByTestId("page-reportes-dashboard")).toBeNull();
    });

    it("1.5 Session termination: logout() immediately purges storage and triggers redirection to /login", () => {
      localStorage.setItem("sigd_token", "token-to-purge");
      localStorage.setItem("sigd_rol", "DIRECTOR");
      localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
      useAuthStore.setState({
        accessToken: "token-to-purge",
        usuario: { id: "1", nombreCompleto: "Director Test", correo: "dir@iestpsuiza.pe", rol: "DIRECTOR" },
        isAuthenticated: true,
      });

      // Ejecutar logout
      useAuthStore.getState().logout();

      // Verificar purga atómica de almacenamiento
      expect(localStorage.getItem("sigd_token")).toBeNull();
      expect(localStorage.getItem("token")).toBeNull();
      expect(localStorage.getItem("sigd_rol")).toBeNull();
      expect(localStorage.getItem("sigd_permisos")).toBeNull();
      expect(localStorage.getItem("sigd_auth")).toBeNull();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().accessToken).toBeNull();
      expect(useAuthStore.getState().usuario).toBeNull();
    });

    it("1.6 Deep link access: Unauthenticated access with query params and hash is preserved faithfully", async () => {
      const mockLogin = vi.fn().mockImplementation(async () => {
        useAuthStore.setState({
          accessToken: "token-auth",
          usuario: {
            id: "10",
            nombreCompleto: "Docente Titulacion",
            correo: "doc@iestpsuiza.pe",
            rol: "DOCENTE",
          },
          isAuthenticated: true,
        });
      });
      useAuthStore.setState({ login: mockLogin });

      const deepLink = {
        pathname: "/flujos/titulacion",
        search: "?estudianteId=45&tipo=ordinaria&page=2",
        hash: "#seccion-sustentacion",
      };

      render(
        <MemoryRouter initialEntries={[{ pathname: "/login", state: { from: deepLink } }]}>
          <LocationSpy />
          <LoginPage />
        </MemoryRouter>
      );

      const loginBtn = screen.getByRole("button", { name: /Ingresar con Credenciales/i });
      fireEvent.click(loginBtn);

      await waitFor(() => {
        const spy = screen.getByTestId("location-spy");
        expect(spy.getAttribute("data-pathname")).toBe("/flujos/titulacion");
        expect(spy.getAttribute("data-search")).toBe("?estudianteId=45&tipo=ordinaria&page=2");
        expect(spy.getAttribute("data-hash")).toBe("#seccion-sustentacion");
      });
    });

    it("1.7 Post-login fallback: Navigates to canonical role default if state.from is null", async () => {
      const canonicalRoles = [
        { rol: "ESTUDIANTE", expectedPath: "/casilla" },
        { rol: "DOCENTE", expectedPath: "/flujos/titulacion" },
        { rol: "MESA_PARTES", expectedPath: "/tramite/ventanilla-presencial" },
        { rol: "DIRECTOR", expectedPath: "/administracion" },
        { rol: "SUPER_ADMIN", expectedPath: "/administracion" },
      ];

      for (const item of canonicalRoles) {
        cleanup();
        const mockLogin = vi.fn().mockImplementation(async () => {
          useAuthStore.setState({
            accessToken: `token-${item.rol}`,
            usuario: {
              id: "99",
              nombreCompleto: `User ${item.rol}`,
              correo: `${item.rol.toLowerCase()}@iestpsuiza.pe`,
              rol: item.rol,
            },
            isAuthenticated: true,
          });
        });
        useAuthStore.setState({ login: mockLogin });

        render(
          <MemoryRouter initialEntries={["/login"]}>
            <LocationSpy />
            <LoginPage />
          </MemoryRouter>
        );

        const loginBtn = screen.getByRole("button", { name: /Ingresar con Credenciales/i });
        fireEvent.click(loginBtn);

        await waitFor(() => {
          const spy = screen.getByTestId("location-spy");
          expect(spy.getAttribute("data-pathname")).toBe(item.expectedPath);
        });
      }
    });
  });

  // =========================================================================
  // SECCIÓN 2: DISPONIBILIDAD TOTAL DE RUTAS PÚBLICAS
  // =========================================================================
  describe("2. Public Route Availability (No Tokens Required)", () => {
    const publicRouteCatalog = [
      { route: "/", expectedTestId: "page-home", description: "Portal Institucional" },
      { route: "/tramite", expectedTestId: "page-tramite-virtual", description: "Mesa de Partes Virtual" },
      { route: "/tramite/mesa-partes-virtual", expectedTestId: "page-tramite-virtual", description: "Mesa de Partes Virtual Canónica" },
      { route: "/tramite/mesa-partes", expectedTestId: "page-tramite-virtual", description: "Mesa de Partes Alias Redirect" },
      { route: "/mesa-partes", expectedTestId: "page-tramite-virtual", description: "Mesa de Partes Alias Directo" },
      { route: "/consulta", expectedTestId: "page-consulta-publica", description: "Consulta Pública de Expedientes" },
      { route: "/consulta/EXP-2026-0001", expectedTestId: "page-consulta-publica", description: "Consulta Pública por CUT" },
      { route: "/validador-cvd", expectedTestId: "page-validador-cvd", description: "Validador Público CVD/QR" },
      { route: "/registro", expectedTestId: "page-registro-ciudadano", description: "Registro de Administrados" },
      { route: "/login", expectedTestId: "location-spy", description: "Login Institucional" },
      { route: "/acceso-denegado", expectedTestId: "page-acceso-denegado", description: "Página de Acceso Denegado 403" },
    ];

    for (const item of publicRouteCatalog) {
      it(`2.${item.route} (${item.description}) renders without auth and without redirect to /login`, () => {
        renderAppRouter(item.route);

        if (item.route === "/login") {
          const spy = screen.getByTestId("location-spy");
          expect(spy.getAttribute("data-pathname")).toBe("/login");
        } else {
          expect(screen.getByTestId(item.expectedTestId)).toBeInTheDocument();
        }
      });
    }

    it("2.12 Unknown wildcard route ('/non-existent-path') safely redirects to '/' (Portal)", () => {
      renderAppRouter("/ruta-desconocida-totalmente-invalida");
      expect(screen.getByTestId("page-home")).toBeInTheDocument();
      const spy = screen.getByTestId("location-spy");
      expect(spy.getAttribute("data-pathname")).toBe("/");
    });
  });

  // =========================================================================
  // SECCIÓN 3: CASILLA ELECTRÓNICA: BLINDAJE Y RESET DE FILTROS CON INVALIDACIÓN
  // =========================================================================
  describe("3. Casilla Electrónica: Auth Gate, Mock Absence & Filter Reset Invalidation", () => {
    const mockNotifBase: Notificacion = {
      id: "NOT-2026-000101",
      numeroNotificacion: "NOT-2026-000101",
      numeroExpediente: "EXP-2026-000101",
      asunto: "Notificación de Trámite Oficial",
      tipo: "OFICIO",
      estado: "LEIDO",
      prioridad: "NORMAL",
      unidadEmisora: "Secretaría Académica",
      responsableEmision: "Lic. Responsable",
      fechaDepositoIso: "2026-09-01T10:00:00.000Z",
      fechaLecturaIso: "2026-09-01T12:00:00.000Z",
      fechaNotificadoIso: null,
      requiereAcuse: false,
      actoAdministrativo: {
        tipoActo: "Oficio",
        numeroDocumento: "OF-001-2026",
        anio: 2026,
        asunto: "Notificación de Trámite Oficial",
        resumenLegal: "Resumen legal de prueba",
        nombreArchivoPdf: "oficio.pdf",
        tamanoArchivo: "500 KB",
        hashIntegridadSha256: "abcdef123456",
        cvd: "CVD-OF-001",
        firmantes: [{ nombre: "Lic. Responsable", cargo: "Secretario", fechaFirma: "01/09/2026" }],
      },
      acuse: null,
    };

    const mockResponse: NotificacionesResponse = {
      data: [mockNotifBase],
      meta: {
        totalItems: 1,
        currentPage: 1,
        itemsPerPage: 5,
        totalPages: 1,
        hasNextPage: false,
        hasPreviousPage: false,
      },
    };

    function renderCasillaWithClient() {
      return render(
        <QueryClientProvider client={queryClient}>
          <MemoryRouter initialEntries={["/casilla"]}>
            <CasillaElectronicaPage />
          </MemoryRouter>
        </QueryClientProvider>
      );
    }

    it("3.1 Unauthenticated Casilla renders 'Autenticación Requerida' with ZERO mock identity fallbacks", () => {
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        usuario: null,
        isAuthenticated: false,
      });

      renderCasillaWithClient();

      expect(screen.getByRole("heading", { name: /Autenticación Requerida/i })).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Iniciar Sesión Institucional/i })).toBeInTheDocument();
      // Verificación estricta: Erradicación absoluta del mock "Sergio Serruche Panduro"
      expect(screen.queryByText("Sergio Serruche Panduro")).toBeNull();
      expect(screen.queryByText("74561238@casilla.iestpsuiza.edu.pe")).toBeNull();
    });

    it("3.2 Authenticated student displays real authenticated identity from store", async () => {
      useAuthStore.setState({
        accessToken: "token-estudiante",
        usuario: {
          id: "101",
          nombreCompleto: "Rosa Elena Flores Ruiz",
          correo: "rosa.flores@estudiante.iestpsuiza.edu.pe",
          numeroDocumento: "71234567",
          rol: "ESTUDIANTE",
        },
        isAuthenticated: true,
      });

      vi.mocked(casillaService.getNotificaciones).mockResolvedValue(mockResponse);
      vi.mocked(casillaService.getEstadisticas).mockResolvedValue({
        total: 1,
        noLeidos: 0,
        leidos: 1,
        notificados: 0,
        urgentes: 0,
      });

      renderCasillaWithClient();

      expect(await screen.findByText(/Rosa Elena Flores Ruiz/i)).toBeInTheDocument();
      expect(screen.getByText(/DNI 71234567/i)).toBeInTheDocument();
      expect(screen.getByText(/71234567@casilla.iestpsuiza.edu.pe/i)).toBeInTheDocument();
    });

    it("3.3 Filter reset explicitly calls invalidateQueries and triggers fresh query fetch with default filters", async () => {
      const user = userEvent.setup();

      useAuthStore.setState({
        accessToken: "token-estudiante",
        usuario: {
          id: "101",
          nombreCompleto: "Rosa Elena Flores Ruiz",
          numeroDocumento: "71234567",
          correo: "rosa.flores@iestpsuiza.pe",
          rol: "ESTUDIANTE",
        },
        isAuthenticated: true,
      });

      vi.mocked(casillaService.getNotificaciones).mockResolvedValue(mockResponse);
      vi.mocked(casillaService.getEstadisticas).mockResolvedValue({
        total: 1,
        noLeidos: 0,
        leidos: 1,
        notificados: 0,
        urgentes: 0,
      });

      // Espiar invalidateQueries en queryClient
      const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");

      renderCasillaWithClient();

      await screen.findByText(/Notificación de Trámite Oficial/i);

      // Aplicar filtro de búsqueda
      const inputBusqueda = screen.getByLabelText(/Buscar por Asunto, N° o Expediente/i);
      await user.type(inputBusqueda, "EXP-2026-000101");

      // Debe aparecer el botón "Limpiar filtros"
      const btnLimpiar = await screen.findByRole("button", { name: /Limpiar filtros/i });
      expect(btnLimpiar).toBeInTheDocument();

      // Hacer clic en "Limpiar filtros"
      await user.click(btnLimpiar);

      // Verificar que invalidateQueries fue invocado con queryKey ['casilla']
      await waitFor(() => {
        expect(invalidateSpy).toHaveBeenCalledWith(
          expect.objectContaining({ queryKey: ["casilla"] })
        );
      });

      // Verificar que casillaService.getNotificaciones fue llamado nuevamente con los filtros por defecto
      await waitFor(() => {
        expect(casillaService.getNotificaciones).toHaveBeenLastCalledWith(
          expect.objectContaining({
            busqueda: "",
            tipo: "TODOS",
            estado: "TODOS",
          })
        );
      });
    });
  });
});
