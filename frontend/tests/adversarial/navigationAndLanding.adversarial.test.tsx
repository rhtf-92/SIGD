import { render, screen, cleanup, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MemoryRouter, Route, Routes, useLocation, Link } from "react-router-dom";
import HeaderInstitucional from "../../src/components/HeaderInstitucional";
import HomePage from "../../src/pages/HomePage";
import { useAuthStore } from "../../src/stores/authStore";

// Helper component to observe destination pathname and navigation state upon Link click
function LocationStateObserver() {
  const location = useLocation();
  return (
    <div data-testid="location-observer">
      <span data-testid="observer-pathname">{location.pathname}</span>
      <span data-testid="observer-state">{JSON.stringify(location.state)}</span>
    </div>
  );
}

const PRIVATE_ROUTES = [
  "/expedientes",
  "/casilla",
  "/reportes",
  "/administracion",
  "/tramite/ventanilla-presencial",
  "/flujo-validez-legal",
  "/flujos/titulacion",
  "/flujos/proyector-resoluciones",
];

describe("Adversarial Empirical Testing: UI Navigation & Landing Filtering (Milestone M2)", () => {
  beforeEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = "";
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    cleanup();
    window.localStorage.clear();
    document.body.style.overflow = "";
  });

  // =========================================================================
  // SUITE 1: ANONYMOUS VISITOR & DOM PURITY IN HeaderInstitucional
  // =========================================================================
  describe("Suite 1: Anonymous Visitor Link Leakage & DOM Sanitization", () => {
    it("1.1. Desktop navbar contains strictly 0 private links for an anonymous visitor", () => {
      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Query all links inside desktop navbar
      const links = Array.from(desktopNav.querySelectorAll("a")).map((a) =>
        a.getAttribute("href")
      );

      // Verify allowed public links only
      expect(links).toEqual(["/", "/tramite", "/validador-cvd"]);

      // Verify no private routes anywhere in the rendered header
      PRIVATE_ROUTES.forEach((privRoute) => {
        const matches = container.querySelectorAll(`a[href="${privRoute}"]`);
        expect(matches.length, `Leaked private route ${privRoute}`).toBe(0);
      });

      // Verify sensitive text labels are not rendered in desktop navbar
      expect(desktopNav.textContent).not.toContain("Expedientes");
      expect(desktopNav.textContent).not.toContain("Casilla");
      expect(desktopNav.textContent).not.toContain("Reportes MGD");
      expect(desktopNav.textContent).not.toContain("Administración");

      // Verify "Ingresar" button exists
      const ingresarLink = screen.getByRole("link", { name: /ingresar/i });
      expect(ingresarLink).toBeInTheDocument();
      expect(ingresarLink.getAttribute("href")).toBe("/login");
    });

    it("1.2. Mobile drawer when opened contains strictly 0 private links for an anonymous visitor", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Drawer is initially absent from DOM
      expect(screen.queryByRole("dialog")).toBeNull();

      // Open mobile drawer
      const hamburgerBtn = screen.getByRole("button", {
        name: /abrir menú principal/i,
      });
      fireEvent.click(hamburgerBtn);

      const drawer = screen.getByRole("dialog");
      expect(drawer).toBeInTheDocument();

      // Collect all links inside mobile drawer
      const drawerLinks = Array.from(drawer.querySelectorAll("a")).map((a) =>
        a.getAttribute("href")
      );

      // Expected public links inside the drawer
      expect(drawerLinks).toContain("/login");
      expect(drawerLinks).toContain("/");
      expect(drawerLinks).toContain("/tramite/mesa-partes-virtual");
      expect(drawerLinks).toContain("/consulta");
      expect(drawerLinks).toContain("/validador-cvd");
      expect(drawerLinks).toContain("/registro");

      // Verify zero private routes exist inside the drawer
      PRIVATE_ROUTES.forEach((privRoute) => {
        const matches = drawer.querySelectorAll(`a[href="${privRoute}"]`);
        expect(
          matches.length,
          `Leaked private route ${privRoute} in mobile drawer`
        ).toBe(0);
      });

      // Verify sections "Gestión Operativa" and "Dirección & Analítica MGD" are completely absent
      expect(screen.queryByText(/gestión operativa/i)).toBeNull();
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();
    });

    it("1.3. Adversarial State Tampering: isAuthenticated=false with leftover SUPER_ADMIN user object renders 0 private links", () => {
      // Simulate dirty memory state where token is false but user object remains
      useAuthStore.setState({
        accessToken: null,
        refreshToken: null,
        isAuthenticated: false,
        usuario: {
          id: "compromised-id",
          nombreCompleto: "Injected Hacker",
          correo: "hacker@evil.org",
          rol: "SUPER_ADMIN",
        },
      });

      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // In desktop
      PRIVATE_ROUTES.forEach((privRoute) => {
        expect(container.querySelectorAll(`a[href="${privRoute}"]`).length).toBe(0);
      });

      // In mobile drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      PRIVATE_ROUTES.forEach((privRoute) => {
        expect(drawer.querySelectorAll(`a[href="${privRoute}"]`).length).toBe(0);
      });

      expect(screen.queryByText(/gestión operativa/i)).toBeNull();
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();
      expect(screen.getByRole("link", { name: /acceso institucional/i })).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 2: RBAC MATRIX IN HeaderInstitucional
  // =========================================================================
  describe("Suite 2: Role-by-Role RBAC Navigation Rendering", () => {
    it("2.1. Role ESTUDIANTE: Sees Casilla, but NOT Expedientes, Reportes, or Admin", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "est-1",
          nombreCompleto: "Ana Estudiante",
          correo: "ana@iestpsuiza.edu.pe",
          rol: "ESTUDIANTE",
        },
      });

      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Desktop: sees Casilla, does not see Expedientes, Reportes, Admin
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/expedientes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).toBeNull();

      // Open mobile drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Mobile: Gestión Operativa renders with Casilla only
      expect(screen.getByText(/gestión operativa/i)).toBeInTheDocument();
      expect(drawer.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/expedientes"]')).toBeNull();
      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).toBeNull();

      // Mobile: Dirección & Analítica is NOT rendered
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();
      expect(container.querySelectorAll('a[href="/reportes"]').length).toBe(0);
      expect(container.querySelectorAll('a[href="/administracion"]').length).toBe(0);
    });

    it("2.2. Role DOCENTE: Sees Expedientes and Casilla, but NOT Admin or Reportes", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "doc-1",
          nombreCompleto: "Carlos Docente",
          correo: "carlos@iestpsuiza.edu.pe",
          rol: "DOCENTE",
        },
      });

      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Desktop: sees Expedientes and Casilla, does not see Reportes or Admin
      expect(desktopNav.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).toBeNull();

      // Open mobile drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Mobile: Gestión Operativa has Expedientes, Casilla, Flujo Legal, but NOT Ventanilla
      expect(drawer.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).toBeNull();

      // Mobile: Dirección & Analítica is NOT rendered
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();
      expect(container.querySelectorAll('a[href="/reportes"]').length).toBe(0);
      expect(container.querySelectorAll('a[href="/administracion"]').length).toBe(0);
    });

    it("2.3. Role DIRECTOR: Sees Expedientes, Casilla, Reportes, Admin (but NOT Ventanilla)", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "dir-1",
          nombreCompleto: "Dra. Directora",
          correo: "directora@iestpsuiza.edu.pe",
          rol: "DIRECTOR",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Desktop: sees Expedientes, Casilla, Reportes, Admin
      expect(desktopNav.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).not.toBeNull();

      // Open mobile drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Mobile: Gestión Operativa has Expedientes, Casilla, Flujo Legal, but NOT Ventanilla
      expect(drawer.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).toBeNull();

      // Mobile: Dirección & Analítica has Reportes and Administracion
      expect(screen.getByText(/dirección & analítica mgd/i)).toBeInTheDocument();
      expect(drawer.querySelector('a[href="/reportes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/administracion"]')).not.toBeNull();
    });

    it("2.4. Role SUPER_ADMIN: Sees ALL links across desktop and mobile drawer", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "sa-1",
          nombreCompleto: "Super Administrador",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Desktop
      expect(desktopNav.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).not.toBeNull();

      // Open mobile drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Mobile: Gestión Operativa contains ALL 4
      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).not.toBeNull();

      // Mobile: Dirección & Analítica contains BOTH
      expect(drawer.querySelector('a[href="/reportes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/administracion"]')).not.toBeNull();
    });

    it("2.5. Role MESA_PARTES: Sees Ventanilla, Expedientes, Casilla, Flujo Legal, but NOT Reportes or Admin", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "mp-1",
          nombreCompleto: "Operador Ventanilla",
          correo: "mesa@iestpsuiza.edu.pe",
          rol: "MESA_PARTES",
        },
      });

      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Desktop: sees Expedientes and Casilla, NOT Reportes or Admin
      expect(desktopNav.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).toBeNull();

      // Mobile
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/expedientes"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).not.toBeNull();

      // Dirección is NOT rendered
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();
      expect(container.querySelectorAll('a[href="/reportes"]').length).toBe(0);
      expect(container.querySelectorAll('a[href="/administracion"]').length).toBe(0);
    });

    it("2.6. Adversarial / Unknown Role: Defaults strictly to fail-closed", () => {
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "unknown-1",
          nombreCompleto: "Infiltrado",
          correo: "infiltrado@test.pe",
          rol: "UNKNOWN_PRIVILEGED_ROLE" as any,
        },
      });

      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const desktopNav = screen.getByRole("navigation", {
        name: /navegación principal de escritorio/i,
      });

      // Only Casilla is available to generic authenticated users
      expect(desktopNav.querySelector('a[href="/casilla"]')).not.toBeNull();
      expect(desktopNav.querySelector('a[href="/expedientes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/reportes"]')).toBeNull();
      expect(desktopNav.querySelector('a[href="/administracion"]')).toBeNull();

      // Mobile
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      expect(drawer.querySelector('a[href="/tramite/ventanilla-presencial"]')).toBeNull();
      expect(drawer.querySelector('a[href="/expedientes"]')).toBeNull();
      expect(drawer.querySelector('a[href="/flujo-validez-legal"]')).toBeNull();
      expect(drawer.querySelector('a[href="/reportes"]')).toBeNull();
      expect(drawer.querySelector('a[href="/administracion"]')).toBeNull();
      expect(screen.queryByText(/dirección & analítica mgd/i)).toBeNull();

      expect(container.querySelectorAll('a[href="/administracion"]').length).toBe(0);
    });
  });

  // =========================================================================
  // SUITE 3: INTERACTIVE UX, DRAWER LIFECYCLE & LOGOUT
  // =========================================================================
  describe("Suite 3: Header Drawer Lifecycle & Logout Operations", () => {
    it("3.1. Opens drawer, closes with X button, and manages document body overflow", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      expect(document.body.style.overflow).toBe("");

      // Open
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(document.body.style.overflow).toBe("hidden");

      // Close via X button
      fireEvent.click(screen.getByRole("button", { name: /cerrar panel de navegación/i }));
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("3.2. Closes drawer with Escape key", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      fireEvent.keyDown(window, { key: "Escape" });
      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("3.3. Closes drawer when clicking the backdrop", () => {
      const { container } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Find backdrop
      const backdrop = container.querySelector(".fixed.inset-0.bg-slate-950\\/70");
      expect(backdrop).not.toBeNull();
      fireEvent.click(backdrop!);

      expect(screen.queryByRole("dialog")).toBeNull();
      expect(document.body.style.overflow).toBe("");
    });

    it("3.4. Route transition automatically dismisses the mobile drawer", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
          <Link to="/tramite" data-testid="nav-tramite-trigger">
            Ir a Trámites
          </Link>
          <Routes>
            <Route path="/" element={<div data-testid="home-view" />} />
            <Route path="/tramite" element={<div data-testid="tramite-view" />} />
          </Routes>
        </MemoryRouter>
      );

      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      expect(screen.getByRole("dialog")).toBeInTheDocument();

      // Click an external router link to change location.pathname
      fireEvent.click(screen.getByTestId("nav-tramite-trigger"));
      expect(screen.queryByRole("dialog")).toBeNull();
    });

    it("3.5. Desktop Logout: Authenticated user clicking logout clears auth state and navigates to /login", async () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "u-1",
          nombreCompleto: "Prof. Roberto Gomez",
          correo: "roberto@iestpsuiza.edu.pe",
          rol: "DOCENTE",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HeaderInstitucional />} />
            <Route path="/login" element={<div data-testid="login-landing">Login View</div>} />
          </Routes>
        </MemoryRouter>
      );

      const logoutBtn = screen.getByTitle("Cerrar sesión");
      expect(logoutBtn).toBeInTheDocument();

      fireEvent.click(logoutBtn);

      // Verify logout mutated store
      const storeState = useAuthStore.getState();
      expect(storeState.isAuthenticated).toBe(false);
      expect(storeState.usuario).toBeNull();
      expect(storeState.accessToken).toBeNull();

      // Verify redirected to /login
      expect(screen.getByTestId("login-landing")).toBeInTheDocument();
    });

    it("3.6. Mobile Drawer Logout: Authenticated user clicking Cerrar Sesión clears auth state and navigates to /login", () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "u-2",
          nombreCompleto: "Ing. Admin",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HeaderInstitucional />} />
            <Route path="/login" element={<div data-testid="login-landing">Login View</div>} />
          </Routes>
        </MemoryRouter>
      );

      // Open drawer
      fireEvent.click(screen.getByRole("button", { name: /abrir menú principal/i }));
      const drawer = screen.getByRole("dialog");

      // Click "Cerrar Sesión" inside drawer footer
      const drawerLogoutBtn = within(drawer).getByRole("button", { name: /cerrar sesión/i });
      fireEvent.click(drawerLogoutBtn);

      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(screen.getByTestId("login-landing")).toBeInTheDocument();
    });
  });

  // =========================================================================
  // SUITE 4: HomePage LANDING SEGREGATION & REDIRECTION
  // =========================================================================
  describe("Suite 4: HomePage Landing Segregation & Navigation Redirection", () => {
    it("4.1. Unauthenticated Visitor: Public services section renders 4 direct links", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Section Heading
      expect(
        screen.getByRole("heading", { name: /servicios públicos a la ciudadanía/i })
      ).toBeInTheDocument();

      // Check the 4 public links and their direct targets
      const linkMesa = screen.getByRole("link", { name: /mesa de partes virtual/i });
      expect(linkMesa.getAttribute("href")).toBe("/tramite/mesa-partes-virtual");

      const linkConsulta = screen.getByRole("link", {
        name: /consulta pública y seguimiento cut/i,
      });
      expect(linkConsulta.getAttribute("href")).toBe("/consulta");

      const linkValidador = screen.getByRole("link", {
        name: /validador público cvd \/ qr/i,
      });
      expect(linkValidador.getAttribute("href")).toBe("/validador-cvd");

      const linkRegistro = screen.getByRole("link", {
        name: /registro de administrados/i,
      });
      expect(linkRegistro.getAttribute("href")).toBe("/registro");
    });

    it("4.2. Unauthenticated Visitor: Internal cards are hidden and institutional login invitation is displayed", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // La sección de gestión interna NO se renderiza para visitantes anónimos
      expect(
        screen.queryByRole("heading", {
          name: /servicios internos y de gestión institucional/i,
        })
      ).toBeNull();

      const internalTitles = [
        "Flujo y Validez Legal",
        "Bandeja de Expedientes",
        "Ventanilla Presencial",
        "Workflow Académico de Titulación",
        "Proyector de Resoluciones",
        "Tablero Ejecutivo MGD",
        "Administración Institucional",
      ];

      // Ninguna tarjeta interna debe estar en el DOM
      internalTitles.forEach((title) => {
        expect(
          screen.queryByRole("link", {
            name: new RegExp(title, "i"),
          })
        ).toBeNull();
      });

      // El visitante anónimo ve el banner de invitación institucional para iniciar sesión
      const loginInvitation = screen.getByRole("link", {
        name: /iniciar sesión en el sistema/i,
      });
      expect(loginInvitation).toBeInTheDocument();
      expect(loginInvitation.getAttribute("href")).toBe("/login");
    });

    it("4.3. Unauthenticated Click: Clicking institutional login invitation card navigates directly to /login", async () => {
      const user = userEvent.setup();

      cleanup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LocationStateObserver />} />
          </Routes>
        </MemoryRouter>
      );

      const loginCard = screen.getByRole("link", {
        name: /iniciar sesión en el sistema/i,
      });

      await user.click(loginCard);

      // Verify navigation to /login occurred
      expect(screen.getByTestId("observer-pathname").textContent).toBe("/login");
    });

    it("4.4. Authenticated User: All 7 internal cards link directly to their destination without /login diversion", async () => {
      useAuthStore.setState({
        accessToken: "valid-jwt",
        isAuthenticated: true,
        usuario: {
          id: "u-director",
          nombreCompleto: "Directora General",
          correo: "dir@iestpsuiza.edu.pe",
          rol: "DIRECTOR",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      const internalTargets = [
        { title: "Flujo y Validez Legal", route: "/flujo-validez-legal" },
        { title: "Bandeja de Expedientes", route: "/expedientes" },
        { title: "Ventanilla Presencial", route: "/tramite/ventanilla-presencial" },
        { title: "Workflow Académico de Titulación", route: "/flujos/titulacion" },
        { title: "Proyector de Resoluciones", route: "/flujos/proyector-resoluciones" },
        { title: "Tablero Ejecutivo MGD", route: "/reportes" },
        { title: "Administración Institucional", route: "/administracion" },
      ];

      internalTargets.forEach(({ title, route }) => {
        const cardLink = screen.getByRole("link", {
          name: new RegExp(title, "i"),
        });
        // Direct route, NOT /login
        expect(cardLink.getAttribute("href")).toBe(route);
      });

      // No card should display "Iniciar sesión"
      expect(screen.queryByText(/iniciar sesión/i)).toBeNull();

      // All cards should display "Ingresar al módulo"
      const actionLabels = screen.getAllByText(/ingresar al módulo/i);
      expect(actionLabels.length).toBe(7);
    });

    it("4.5. Dynamic Auth Reactivity: Internal cards appear immediately on login and disappear on logout without reload", async () => {
      // Start unauthenticated
      useAuthStore.setState({ isAuthenticated: false, usuario: null });

      const { rerender } = render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Modo anónimo: Módulo interno ausente
      expect(screen.queryByRole("link", { name: /bandeja de expedientes/i })).toBeNull();

      // Log in
      useAuthStore.setState({
        isAuthenticated: true,
        usuario: {
          id: "test",
          nombreCompleto: "Docente",
          correo: "d@s.pe",
          rol: "DOCENTE",
        },
      });

      rerender(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Modo autenticado: Módulo interno visible y con enlace directo
      const expCardAuth = screen.getByRole("link", {
        name: /bandeja de expedientes/i,
      });
      expect(expCardAuth.getAttribute("href")).toBe("/expedientes");

      // Log out
      useAuthStore.setState({ isAuthenticated: false, usuario: null });

      rerender(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Modo logout: Módulo interno vuelve a ocultarse de inmediato
      expect(screen.queryByRole("link", { name: /bandeja de expedientes/i })).toBeNull();
    });
  });
});
