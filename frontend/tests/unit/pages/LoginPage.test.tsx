import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "../../../src/api/client";
import LoginPage from "../../../src/pages/LoginPage";
import ProtectedRoute from "../../../src/routes/ProtectedRoute";
import { AUTH_RETURN_TO_STORAGE_KEY, useAuthStore } from "../../../src/stores/authStore";

const originalAdapter = apiClient.defaults.adapter;
const originalLogout = useAuthStore.getState().logout;
const logout = vi.fn();

// Respuestas del transporte doble; no se generan JWT ni se contacta al backend.
function respuestaLogin(rol = "MESA_PARTES") {
  return {
    accessToken: "access-del-doble",
    refreshToken: "refresh-del-doble",
    usuario: { id: "operador-del-doble", nombreCompleto: "Operador", correo: "operador@example.test", rol },
  };
}

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: {} };
}

function Destino() {
  return <p data-testid="destino">{useLocation().pathname}</p>;
}

function renderLogin(initialEntry: string | { pathname: string; state?: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/tramite/ventanilla-presencial" element={
          <ProtectedRoute requiredRoles={["MESA_PARTES"]}><Destino /></ProtectedRoute>
        } />
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
}

async function enviarCredenciales() {
  const user = userEvent.setup();
  await user.type(screen.getByLabelText("Usuario o correo institucional"), "operador@example.test");
  await user.type(screen.getByLabelText("Contraseña"), "clave con espacios ");
  await user.click(screen.getByRole("button", { name: "Ingresar al sistema" }));
}

describe("LoginPage con autenticación existente", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    logout.mockClear();
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false, logout });
    // Cada prueba sustituye el transporte; cualquier petición inesperada falla sin usar la red.
    apiClient.defaults.adapter = async () => { throw new Error("Petición inesperada"); };
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false, logout: originalLogout });
    localStorage.clear();
    sessionStorage.clear();
  });

  it("almacena la respuesta mediante authStore y permite al guard y al cliente consumir rol y Bearer", async () => {
    const requests: InternalAxiosRequestConfig[] = [];
    const data = respuestaLogin();
    apiClient.defaults.adapter = async (config) => {
      requests.push(config);
      return response(config, config.url === "/api/v1/auth/login" ? data : {});
    };
    localStorage.setItem("sigd_rol", "SUPER_ADMIN");
    renderLogin();
    await enviarCredenciales();

    expect(await screen.findByTestId("destino")).toHaveTextContent("/tramite/ventanilla-presencial");
    expect(JSON.parse(requests[0].data)).toEqual({ identificador: "operador@example.test", password: "clave con espacios " });
    expect(useAuthStore.getState()).toMatchObject({ ...data, isAuthenticated: true });
    expect(JSON.parse(localStorage.getItem("sigd_auth")!).state).toEqual({ ...data, isAuthenticated: true });
    expect(localStorage.getItem("sigd_token")).toBe(data.accessToken);
    expect(localStorage.getItem("token")).toBe(data.accessToken);
    expect(localStorage.getItem("sigd_rol")).toBe("MESA_PARTES");
    expect(localStorage.getItem("sigd_permisos")).not.toBeNull();
    await apiClient.get("/api/v1/tramites/ventanilla/cargo/CUT-DEL-DOBLE");
    expect(requests[1].headers.Authorization).toBe(`Bearer ${data.accessToken}`);
    expect(logout).not.toHaveBeenCalled();
  });

  it.each([
    ["SUPER_ADMIN", "/administracion"],
    ["DIRECTOR", "/administracion"],
    ["DOCENTE", "/flujos/titulacion"],
    ["ESTUDIANTE", "/casilla"],
    ["CIUDADANO", "/"],
  ])("utiliza el rol %s del backend para navegar a %s sin asignarle otro rol", async (rol, destino) => {
    apiClient.defaults.adapter = async (config) => response(config, respuestaLogin(rol));
    renderLogin();
    await enviarCredenciales();
    expect(await screen.findByTestId("destino")).toHaveTextContent(destino);
    expect(useAuthStore.getState().usuario?.rol).toBe(rol);
    expect(localStorage.getItem("sigd_rol")).toBe(rol);
  });

  it("retorna al Wizard despues de login conservando la ruta interna", async () => {
    apiClient.defaults.adapter = async (config) => response(config, respuestaLogin());
    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/tramite/mesa-partes-virtual", search: "?borrador=1", hash: "#confirmacion" } },
    });
    await enviarCredenciales();
    expect(await screen.findByTestId("destino")).toHaveTextContent("/tramite/mesa-partes-virtual");
  });

  it("usa y elimina el destino interno guardado para una sesiÃ³n expirada", async () => {
    apiClient.defaults.adapter = async (config) => response(config, respuestaLogin());
    sessionStorage.setItem(AUTH_RETURN_TO_STORAGE_KEY, "/tramite/mesa-partes-virtual?borrador=2");
    renderLogin();
    await enviarCredenciales();
    expect(await screen.findByTestId("destino")).toHaveTextContent("/tramite/mesa-partes-virtual");
    expect(sessionStorage.getItem(AUTH_RETURN_TO_STORAGE_KEY)).toBeNull();
  });

  it("muestra credenciales incorrectas y permite reintentar sin refresh, logout ni navegación", async () => {
    const requests: string[] = [];
    apiClient.defaults.adapter = async (config) => {
      requests.push(config.url!);
      throw new AxiosError("Unauthorized", "ERR_BAD_REQUEST", config, {},
        response(config, { detail: "Credenciales inválidas" }, 401));
    };
    renderLogin();
    await enviarCredenciales();
    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales incorrectas");
    expect(screen.queryByTestId("destino")).not.toBeInTheDocument();
    expect(requests).toEqual(["/api/v1/auth/login"]);
    expect(logout).not.toHaveBeenCalled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("sigd_token")).toBeNull();
    apiClient.defaults.adapter = async (config) => response(config, respuestaLogin());
    await userEvent.click(screen.getByRole("button", { name: "Ingresar al sistema" }));
    expect(await screen.findByTestId("destino")).toHaveTextContent("/tramite/ventanilla-presencial");
  });

  it("muestra un error de conexión sin almacenar una sesión", async () => {
    apiClient.defaults.adapter = async (config) => { throw new AxiosError("Network Error", "ERR_NETWORK", config); };
    renderLogin();
    await enviarCredenciales();
    expect(await screen.findByRole("alert")).toHaveTextContent("Compruebe la conexión");
    expect(screen.getByRole("button", { name: "Ingresar al sistema" })).toBeEnabled();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("sigd_token")).toBeNull();
    expect(logout).not.toHaveBeenCalled();
  });

  it("conserva el detalle de rechazo 403 del backend", async () => {
    apiClient.defaults.adapter = async (config) => {
      throw new AxiosError("Forbidden", "ERR_BAD_REQUEST", config, {},
        response(config, { detail: "Su cuenta está deshabilitada." }, 403));
    };
    renderLogin();
    await enviarCredenciales();
    expect(await screen.findByRole("alert")).toHaveTextContent("Su cuenta está deshabilitada.");
    expect(logout).not.toHaveBeenCalled();
  });

  it("bloquea envíos repetidos mientras espera la respuesta y recupera los controles al fallar", async () => {
    let reject!: (error: Error) => void;
    const adapter = vi.fn(() => new Promise<AxiosResponse>((_, rejectPromise) => { reject = rejectPromise; }));
    apiClient.defaults.adapter = adapter;
    renderLogin();
    await enviarCredenciales();
    expect(screen.getByRole("button", { name: "Ingresando…" })).toBeDisabled();
    expect(screen.getByLabelText("Usuario o correo institucional")).toBeDisabled();
    expect(screen.getByLabelText("Contraseña")).toBeDisabled();
    const form = screen.getByLabelText("Contraseña").closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(adapter).toHaveBeenCalledTimes(1);
    await act(async () => { reject(new Error("Conexión interrumpida")); });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ingresar al sistema" })).toBeEnabled());
    expect(screen.getByLabelText("Contraseña")).toBeEnabled();
  });

  it("no ofrece selección de roles ni permisos y mantiene el enlace al inicio y validaciones del contrato", async () => {
    const adapter = vi.fn(async (config: InternalAxiosRequestConfig) => response(config, {}));
    apiClient.defaults.adapter = adapter;
    renderLogin();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Volver al inicio/ })).toHaveAttribute("href", "/");
    expect(screen.getByLabelText("Usuario o correo institucional")).toHaveAttribute("minlength", "3");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("minlength", "6");
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("type", "password");
    await userEvent.click(screen.getByRole("button", { name: "Ingresar al sistema" }));
    expect(adapter).not.toHaveBeenCalled();
  });
});
