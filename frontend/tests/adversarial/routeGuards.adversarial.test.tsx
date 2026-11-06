import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter, useLocation } from "react-router-dom";
import AppRouter from "../../src/routes/AppRouter";
import { tienePermisoAlmacenado } from "../../src/routes/ProtectedRoute";
import { permisosIniciales } from "../../src/hooks/useRbacConfig";

// Mocks for all page components loaded in AppRouter
vi.mock("../../src/pages/HomePage", () => ({
  default: () => <div data-testid="page-home">HomePage</div>,
}));

vi.mock("../../src/pages/LoginPage", () => ({
  default: () => {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const loc = useLocation();
    return (
      <div data-testid="page-login">
        LoginPage
        <span data-testid="login-state">{JSON.stringify(loc.state)}</span>
      </div>
    );
  },
  ROLES_CANONICOS: [
    { id: "SUPER_ADMIN", label: "SUPER_ADMIN", destino: "/administracion" },
    { id: "DIRECTOR", label: "DIRECTOR", destino: "/administracion" },
    { id: "DOCENTE", label: "DOCENTE", destino: "/flujos/titulacion" },
    { id: "MESA_PARTES", label: "MESA_PARTES", destino: "/tramite/ventanilla-presencial" },
    { id: "ESTUDIANTE", label: "ESTUDIANTE", destino: "/casilla" },
  ],
}));

vi.mock("../../src/pages/AccesoDenegadoPage", () => ({
  default: () => <div data-testid="page-acceso-denegado">AccesoDenegado</div>,
}));

vi.mock("../../src/pages/casilla/CasillaElectronicaPage", () => ({
  default: () => <div data-testid="page-casilla">CasillaElectronicaPage</div>,
}));

vi.mock("../../src/pages/tramite/ConsultaPublicaPage", () => ({
  default: () => <div data-testid="page-consulta">ConsultaPublicaPage</div>,
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
  default: () => <div data-testid="page-validez">FlujoValidezLegalPage</div>,
}));

vi.mock("../../src/pages/flujos/WorkflowAcademicoPage", () => ({
  default: () => <div data-testid="page-workflow">WorkflowAcademicoPage</div>,
}));

vi.mock("../../src/pages/flujos/ProyectorResolucionesPage", () => ({
  default: () => <div data-testid="page-proyector">ProyectorResolucionesPage</div>,
}));

vi.mock("../../src/pages/flujos/PasarelaFirmaPage", () => ({
  default: () => <div data-testid="page-firma">PasarelaFirmaPage</div>,
}));

vi.mock("../../src/pages/flujos/VisorCvdPage", () => ({
  default: () => <div data-testid="page-visor-cvd">VisorCvdPage</div>,
}));

vi.mock("../../src/pages/validador/ValidadorPublicoCvdPage", () => ({
  default: () => <div data-testid="page-validador">ValidadorPublicoCvdPage</div>,
}));

vi.mock("../../src/pages/expedientes/BandejaExpedientesPage", () => ({
  default: () => <div data-testid="page-expedientes">BandejaExpedientesPage</div>,
}));

vi.mock("../../src/pages/expedientes/ExpedienteDetallePage", () => ({
  default: () => <div data-testid="page-expediente-detalle">ExpedienteDetallePage</div>,
}));

vi.mock("../../src/pages/DashboardEjecutivoPage", () => ({
  default: () => <div data-testid="page-reportes">DashboardEjecutivoPage</div>,
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

function setupAuth(rol?: string, token = "valid-jwt-token", customPermisos?: unknown) {
  if (token) {
    window.localStorage.setItem("sigd_token", token);
  } else {
    window.localStorage.removeItem("sigd_token");
  }

  if (rol) {
    window.localStorage.setItem("sigd_rol", rol);
  } else {
    window.localStorage.removeItem("sigd_rol");
  }

  window.localStorage.setItem(
    "sigd_permisos",
    JSON.stringify(customPermisos ?? permisosIniciales)
  );
}

function renderRoute(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <AppRouter />
    </MemoryRouter>
  );
}

describe("Adversarial Stress Testing: AppRouter & Route Guards (Milestone M1)", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
  });

  describe("1. Redirecciones y Preservación de Estado de Navegación No Autenticada", () => {
    const rutasPrivadas = [
      { path: "/casilla", expectedFrom: "/casilla" },
      { path: "/casilla-electronica", expectedFrom: "/casilla-electronica" },
      { path: "/tramite/ventanilla-presencial", expectedFrom: "/tramite/ventanilla-presencial" },
      { path: "/ventanilla", expectedFrom: "/ventanilla" },
      { path: "/expedientes", expectedFrom: "/expedientes" },
      { path: "/expedientes/EXP-2026-0001", expectedFrom: "/expedientes/EXP-2026-0001" },
      { path: "/flujos/titulacion", expectedFrom: "/flujos/titulacion" },
      { path: "/flujos/proyector-resoluciones", expectedFrom: "/flujos/proyector-resoluciones" },
      { path: "/flujo-validez-legal/firma", expectedFrom: "/flujo-validez-legal/firma" },
      { path: "/flujo-validez-legal", expectedFrom: "/flujo-validez-legal" },
      { path: "/flujo-validez-legal/visor-cvd", expectedFrom: "/flujo-validez-legal/visor-cvd" },
      { path: "/reportes", expectedFrom: "/reportes" },
      { path: "/reportes/dashboard", expectedFrom: "/reportes/dashboard" },
      { path: "/administracion", expectedFrom: "/administracion" },
      { path: "/administracion/usuarios", expectedFrom: "/administracion/usuarios" },
      { path: "/administracion/seguridad", expectedFrom: "/administracion/seguridad" },
      { path: "/administracion/roles-permisos", expectedFrom: "/administracion/roles-permisos" },
      { path: "/administracion/tablas-maestras", expectedFrom: "/administracion/tablas-maestras" },
      { path: "/administracion/calendario-laboral", expectedFrom: "/administracion/calendario-laboral" },
      { path: "/administracion/auditoria", expectedFrom: "/administracion/auditoria" },
    ];

    rutasPrivadas.forEach(({ path, expectedFrom }) => {
      it(`redirecciona intento anónimo a ${path} hacia /login preservando state.from`, () => {
        renderRoute(path);
        expect(screen.getByTestId("page-login")).toBeInTheDocument();
        const stateEl = screen.getByTestId("login-state");
        const state = JSON.parse(stateEl.textContent || "{}");
        expect(state).toHaveProperty("from");
        expect(state.from.pathname).toBe(expectedFrom);
      });
    });

    it("preserva query params y hash en state.from al redirigir a /login", () => {
      const fullUrl = "/expedientes?estado=PENDIENTE&pagina=2#seccion-actuaciones";
      renderRoute(fullUrl);
      expect(screen.getByTestId("page-login")).toBeInTheDocument();
      const stateEl = screen.getByTestId("login-state");
      const state = JSON.parse(stateEl.textContent || "{}");
      expect(state.from.pathname).toBe("/expedientes");
      expect(state.from.search).toBe("?estado=PENDIENTE&pagina=2");
      expect(state.from.hash).toBe("#seccion-actuaciones");
    });

    it("preserva rutas anidadas complejas con query params en /administracion", () => {
      const fullUrl = "/administracion/usuarios?rol=DOCENTE&q=perez";
      renderRoute(fullUrl);
      expect(screen.getByTestId("page-login")).toBeInTheDocument();
      const stateEl = screen.getByTestId("login-state");
      const state = JSON.parse(stateEl.textContent || "{}");
      expect(state.from.pathname).toBe("/administracion/usuarios");
      expect(state.from.search).toBe("?rol=DOCENTE&q=perez");
    });

    it("el alias /admin redirige a /administracion y luego a /login preservando /administracion", () => {
      renderRoute("/admin");
      expect(screen.getByTestId("page-login")).toBeInTheDocument();
      const stateEl = screen.getByTestId("login-state");
      const state = JSON.parse(stateEl.textContent || "{}");
      expect(state.from.pathname).toBe("/administracion");
    });

    it("rutas públicas permanecen accesibles sin autenticación", () => {
      const rutasPublicas = [
        { path: "/", testId: "page-home" },
        { path: "/consulta", testId: "page-consulta" },
        { path: "/consulta/EXP-2026-0001", testId: "page-consulta" },
        { path: "/registro", testId: "page-registro" },
        { path: "/tramite", testId: "page-tramite" },
        { path: "/tramite/mesa-partes-virtual", testId: "page-tramite" },
        { path: "/mesa-partes", testId: "page-tramite" },
        { path: "/validador-cvd", testId: "page-validador" },
        { path: "/acceso-denegado", testId: "page-acceso-denegado" },
      ];

      rutasPublicas.forEach(({ path, testId }) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId("page-login")).not.toBeInTheDocument();
      });
    });
  });

  describe("2. Herencia y Enforzamiento de Guardas Hijas en /administracion", () => {
    it("rol ESTUDIANTE es bloqueado tanto en /administracion como en subrutas hijas (acceso denegado)", () => {
      setupAuth("ESTUDIANTE");

      const subrutas = [
        "/administracion",
        "/administracion/usuarios",
        "/administracion/seguridad",
        "/administracion/roles-permisos",
        "/administracion/tablas-maestras",
        "/administracion/calendario-laboral",
        "/administracion/auditoria",
      ];

      subrutas.forEach((subruta) => {
        cleanup();
        renderRoute(subruta);
        expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
        expect(screen.queryByTestId("page-admin-hub")).not.toBeInTheDocument();
        expect(screen.queryByTestId("page-admin-usuarios")).not.toBeInTheDocument();
        expect(screen.queryByTestId("page-admin-seguridad")).not.toBeInTheDocument();
      });
    });

    it("rol DOCENTE es bloqueado en /administracion y subrutas", () => {
      setupAuth("DOCENTE");
      renderRoute("/administracion");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();

      cleanup();
      renderRoute("/administracion/seguridad");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("rol MESA_PARTES es bloqueado en /administracion y subrutas", () => {
      setupAuth("MESA_PARTES");
      renderRoute("/administracion");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("rol DIRECTOR puede ingresar a /administracion y /administracion/auditoria, pero es bloqueado en subrutas de configuración", () => {
      setupAuth("DIRECTOR");

      // Acceso permitido al Hub
      renderRoute("/administracion");
      expect(screen.getByTestId("page-admin-hub")).toBeInTheDocument();

      // Acceso permitido a Auditoría
      cleanup();
      renderRoute("/administracion/auditoria");
      expect(screen.getByTestId("page-admin-auditoria")).toBeInTheDocument();

      // Subrutas de configuración exclusivas de SUPER_ADMIN bloqueadas para DIRECTOR:
      const subrutasExclusivas = [
        { path: "/administracion/seguridad", testId: "page-admin-seguridad" },
        { path: "/administracion/roles-permisos", testId: "page-admin-roles" },
        { path: "/administracion/tablas-maestras", testId: "page-admin-tablas" },
        { path: "/administracion/calendario-laboral", testId: "page-admin-calendario" },
      ];

      subrutasExclusivas.forEach(({ path, testId }) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
        expect(screen.queryByTestId(testId)).not.toBeInTheDocument();
      });
    });

    it("DIRECTOR en /administracion/usuarios: denegado bajo permisos por defecto (editar=false), pero concedido si se otorga editar=true", () => {
      // Caso A: Permisos por defecto (editar=false)
      setupAuth("DIRECTOR");
      renderRoute("/administracion/usuarios");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      expect(screen.queryByTestId("page-admin-usuarios")).not.toBeInTheDocument();

      // Caso B: Permisos otorgados dinámicamente con editar=true
      cleanup();
      const permisosConcedidos = JSON.parse(JSON.stringify(permisosIniciales));
      const filaAdmin = permisosConcedidos.DIRECTOR.find((f: { modulo: string }) => f.modulo === "Administración");
      if (filaAdmin) filaAdmin.editar = true;

      setupAuth("DIRECTOR", "valid-jwt", permisosConcedidos);
      renderRoute("/administracion/usuarios");
      expect(screen.getByTestId("page-admin-usuarios")).toBeInTheDocument();
    });

    it("DOCENTE no puede ingresar a /administracion/usuarios aun si intenta falsificar permisos en localStorage", () => {
      // DOCENTE con permiso falsificado en localStorage sigue bloqueado por requiredRoles y por la guarda padre
      const permisosFalsificados = JSON.parse(JSON.stringify(permisosIniciales));
      const filaAdmin = permisosFalsificados.DOCENTE.find((f: { modulo: string }) => f.modulo === "Administración");
      if (filaAdmin) {
        filaAdmin.ver = true;
        filaAdmin.editar = true;
      }

      setupAuth("DOCENTE", "valid-jwt", permisosFalsificados);
      renderRoute("/administracion/usuarios");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      expect(screen.queryByTestId("page-admin-usuarios")).not.toBeInTheDocument();
    });

    it("rol SUPER_ADMIN tiene acceso pleno a /administracion y al 100% de las subrutas hijas", () => {
      setupAuth("SUPER_ADMIN");

      const todasLasSubrutas = [
        { path: "/administracion", testId: "page-admin-hub" },
        { path: "/administracion/usuarios", testId: "page-admin-usuarios" },
        { path: "/administracion/seguridad", testId: "page-admin-seguridad" },
        { path: "/administracion/roles-permisos", testId: "page-admin-roles" },
        { path: "/administracion/tablas-maestras", testId: "page-admin-tablas" },
        { path: "/administracion/calendario-laboral", testId: "page-admin-calendario" },
        { path: "/administracion/auditoria", testId: "page-admin-auditoria" },
      ];

      todasLasSubrutas.forEach(({ path, testId }) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
        expect(screen.queryByTestId("page-acceso-denegado")).not.toBeInTheDocument();
      });
    });
  });

  describe("3. Matriz RBAC Integral en los 5 Roles Canónicos", () => {
    it("DIRECTOR: acceso a flujos directivos y reportes; denegado en ventanilla", () => {
      setupAuth("DIRECTOR");

      // Permitidos
      const permitidos = [
        { path: "/casilla", testId: "page-casilla" },
        { path: "/expedientes", testId: "page-expedientes" },
        { path: "/flujos/titulacion", testId: "page-workflow" },
        { path: "/flujos/proyector-resoluciones", testId: "page-proyector" },
        { path: "/flujo-validez-legal/firma", testId: "page-firma" },
        { path: "/flujo-validez-legal/visor-cvd", testId: "page-visor-cvd" },
        { path: "/reportes", testId: "page-reportes" },
        { path: "/reportes/dashboard", testId: "page-reportes" },
      ];

      permitidos.forEach(({ path, testId }) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId(testId)).toBeInTheDocument();
      });

      // Denegados
      cleanup();
      renderRoute("/tramite/ventanilla-presencial");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("DOCENTE: acceso a titulación y expedientes; denegado en firmas, reportes y administración", () => {
      setupAuth("DOCENTE");

      // Permitidos
      cleanup();
      renderRoute("/casilla");
      expect(screen.getByTestId("page-casilla")).toBeInTheDocument();

      cleanup();
      renderRoute("/expedientes");
      expect(screen.getByTestId("page-expedientes")).toBeInTheDocument();

      cleanup();
      renderRoute("/flujos/titulacion");
      expect(screen.getByTestId("page-workflow")).toBeInTheDocument();

      cleanup();
      renderRoute("/flujo-validez-legal/visor-cvd");
      expect(screen.getByTestId("page-visor-cvd")).toBeInTheDocument();

      // Denegados
      const denegados = [
        "/tramite/ventanilla-presencial",
        "/flujos/proyector-resoluciones",
        "/flujo-validez-legal/firma",
        "/reportes",
        "/administracion",
      ];

      denegados.forEach((path) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      });
    });

    it("MESA_PARTES: acceso a ventanilla y expedientes; denegado en titulación, proyector y reportes", () => {
      setupAuth("MESA_PARTES");

      // Permitidos
      cleanup();
      renderRoute("/tramite/ventanilla-presencial");
      expect(screen.getByTestId("page-ventanilla")).toBeInTheDocument();

      cleanup();
      renderRoute("/ventanilla");
      expect(screen.getByTestId("page-ventanilla")).toBeInTheDocument();

      cleanup();
      renderRoute("/expedientes");
      expect(screen.getByTestId("page-expedientes")).toBeInTheDocument();

      // Denegados
      const denegados = [
        "/flujos/titulacion",
        "/flujos/proyector-resoluciones",
        "/flujo-validez-legal/firma",
        "/reportes",
        "/administracion",
      ];

      denegados.forEach((path) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      });
    });

    it("ESTUDIANTE: acceso exclusivo a casilla y consultas; denegado en todos los módulos operativos internos", () => {
      setupAuth("ESTUDIANTE");

      cleanup();
      renderRoute("/casilla");
      expect(screen.getByTestId("page-casilla")).toBeInTheDocument();

      cleanup();
      renderRoute("/casilla-electronica");
      expect(screen.getByTestId("page-casilla")).toBeInTheDocument();

      const denegados = [
        "/tramite/ventanilla-presencial",
        "/expedientes",
        "/flujos/titulacion",
        "/flujos/proyector-resoluciones",
        "/flujo-validez-legal",
        "/flujo-validez-legal/firma",
        "/reportes",
        "/administracion",
      ];

      denegados.forEach((path) => {
        cleanup();
        renderRoute(path);
        expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
      });
    });
  });

  describe("4. Resiliencia de ProtectedRoute y tienePermisoAlmacenado", () => {
    it("maneja JSON corrupto en localStorage sin lanzar excepción (falla cerrado a false)", () => {
      window.localStorage.setItem("sigd_token", "jwt");
      window.localStorage.setItem("sigd_rol", "SUPER_ADMIN");
      window.localStorage.setItem("sigd_permisos", "{corrupted_json:[");

      expect(tienePermisoAlmacenado("Administración", "ver")).toBe(false);

      renderRoute("/administracion");
      expect(screen.getByTestId("page-acceso-denegado")).toBeInTheDocument();
    });

    it("evalúa insensibilidad a mayúsculas/minúsculas en el nombre del módulo", () => {
      setupAuth("SUPER_ADMIN");
      expect(tienePermisoAlmacenado("administración", "ver")).toBe(true);
      expect(tienePermisoAlmacenado("ADMINISTRACIÓN", "ver")).toBe(true);
      expect(tienePermisoAlmacenado("Expedientes", "ver")).toBe(true);
      expect(tienePermisoAlmacenado("expedientes", "ver")).toBe(true);
    });

    it("falla cerrado si la acción o módulo no existe en la matriz", () => {
      setupAuth("SUPER_ADMIN");
      expect(tienePermisoAlmacenado("ModuloInexistente", "ver")).toBe(false);
      expect(tienePermisoAlmacenado("Expedientes", "accion_inventada")).toBe(false);
    });
  });
});
