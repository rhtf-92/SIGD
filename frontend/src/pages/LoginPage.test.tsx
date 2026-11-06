import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import axios from "axios";
import { env } from "../config/env";
import { useAuthStore } from "../stores/authStore";
import { ApiHttpError } from "../types/api";
import LoginPage from "./LoginPage";

const mockFlags = vi.hoisted(() => ({ enableMocks: false }));
vi.mock("../config/env", () => ({
  env: {
    apiBaseUrl: "http://localhost:3000",
    apiPrefix: "/api/v1",
    isDevelopment: true,
    get enableMocks() {
      return mockFlags.enableMocks;
    },
  },
}));

function RutaActual() {
  return <output aria-label="ruta actual">{useLocation().pathname}</output>;
}

function renderLogin(entry: string | { pathname: string; state?: unknown } = "/login") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
      <LoginPage />
      <RutaActual />
    </MemoryRouter>,
  );
}

describe("LoginPage", () => {
  const loginMock = vi.fn(async (): Promise<void> => undefined);

  beforeEach(() => {
    mockFlags.enableMocks = false;
    localStorage.clear();
    sessionStorage.clear();
    loginMock.mockReset();
    loginMock.mockResolvedValue(undefined);
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      login: loginMock,
    });
  });

  it("muestra los campos para usuario/correo y contraseña", () => {
    renderLogin();

    expect(screen.getByLabelText("Usuario o correo")).toHaveAttribute(
      "autocomplete",
      "username",
    );
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute(
      "type",
      "password",
    );
    expect(screen.getByRole("button", { name: "Iniciar sesión" })).toBeEnabled();
  });

  it("valida campos vacíos sin llamar al store", async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("alert")).toHaveTextContent(
      "Ingresa tu usuario o correo y tu contraseña.",
    );
    expect(loginMock).not.toHaveBeenCalled();
  });

  it("inicia sesión y vuelve a la ruta protegida solicitada", async () => {
    const user = userEvent.setup();
    renderLogin({
      pathname: "/login",
      state: { from: { pathname: "/casilla", search: "?pagina=2" } },
    });

    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() =>
      expect(screen.getByLabelText("ruta actual")).toHaveTextContent(
        "/casilla",
      ),
    );
    expect(loginMock).toHaveBeenCalledWith({
      identificador: "usuario-prueba",
      password: "dato-no-real",
    });
  });

  it("redirige a Casilla si no hay una ruta previa", async () => {
    const user = userEvent.setup();
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    await waitFor(() =>
      expect(screen.getByLabelText("ruta actual")).toHaveTextContent("/casilla"),
    );
  });

  it("muestra un mensaje simple para credenciales inválidas", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "credenciales-inventadas-rechazadas",
        instance: "/api/v1/auth/login",
        code: "ERR_HTTP_401",
        category: "Security",
        correlationId: "test",
        retryable: false,
      }),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Usuario/correo o contraseña inválidos.",
    );
  });

  it("identifica una cuenta inactiva cuando el servidor lo informa", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Forbidden",
        status: 403,
        detail: "cuenta-inactiva",
        instance: "/api/v1/auth/login",
        code: "ACCOUNT_DISABLED",
        category: "Security",
        correlationId: "test",
        retryable: false,
      }),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu cuenta está inactiva. Contacta con soporte institucional.",
    );
  });

  it("prioriza el estado de cuenta bloqueada cuando el servidor lo informa", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new ApiHttpError({
        type: "about:blank",
        title: "Unauthorized",
        status: 401,
        detail: "cuenta-bloqueada",
        instance: "/api/v1/auth/login",
        code: "ACCOUNT_LOCKED",
        category: "Security",
        correlationId: "test",
        retryable: false,
      }),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Tu cuenta está bloqueada. Contacta con soporte institucional.",
    );
  });

  it("muestra el error de conexión sin detalles técnicos", async () => {
    const user = userEvent.setup();
    loginMock.mockRejectedValueOnce(
      new axios.AxiosError("Network Error", "ERR_NETWORK"),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "No se pudo conectar con el servidor.",
    );
  });

  it("deshabilita el botón mientras espera la respuesta", async () => {
    const user = userEvent.setup();
    let resolver!: () => void;
    loginMock.mockImplementationOnce(
      () => new Promise<void>((resolve) => (resolver = resolve)),
    );
    renderLogin();
    await user.type(screen.getByLabelText("Usuario o correo"), "usuario-prueba");
    await user.type(screen.getByLabelText("Contraseña"), "dato-no-real");
    await user.click(screen.getByRole("button", { name: "Iniciar sesión" }));

    expect(screen.getByRole("button", { name: "Ingresando..." })).toBeDisabled();
    resolver();
    await waitFor(() =>
      expect(screen.getByLabelText("ruta actual")).toHaveTextContent("/casilla"),
    );
  });

  it("solo ofrece y crea el acceso ficticio si enableMocks está activo", async () => {
    const user = userEvent.setup();
    renderLogin();
    expect(screen.queryByRole("button", { name: "Entrar en modo demo" })).toBeNull();

    mockFlags.enableMocks = true;
    expect(env.enableMocks).toBe(true);
    const { unmount } = render(
      <MemoryRouter initialEntries={["/login"]}>
        <LoginPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: "Entrar en modo demo" }));
    expect(localStorage.getItem("sigd_token")).toMatch(/^demo-jwt-/);
    unmount();
  });
});
