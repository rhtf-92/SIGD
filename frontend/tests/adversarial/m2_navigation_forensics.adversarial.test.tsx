import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import HeaderInstitucional from "../../src/components/HeaderInstitucional";
import HomePage from "../../src/pages/HomePage";
import { useAuthStore } from "../../src/stores/authStore";

describe("Forensic Audit M2: HeaderInstitucional & HomePage RBAC Segregation", () => {
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

  describe("HeaderInstitucional — Forensic Verification", () => {
    it("1. Visitante Anónimo (Desktop & Drawer): 0 enlaces privados expuestos", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop: enlaces públicos visibles
      expect(screen.getByRole("link", { name: /^inicio$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^trámites$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^validador$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^ingresar$/i })).toBeDefined();

      // Desktop: 0 enlaces privados
      expect(screen.queryByRole("link", { name: /^expedientes$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^casilla$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /reportes mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^administración$/i })).toBeNull();

      // Abrir menú móvil
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      // Drawer: enlaces públicos presentes
      expect(screen.getByRole("link", { name: /portal principal/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /mesa de partes virtual 24x7/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /consulta pública cut/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /validador público cvd/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /registro de administrados/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /acceso institucional/i })).toBeDefined();

      // Drawer: 0 enlaces privados presentes
      expect(screen.queryByRole("link", { name: /ventanilla presencial/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /bandeja de expedientes/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /casilla electrónica/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /flujo y validez legal/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /tablero ejecutivo mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /panel de administración/i })).toBeNull();
      expect(screen.queryByRole("button", { name: /cerrar sesión/i })).toBeNull();
    });

    it("2. Rol ESTUDIANTE: Solo ve Casilla de entre los módulos protegidos", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "est-1",
          nombreCompleto: "Juan Estudiante",
          correo: "estudiante@iestpsuiza.edu.pe",
          rol: "ESTUDIANTE",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop
      expect(screen.getByRole("link", { name: /^casilla$/i })).toBeDefined();
      expect(screen.queryByRole("link", { name: /^expedientes$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /reportes mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^administración$/i })).toBeNull();

      // Drawer
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      expect(screen.getByRole("link", { name: /casilla electrónica/i })).toBeDefined();
      expect(screen.queryByRole("link", { name: /ventanilla presencial/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /bandeja de expedientes/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /flujo y validez legal/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /tablero ejecutivo mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /panel de administración/i })).toBeNull();
    });

    it("3. Rol MESA_PARTES: Ve Ventanilla, Expedientes, Casilla, Flujo Legal; no ve Reportes ni Admin", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "mp-1",
          nombreCompleto: "Mesa Partes Operador",
          correo: "mp@iestpsuiza.edu.pe",
          rol: "MESA_PARTES",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop
      expect(screen.getByRole("link", { name: /^expedientes$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^casilla$/i })).toBeDefined();
      expect(screen.queryByRole("link", { name: /reportes mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^administración$/i })).toBeNull();

      // Drawer
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      expect(screen.getByRole("link", { name: /ventanilla presencial/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /bandeja de expedientes/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /casilla electrónica/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /flujo y validez legal/i })).toBeDefined();
      expect(screen.queryByRole("link", { name: /tablero ejecutivo mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /panel de administración/i })).toBeNull();
    });

    it("4. Rol DIRECTOR: Ve Expedientes, Casilla, Reportes, Administración; no ve Ventanilla", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "dir-1",
          nombreCompleto: "Director General",
          correo: "dir@iestpsuiza.edu.pe",
          rol: "DIRECTOR",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop
      expect(screen.getByRole("link", { name: /^expedientes$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^casilla$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /reportes mgd/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^administración$/i })).toBeDefined();

      // Drawer
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      expect(screen.queryByRole("link", { name: /ventanilla presencial/i })).toBeNull();
      expect(screen.getByRole("link", { name: /bandeja de expedientes/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /casilla electrónica/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /flujo y validez legal/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /tablero ejecutivo mgd/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /panel de administración/i })).toBeDefined();
    });

    it("5. Rol SUPER_ADMIN: Ve todos los enlaces protegidos", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "sa-1",
          nombreCompleto: "Super Admin",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop
      expect(screen.getByRole("link", { name: /^expedientes$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^casilla$/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /reportes mgd/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /^administración$/i })).toBeDefined();

      // Drawer
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      expect(screen.getByRole("link", { name: /ventanilla presencial/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /bandeja de expedientes/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /casilla electrónica/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /flujo y validez legal/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /tablero ejecutivo mgd/i })).toBeDefined();
      expect(screen.getByRole("link", { name: /panel de administración/i })).toBeDefined();
    });
  });

  describe("HomePage — Forensic Verification", () => {
    it("6. Contiene 2 secciones visuales claras con encabezados correspondientes al estar autenticado", () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "sa-1",
          nombreCompleto: "Super Admin",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      const seccionPublica = screen.getByRole("heading", {
        name: /servicios públicos a la ciudadanía/i,
      });
      const seccionInterna = screen.getByRole("heading", {
        name: /servicios internos y de gestión institucional/i,
      });

      expect(seccionPublica).toBeDefined();
      expect(seccionInterna).toBeDefined();
    });

    it("7. Sección Pública: Contiene los 4 servicios ciudadanos directos", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      const linkMpv = screen.getByRole("link", { name: /mesa de partes virtual/i });
      const linkCut = screen.getByRole("link", { name: /consulta pública y seguimiento cut/i });
      const linkCvd = screen.getByRole("link", { name: /validador público cvd \/ qr/i });
      const linkReg = screen.getByRole("link", { name: /registro de administrados/i });

      expect(linkMpv.getAttribute("href")).toBe("/tramite/mesa-partes-virtual");
      expect(linkCut.getAttribute("href")).toBe("/consulta");
      expect(linkCvd.getAttribute("href")).toBe("/validador-cvd");
      expect(linkReg.getAttribute("href")).toBe("/registro");
    });

    it("8. Sección Interna no autenticado: Módulos internos ocultos y solo muestra servicios públicos y acceso a login", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      // Los módulos internos no deben estar presentes en el DOM cuando no está autenticado
      const seccionInterna = screen.queryByRole("heading", {
        name: /servicios internos y de gestión institucional/i,
      });
      expect(seccionInterna).toBeNull();

      // En su lugar, se muestra la invitación de acceso institucional a /login
      const linkLogin = screen.getByRole("link", { name: /iniciar sesión en el sistema/i });
      expect(linkLogin.getAttribute("href")).toBe("/login");
    });

    it("9. Sección Interna autenticado: Tarjetas apuntan a sus rutas directas sin redirigir a /login", () => {
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "sa-1",
          nombreCompleto: "Super Admin",
          correo: "admin@iestpsuiza.edu.pe",
          rol: "SUPER_ADMIN",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HomePage />
        </MemoryRouter>
      );

      const linkExpedientes = screen.getByRole("link", { name: /bandeja de expedientes/i });
      expect(linkExpedientes.getAttribute("href")).toBe("/expedientes");

      const linkVentanilla = screen.getByRole("link", { name: /ventanilla presencial/i });
      expect(linkVentanilla.getAttribute("href")).toBe("/tramite/ventanilla-presencial");

      const linkReportes = screen.getByRole("link", { name: /tablero ejecutivo mgd/i });
      expect(linkReportes.getAttribute("href")).toBe("/reportes");

      const linkAdmin = screen.getByRole("link", { name: /administración institucional/i });
      expect(linkAdmin.getAttribute("href")).toBe("/administracion");

      const linkTitulacion = screen.getByRole("link", { name: /workflow académico de titulación/i });
      expect(linkTitulacion.getAttribute("href")).toBe("/flujos/titulacion");

      const linkProyector = screen.getByRole("link", { name: /proyector de resoluciones/i });
      expect(linkProyector.getAttribute("href")).toBe("/flujos/proyector-resoluciones");

      const linkFlujoLegal = screen.getByRole("link", { name: /flujo y validez legal/i });
      expect(linkFlujoLegal.getAttribute("href")).toBe("/flujo-validez-legal");
    });

    it("10. Adversarial: Rol desconocido o malicioso (e.g. 'INVITADO_ILEGAL') no obtiene acceso a ningún módulo restringido", async () => {
      const user = userEvent.setup();
      useAuthStore.setState({
        accessToken: "mock-token",
        isAuthenticated: true,
        usuario: {
          id: "fake-1",
          nombreCompleto: "Infiltrator",
          correo: "fake@external.com",
          rol: "INVITADO_ILEGAL",
        },
      });

      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      // Desktop: No debe ver expedientes, reportes ni admin
      expect(screen.queryByRole("link", { name: /^expedientes$/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /reportes mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /^administración$/i })).toBeNull();

      // Drawer: Abrir y verificar
      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      expect(screen.queryByRole("link", { name: /ventanilla presencial/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /bandeja de expedientes/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /flujo y validez legal/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /tablero ejecutivo mgd/i })).toBeNull();
      expect(screen.queryByRole("link", { name: /panel de administración/i })).toBeNull();
    });

    it("11. Adversarial: Tecla Escape cierra el Drawer móvil sin fugas", async () => {
      const user = userEvent.setup();
      render(
        <MemoryRouter initialEntries={["/"]}>
          <HeaderInstitucional />
        </MemoryRouter>
      );

      const botonMenu = screen.getByLabelText(/abrir menú principal/i);
      await user.click(botonMenu);

      // El drawer está abierto
      expect(screen.getByRole("dialog")).toBeDefined();

      // Presionar Escape
      await user.keyboard("{Escape}");

      // El drawer debe haberse cerrado
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
