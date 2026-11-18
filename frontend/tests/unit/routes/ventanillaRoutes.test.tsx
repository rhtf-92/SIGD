import { render, screen } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import VentanillaPresencialPage from "../../../src/pages/tramite/VentanillaPresencialPage";
import AppRouter from "../../../src/routes/AppRouter";
import { useAuthStore, type UsuarioPerfil } from "../../../src/stores/authStore";

// Se usa AppRouter y ProtectedRoute reales; las páginas se sustituyen para no realizar peticiones.
vi.mock("../../../src/pages/tramite/VentanillaPresencialPage", () => ({
  default: vi.fn(() => <p>Ventanilla presencial</p>),
}));
vi.mock("../../../src/pages/LoginPage", () => ({ default: () => <p>Login institucional</p> }));
vi.mock("../../../src/pages/AccesoDenegadoPage", () => ({ default: () => <p>Acceso denegado</p> }));
vi.mock("../../../src/pages/HomePage", () => ({ default: () => <p>Inicio público</p> }));
vi.mock("../../../src/pages/tramite/MesaPartesVirtualPage", () => ({ default: () => <p>Mesa de partes virtual</p> }));
vi.mock("../../../src/pages/tramite/ConsultaPublicaPage", () => ({ default: () => <p>Consulta pública</p> }));
vi.mock("../../../src/pages/casilla/CasillaElectronicaPage", () => ({ default: () => <p>Casilla electrónica</p> }));

const rutasVentanilla = ["/tramite/ventanilla-presencial", "/ventanilla"];
const originalAdapter = apiClient.defaults.adapter;

function Ubicacion() {
  const location = useLocation();
  return <>
    <p data-testid="ruta">{location.pathname}</p>
    <p data-testid="origen">{location.state?.from?.pathname ?? ""}</p>
  </>;
}

function abrir(ruta: string) {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <AppRouter />
      <Ubicacion />
    </MemoryRouter>,
  );
}

async function autenticar(rol: UsuarioPerfil["rol"]) {
  // Respuesta del backend doble, sin generar JWT ni registrar usuarios o sesiones reales.
  vi.spyOn(apiClient, "post").mockResolvedValueOnce({ data: {
    accessToken: "access-del-doble",
    refreshToken: "refresh-del-doble",
    usuario: { id: "operador-del-doble", nombreCompleto: "Operador", correo: "operador@example.test", rol },
  } });
  await useAuthStore.getState().login({ identificador: "operador@example.test", password: "solo-doble" });
}

describe("Rutas de Ventanilla Presencial en AppRouter", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.mocked(VentanillaPresencialPage).mockClear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    // Una llamada accidental no puede salir a la red.
    apiClient.defaults.adapter = async () => { throw new Error("Petición inesperada"); };
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    localStorage.clear();
    sessionStorage.clear();
  });

  it.each(rutasVentanilla)("redirige %s sin sesión al login y conserva la ruta de origen", async (ruta) => {
    abrir(ruta);
    expect(await screen.findByText("Login institucional")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/login$/);
    expect(screen.getByTestId("origen")).toHaveTextContent(ruta);
    expect(screen.queryByText("Ventanilla presencial")).not.toBeInTheDocument();
    expect(VentanillaPresencialPage).not.toHaveBeenCalled();
  });

  it.each(rutasVentanilla)("permite %s con el MESA_PARTES recibido y almacenado por authStore.login", async (ruta) => {
    await autenticar("MESA_PARTES");
    abrir(ruta);
    expect(await screen.findByText("Ventanilla presencial")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent(ruta);
    expect(screen.queryByText("Login institucional")).not.toBeInTheDocument();
    expect(screen.queryByText("Acceso denegado")).not.toBeInTheDocument();
  });

  it.each(rutasVentanilla.flatMap((ruta) => (
    ["SUPER_ADMIN", "DIRECTOR", "DOCENTE", "ESTUDIANTE"] as const
  ).map((rol) => [ruta, rol] as const)))("deniega %s al rol %s sin montar Ventanilla", async (ruta, rol) => {
    await autenticar(rol);
    abrir(ruta);
    expect(await screen.findByText("Acceso denegado")).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent(/^\/acceso-denegado$/);
    expect(screen.queryByText("Ventanilla presencial")).not.toBeInTheDocument();
    expect(VentanillaPresencialPage).not.toHaveBeenCalled();
  });

  it.each(rutasVentanilla)("deniega %s si la sesión carece de rol", async (ruta) => {
    await autenticar("MESA_PARTES");
    localStorage.removeItem("sigd_rol");
    abrir(ruta);
    expect(await screen.findByText("Acceso denegado")).toBeInTheDocument();
    expect(screen.queryByText("Ventanilla presencial")).not.toBeInTheDocument();
    expect(VentanillaPresencialPage).not.toHaveBeenCalled();
  });

  it.each(rutasVentanilla)("deniega %s si queda el rol sin token", async (ruta) => {
    await autenticar("MESA_PARTES");
    localStorage.removeItem("sigd_token");
    abrir(ruta);
    expect(await screen.findByText("Login institucional")).toBeInTheDocument();
    expect(screen.queryByText("Ventanilla presencial")).not.toBeInTheDocument();
    expect(VentanillaPresencialPage).not.toHaveBeenCalled();
  });

  it.each([
    ["/", "Inicio público", "/"],
    ["/tramite/mesa-partes-virtual", "Mesa de partes virtual", "/tramite/mesa-partes-virtual"],
    ["/tramite/mesa-partes", "Mesa de partes virtual", "/tramite/mesa-partes-virtual"],
    ["/mesa-partes", "Mesa de partes virtual", "/mesa-partes"],
    ["/consulta", "Consulta pública", "/consulta"],
    ["/consulta/CUT-DEL-DOBLE", "Consulta pública", "/consulta/CUT-DEL-DOBLE"],
    ["/casilla", "Casilla electrónica", "/casilla"],
    ["/casilla-electronica", "Casilla electrónica", "/casilla-electronica"],
  ])("conserva el acceso sin sesión a %s", async (ruta, pagina, destino) => {
    abrir(ruta);
    expect(await screen.findByText(pagina)).toBeInTheDocument();
    expect(screen.getByTestId("ruta")).toHaveTextContent(destino);
    expect(screen.queryByText("Login institucional")).not.toBeInTheDocument();
    expect(screen.queryByText("Acceso denegado")).not.toBeInTheDocument();
  });
});
