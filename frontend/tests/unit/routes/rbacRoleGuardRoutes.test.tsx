import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AppRouter from "../../../src/routes/AppRouter";
import { useAuthStore } from "../../../src/stores/authStore";

vi.mock("../../../src/pages/HomePage", () => ({ default: () => <p>Inicio público</p> }));
vi.mock("../../../src/pages/LoginPage", () => ({ default: () => <p>Login requerido</p> }));
vi.mock("../../../src/pages/AccesoDenegadoPage", () => ({ default: () => <p>Acceso denegado</p> }));
vi.mock("../../../src/pages/expedientes/BandejaExpedientesPage", () => ({ default: () => <p>Bandeja expedientes</p> }));
vi.mock("../../../src/pages/expedientes/ExpedienteDetallePage", () => ({ default: () => <p>Detalle expediente</p> }));
vi.mock("../../../src/pages/flujos/ProyectorResolucionesPage", () => ({ default: () => <p>Proyector resoluciones</p> }));
vi.mock("../../../src/pages/flujos/PasarelaFirmaPage", () => ({ default: () => <p>Pasarela firma digital</p> }));
vi.mock("../../../src/pages/tramite/VentanillaPresencialPage", () => ({ default: () => <p>Ventanilla presencial</p> }));
vi.mock("../../../src/pages/casilla/CasillaElectronicaPage", () => ({ default: () => <p>Casilla electrónica</p> }));
vi.mock("../../../src/pages/administracion/AdministracionPage", () => ({ default: () => <p>Panel administracion</p> }));
vi.mock("../../../src/pages/tesoreria/TesoreriaPage", () => ({ default: () => <p>Panel Tesorería</p> }));

function Ubicacion() {
  const location = useLocation();
  return <p data-testid="ruta-actual">{location.pathname}</p>;
}

function montar(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
      <Ubicacion />
    </MemoryRouter>,
  );
}

function sesion(rol: string, permisos: Array<{ codigo: string; ambito: string; areaId: string | null }> = []) {
  localStorage.setItem("sigd_token", "jwt-de-prueba");
  localStorage.setItem("sigd_rol", rol);
  localStorage.setItem("sigd_roles", JSON.stringify([rol]));
  localStorage.setItem("sigd_facultades", JSON.stringify(permisos));
  useAuthStore.setState({
    accessToken: "jwt-de-prueba",
    refreshToken: "ref-de-prueba",
    isAuthenticated: true,
    usuario: {
      id: "usr-unit-test",
      nombreCompleto: `Usuario ${rol}`,
      correo: `${rol.toLowerCase()}@iestp.edu.pe`,
      rol,
      roles: [rol],
      permisos: permisos as any,
    },
  });
}

describe("Matriz de Guardias de Rutas y Autorización por Rol (ENT-M05-01 / AppRouter)", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
  });

  describe("Usuarios no autenticados", () => {
    it.each([
      ["/expedientes", "Login requerido"],
      ["/flujos/proyector-resoluciones", "Login requerido"],
      ["/flujo-validez-legal/firma", "Login requerido"],
      ["/tramite/ventanilla-presencial", "Login requerido"],
      ["/administracion", "Login requerido"],
    ])("redirige %s a /login", (ruta, textoEsperado) => {
      montar(ruta);
      expect(screen.getByText(textoEsperado)).toBeInTheDocument();
      expect(screen.getByTestId("ruta-actual")).toHaveTextContent(/^\/login$/);
    });
  });

  describe("Rol CIUDADANO", () => {
    it("accede a /casilla y es rechazado de rutas internas de gestión", () => {
      sesion("CIUDADANO");
      montar("/casilla");
      expect(screen.getByText("Casilla electrónica")).toBeInTheDocument();
    });

    it.each([
      "/expedientes",
      "/flujos/proyector-resoluciones",
      "/flujo-validez-legal/firma",
      "/tramite/ventanilla-presencial",
      "/administracion",
    ])("deniega acceso a %s y redirige a /acceso-denegado", (ruta) => {
      sesion("CIUDADANO");
      montar(ruta);
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
      expect(screen.getByTestId("ruta-actual")).toHaveTextContent(/^\/acceso-denegado$/);
    });
  });

  describe("Acceso a M10 Tesorería", () => {
    it.each(["ADMINISTRADOR", "SUPER_ADMIN", "TESORERO", "CIUDADANO"])("permite la ruta autorizada a %s", (rol) => {
      sesion(rol);
      montar("/tesoreria");
      expect(screen.getByText("Panel Tesorería")).toBeInTheDocument();
    });

    it("deniega el acceso directo a un trabajador sin autorización M10", () => {
      sesion("MESA_PARTES");
      montar("/tesoreria");
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });
  });

  it("permite la ruta M10 al usuario con facultad global de administrador", () => {
    sesion("MESA_PARTES", [{ codigo: "ADMIN_USUARIOS", ambito: "GLOBAL", areaId: null }]);
    montar("/tesoreria");
    expect(screen.getByText("Panel Tesorería")).toBeInTheDocument();
  });

  describe("Rol MESA_PARTES", () => {
    it("accede a ventanilla presencial y bandeja de expedientes", () => {
      sesion("MESA_PARTES");
      montar("/tramite/ventanilla-presencial");
      expect(screen.getByText("Ventanilla presencial")).toBeInTheDocument();

      montar("/expedientes");
      expect(screen.getByText("Bandeja expedientes")).toBeInTheDocument();
    });

    it.each([
      "/flujos/proyector-resoluciones",
      "/flujo-validez-legal/firma",
      "/administracion",
    ])("deniega acceso a %s", (ruta) => {
      sesion("MESA_PARTES");
      montar(ruta);
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });
  });

  describe("Rol SECRETARIO", () => {
    it("accede a proyector de resoluciones y bandeja", () => {
      sesion("SECRETARIO");
      montar("/flujos/proyector-resoluciones");
      expect(screen.getByText("Proyector resoluciones")).toBeInTheDocument();

      montar("/expedientes");
      expect(screen.getByText("Bandeja expedientes")).toBeInTheDocument();
    });

    it.each([
      "/flujo-validez-legal/firma",
      "/tramite/ventanilla-presencial",
      "/administracion",
    ])("deniega firma, ventanilla y administración a SECRETARIO", (ruta) => {
      sesion("SECRETARIO");
      montar(ruta);
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });
  });

  describe("Rol ESPECIALISTA (Descontinuado)", () => {
    it.each([
      "/flujos/proyector-resoluciones",
      "/expedientes",
      "/flujo-validez-legal/firma",
      "/tramite/ventanilla-presencial",
      "/administracion",
    ])("deniega acceso a %s a rol descontinuado ESPECIALISTA", (ruta) => {
      sesion("ESPECIALISTA");
      montar(ruta);
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });
  });

  describe("Rol JEFE_UNIDAD_ACADEMICA", () => {
    it("accede a proyector de resoluciones y bandeja", () => {
      sesion("JEFE_UNIDAD_ACADEMICA");
      montar("/flujos/proyector-resoluciones");
      expect(screen.getByText("Proyector resoluciones")).toBeInTheDocument();

      montar("/expedientes");
      expect(screen.getByText("Bandeja expedientes")).toBeInTheDocument();
    });
  });

  describe("Rol DIRECTOR", () => {
    it("accede a pasarela de firma, proyector y bandeja", () => {
      sesion("DIRECTOR", [{ codigo: "FIRMA_FIRMAR", ambito: "GLOBAL", areaId: null }]);
      montar("/flujo-validez-legal/firma");
      expect(screen.getByText("Pasarela firma digital")).toBeInTheDocument();

      montar("/flujos/proyector-resoluciones");
      expect(screen.getByText("Proyector resoluciones")).toBeInTheDocument();

      montar("/expedientes");
      expect(screen.getByText("Bandeja expedientes")).toBeInTheDocument();
    });

    it("deniega administración institucional a DIRECTOR sin ADMIN_USUARIOS", () => {
      sesion("DIRECTOR", [{ codigo: "FIRMA_FIRMAR", ambito: "GLOBAL", areaId: null }]);
      montar("/administracion");
      expect(screen.getByText("Acceso denegado")).toBeInTheDocument();
    });
  });

  describe("Rol ADMINISTRADOR", () => {
    it("accede a administración con permiso ADMIN_USUARIOS GLOBAL", () => {
      sesion("ADMINISTRADOR", [{ codigo: "ADMIN_USUARIOS", ambito: "GLOBAL", areaId: null }]);
      montar("/administracion");
      expect(screen.getByText("Panel administracion")).toBeInTheDocument();
    });

    it("accede a Ventanilla Presencial como administrador general", () => {
      sesion("ADMINISTRADOR", [{ codigo: "ADMIN_USUARIOS", ambito: "GLOBAL", areaId: null }]);
      montar("/tramite/ventanilla-presencial");
      expect(screen.getByText("Ventanilla presencial")).toBeInTheDocument();
    });

    it("accede a firma y bandeja", () => {
      sesion("ADMINISTRADOR", [{ codigo: "ADMIN_USUARIOS", ambito: "GLOBAL", areaId: null }]);
      montar("/flujo-validez-legal/firma");
      expect(screen.getByText("Pasarela firma digital")).toBeInTheDocument();

      montar("/expedientes");
      expect(screen.getByText("Bandeja expedientes")).toBeInTheDocument();
    });
  });
});
