import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { apiClient } from "../../../src/api/client";
import CasillaLoginPage from "../../../src/pages/casilla/CasillaLoginPage";
import { useAuthStore } from "../../../src/stores/authStore";

const originalAdapter = apiClient.defaults.adapter;
const originalLogout = useAuthStore.getState().logout;

function response(config: InternalAxiosRequestConfig, data: unknown, status = 200): AxiosResponse {
  return { config, data, status, statusText: String(status), headers: {} };
}

function Destino() {
  return <p data-testid="destino">{useLocation().pathname}</p>;
}

function renderCasillaLogin(initialEntry = "/casilla/login") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route path="/casilla/login" element={<CasillaLoginPage />} />
        <Route path="/casilla" element={<Destino />} />
        <Route path="/registro" element={<Destino />} />
        <Route path="/activar-cuenta" element={<Destino />} />
        <Route path="*" element={<Destino />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("CasillaLoginPage — Pantalla Institucional de Inicio de Sesión de la Casilla", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    apiClient.defaults.adapter = async () => {
      throw new Error("Petición inesperada");
    };
  });

  afterEach(() => {
    apiClient.defaults.adapter = originalAdapter;
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      logout: originalLogout,
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  it("1. Renderiza título institucional, subtítulo normativo y campos obligatorios", () => {
    renderCasillaLogin();

    expect(screen.getByRole("heading", { name: "CASILLA ELECTRÓNICA" })).toBeInTheDocument();
    expect(
      screen.getByText(/Accede de manera segura a tus notificaciones y documentos electrónicos institucionales/i),
    ).toBeInTheDocument();

    expect(screen.getByLabelText("Usuario o correo electrónico")).toBeInTheDocument();
    expect(screen.getByLabelText("Contraseña")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Ingresar a mi Casilla/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Regístrate aquí/i })).toHaveAttribute("href", "/registro");
    expect(screen.getByRole("link", { name: /Activar cuenta/i })).toHaveAttribute("href", "/activar-cuenta");
  });

  it("2. Permite mostrar u ocultar la contraseña con el botón interactivo", async () => {
    renderCasillaLogin();
    const inputPass = screen.getByLabelText("Contraseña") as HTMLInputElement;
    const botonToggle = screen.getByLabelText("Mostrar contraseña");

    expect(inputPass.type).toBe("password");

    await userEvent.click(botonToggle);
    expect(inputPass.type).toBe("text");
    expect(screen.getByLabelText("Ocultar contraseña")).toBeInTheDocument();

    await userEvent.click(screen.getByLabelText("Ocultar contraseña"));
    expect(inputPass.type).toBe("password");
  });

  it("3. Escenario C: Usuario no registrado o credenciales incorrectas -> mensaje genérico 401", async () => {
    apiClient.defaults.adapter = async (config) => {
      const err: any = new Error("Request failed with status code 401");
      err.config = config;
      err.response = response(config, {
        status: 401,
        code: "UNAUTHORIZED",
        title: "Credenciales inválidas",
        detail: "Credenciales inválidas. Verifique su usuario o contraseña institucional.",
      }, 401);
      err.isAxiosError = true;
      throw err;
    };

    renderCasillaLogin();
    await userEvent.type(screen.getByLabelText("Usuario o correo electrónico"), "77777777");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ClaveErronea123!");
    await userEvent.click(screen.getByRole("button", { name: /Ingresar a mi Casilla/i }));

    expect(
      await screen.findByText("No fue posible iniciar sesión. Verifique sus credenciales o regístrese para continuar."),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("destino")).not.toBeInTheDocument();
  });

  it("4. Escenario D: Cuenta registrada e inactiva -> mensaje y orientación para activación", async () => {
    apiClient.defaults.adapter = async (config) => {
      const err: any = new Error("Request failed with status code 403");
      err.config = config;
      err.response = response(config, {
        status: 403,
        code: "ACCOUNT_DISABLED",
        title: "Cuenta deshabilitada",
        detail: "Su cuenta institucional se encuentra suspendida o deshabilitada.",
      }, 403);
      err.isAxiosError = true;
      throw err;
    };

    renderCasillaLogin();
    await userEvent.type(screen.getByLabelText("Usuario o correo electrónico"), "72615711");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ClaveSegura2026!");
    await userEvent.click(screen.getByRole("button", { name: /Ingresar a mi Casilla/i }));

    expect(
      await screen.findByText(/Su cuenta se encuentra registrada pero aún no ha completado la activación requerida/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Proceder a la activación de mi cuenta/i })).toHaveAttribute("href", "/activar-cuenta");
  });

  it("5. Cuenta sin rol CIUDADANO -> rechaza acceso a la Casilla", async () => {
    apiClient.defaults.adapter = async (config) => {
      return response(config, {
        accessToken: "token-admin",
        refreshToken: "refresh-admin",
        usuario: {
          id: "admin-id",
          nombreCompleto: "Administrador General",
          correo: "admin@iestp-suiza.edu.pe",
          rol: "ADMINISTRADOR",
          roles: ["ADMINISTRADOR"],
        },
      }, 200);
    };

    renderCasillaLogin();
    await userEvent.type(screen.getByLabelText("Usuario o correo electrónico"), "admin");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ClaveAdmin2026!");
    await userEvent.click(screen.getByRole("button", { name: /Ingresar a mi Casilla/i }));

    expect(
      await screen.findByText(/Su cuenta institucional no cuenta con rol CIUDADANO/i),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("destino")).not.toBeInTheDocument();
  });

  it("6. Ciudadano autenticado exitosamente -> navega a /casilla", async () => {
    apiClient.defaults.adapter = async (config) => {
      return response(config, {
        accessToken: "token-ciudadano-valido",
        refreshToken: "refresh-ciudadano",
        usuario: {
          id: "ciudadano-uuid-1",
          nombreCompleto: "Carlos Vásquez Panduro",
          correo: "carlos.vasquez@gmail.com",
          rol: "CIUDADANO",
          roles: ["CIUDADANO"],
        },
      }, 200);
    };

    renderCasillaLogin();
    await userEvent.type(screen.getByLabelText("Usuario o correo electrónico"), "72145896");
    await userEvent.type(screen.getByLabelText("Contraseña"), "ClaveSegura2026!");
    await userEvent.click(screen.getByRole("button", { name: /Ingresar a mi Casilla/i }));

    expect(await screen.findByTestId("destino")).toHaveTextContent("/casilla");
  });

  it("7. Escenario B: Sesión ya existente de CIUDADANO -> redirección inmediata a /casilla", async () => {
    useAuthStore.setState({
      accessToken: "token-existente",
      isAuthenticated: true,
      usuario: {
        id: "ciudadano-uuid-2",
        nombreCompleto: "Elena Ríos",
        correo: "elena@example.com",
        rol: "CIUDADANO",
        roles: ["CIUDADANO"],
      },
    });

    renderCasillaLogin();

    await waitFor(() => {
      expect(screen.getByTestId("destino")).toHaveTextContent("/casilla");
    });
  });
});
