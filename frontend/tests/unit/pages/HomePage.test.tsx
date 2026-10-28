import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../../../src/pages/HomePage";
import { useAuthStore } from "../../../src/stores/authStore";

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage — Segmentación visual de módulos públicos, ciudadanos e institucionales", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  afterEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  describe("1. Estructura de los tres bloques visuales", () => {
    it("renderiza el hero institucional con el título y descripción canónica", () => {
      renderHomePage();
      expect(screen.getByText("SIGD")).toBeInTheDocument();
      expect(
        screen.getByText("Sistema Integral de Gestión Documentaria")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/IESTP "Suiza" — Pucallpa/i)
      ).toBeInTheDocument();
    });

    it("renderiza los tres encabezados de bloque diferenciados", () => {
      renderHomePage();

      // Bloque A: Públicos
      expect(
        screen.getByRole("heading", {
          name: /Servicios Públicos y Consulta Ciudadana/i,
        })
      ).toBeInTheDocument();

      // Bloque B: Ciudadano
      expect(
        screen.getByRole("heading", {
          name: /Portal y Servicios del Administrado/i,
        })
      ).toBeInTheDocument();

      // Bloque C: Institucional
      expect(
        screen.getByRole("heading", {
          name: /Operación, Despacho y Gestión Interna/i,
        })
      ).toBeInTheDocument();
    });
  });

  describe("2. Reubicación y presencia de los 12 módulos", () => {
    it("muestra los 5 módulos públicos en el bloque público", () => {
      renderHomePage();

      expect(screen.getByText("Consulta Pública por CUT")).toBeInTheDocument();
      expect(screen.getByText("Registro Ciudadano")).toBeInTheDocument();
      expect(screen.getByText("Validador CVD")).toBeInTheDocument();
      expect(screen.getByText("Flujo y Validez Legal")).toBeInTheDocument();
      expect(screen.getByText("Iniciar Sesión")).toBeInTheDocument();
    });

    it("muestra los 3 módulos de cuenta ciudadana", () => {
      renderHomePage();

      expect(screen.getByText("Mesa de Partes Virtual")).toBeInTheDocument();
      expect(screen.getByText("Mis Expedientes")).toBeInTheDocument();
      expect(screen.getByText("Casilla Electrónica")).toBeInTheDocument();
    });

    it("muestra los 4 módulos institucionales por rol", () => {
      renderHomePage();

      expect(screen.getByText("Bandeja de Expedientes")).toBeInTheDocument();
      expect(screen.getByText("Ventanilla Presencial")).toBeInTheDocument();
      expect(screen.getByText("Panel de Administración")).toBeInTheDocument();
      expect(screen.getByText("Reportes y Tableros")).toBeInTheDocument();
    });
  });

  describe("3. Badges visibles por categoría", () => {
    it("muestra exactamente 5 badges 'Público'", () => {
      renderHomePage();
      const badgesPublicos = screen.getAllByText(/^Público$/);
      expect(badgesPublicos).toHaveLength(5);
    });

    it("muestra exactamente 3 badges 'Requiere login'", () => {
      renderHomePage();
      const badgesCiudadano = screen.getAllByText(/^Requiere login$/);
      expect(badgesCiudadano).toHaveLength(3);
    });

    it("muestra exactamente 4 badges 'Requiere rol institucional'", () => {
      renderHomePage();
      const badgesInstitucionales = screen.getAllByText(/^Requiere rol institucional$/);
      expect(badgesInstitucionales).toHaveLength(4);
    });
  });

  describe("4. CTAs para usuario no autenticado (fail-closed)", () => {
    it("muestra 'Iniciar sesión para acceder' en los 3 módulos de cuenta ciudadana", () => {
      renderHomePage();
      const ctasLogin = screen.getAllByText("Iniciar sesión para acceder");
      expect(ctasLogin).toHaveLength(3);
    });

    it("muestra 'Acceso con rol asignado' en los 4 módulos institucionales", () => {
      renderHomePage();
      const ctasRol = screen.getAllByText("Acceso con rol asignado");
      expect(ctasRol).toHaveLength(4);
    });

    it("muestra CTAs de acceso directo en los servicios públicos", () => {
      renderHomePage();
      expect(screen.getByText("Consultar trámite")).toBeInTheDocument();
      expect(screen.getByText("Registrar cuenta")).toBeInTheDocument();
      expect(screen.getByText("Verificar documento")).toBeInTheDocument();
      expect(screen.getByText("Ver flujo y validez")).toBeInTheDocument();
    });
  });

  describe("5. CTAs para usuario autenticado como CIUDADANO", () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: "fake-jwt-ciudadano",
        refreshToken: "fake-refresh",
        usuario: {
          id: "usr-01",
          correo: "ciudadano_demo@example.test",
          nombreCompleto: "Juan Pérez García",
          rol: "CIUDADANO",
          idPersona: "per-01",
        },
        isAuthenticated: true,
      });
    });

    it("muestra banner con sesión activa del ciudadano", () => {
      renderHomePage();
      expect(screen.getByText(/Sesión activa:/i)).toBeInTheDocument();
      expect(screen.getByText("Juan Pérez García")).toBeInTheDocument();
      expect(screen.getByText("CIUDADANO")).toBeInTheDocument();
    });

    it("habilita CTAs de acceso a los servicios de ciudadano", () => {
      renderHomePage();
      expect(screen.getByText("Acceder a Mesa de Partes")).toBeInTheDocument();
      expect(screen.getByText("Ver mis expedientes")).toBeInTheDocument();
      expect(screen.getByText("Abrir casilla electrónica")).toBeInTheDocument();
    });

    it("mantiene 'Acceso con rol asignado' en los módulos institucionales para un ciudadano", () => {
      renderHomePage();
      const ctasRol = screen.getAllByText("Acceso con rol asignado");
      expect(ctasRol).toHaveLength(4);
    });
  });

  describe("6. CTAs para usuario autenticado como ADMINISTRADOR", () => {
    beforeEach(() => {
      useAuthStore.setState({
        accessToken: "fake-jwt-admin",
        refreshToken: "fake-refresh",
        usuario: {
          id: "usr-admin",
          correo: "administrador_demo@example.test",
          nombreCompleto: "Admin General",
          rol: "ADMINISTRADOR",
          idPersona: "per-admin",
        },
        isAuthenticated: true,
      });
    });

    it("muestra CTAs de ingreso activo en los módulos institucionales permitidos para ADMINISTRADOR", () => {
      renderHomePage();
      expect(screen.getByText("Ir a bandeja institucional")).toBeInTheDocument();
      expect(screen.getByText("Abrir ventanilla presencial")).toBeInTheDocument();
      expect(screen.getByText("Ingresar a administración")).toBeInTheDocument();
      expect(screen.getByText("Ver tablero directivo")).toBeInTheDocument();
    });
  });

  describe("7. Enlaces y rutas canónicas en cada tarjeta", () => {
    it("asigna las rutas correctas a cada enlace de navegación", () => {
      renderHomePage();

      // Públicos
      expect(screen.getByRole("link", { name: /Consulta Pública por CUT/i })).toHaveAttribute("href", "/consulta");
      expect(screen.getByRole("link", { name: /Registro Ciudadano/i })).toHaveAttribute("href", "/registro");
      expect(screen.getByRole("link", { name: /Validador CVD/i })).toHaveAttribute("href", "/validador-cvd");
      expect(screen.getByRole("link", { name: /Flujo y Validez Legal/i })).toHaveAttribute("href", "/flujo-validez-legal");
      const enlacesLogin = screen.getAllByRole("link", { name: /Iniciar Sesión/i });
      expect(enlacesLogin.length).toBeGreaterThanOrEqual(1);
      expect(enlacesLogin[0]).toHaveAttribute("href", "/login");

      // Ciudadano
      expect(screen.getByRole("link", { name: /Mesa de Partes Virtual/i })).toHaveAttribute("href", "/tramite");
      expect(screen.getByRole("link", { name: /Mis Expedientes/i })).toHaveAttribute("href", "/mis-expedientes");
      expect(screen.getByRole("link", { name: /Casilla Electrónica/i })).toHaveAttribute("href", "/casilla");

      // Institucional
      expect(screen.getByRole("link", { name: /Bandeja de Expedientes/i })).toHaveAttribute("href", "/expedientes");
      expect(screen.getByRole("link", { name: /Ventanilla Presencial/i })).toHaveAttribute("href", "/tramite/ventanilla-presencial");
      expect(screen.getByRole("link", { name: /Panel de Administración/i })).toHaveAttribute("href", "/administracion");
      expect(screen.getByRole("link", { name: /Reportes y Tableros/i })).toHaveAttribute("href", "/reportes/dashboard");
    });
  });
});
