import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import HomePage from "../../../src/pages/HomePage";
import { useAuthStore } from "../../../src/stores/authStore";

function renderHome() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>,
  );
}

function iniciarSesion(rol: string) {
  window.localStorage.setItem("sigd_token", "test-token");
  window.localStorage.setItem("sigd_rol", rol);
  useAuthStore.setState({
    accessToken: "test-token",
    isAuthenticated: true,
    usuario: {
      id: "u-1",
      nombreCompleto: "Usuario de Prueba",
      correo: "prueba@iestpsuiza.edu.pe",
      rol: rol as "SUPER_ADMIN" | "DIRECTOR" | "DOCENTE" | "MESA_PARTES" | "ESTUDIANTE",
    },
  });
}

describe("HomePage — visibilidad de módulos por rol", () => {
  beforeEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  afterEach(() => {
    window.localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  it("sin sesión muestra solo módulos públicos y la invitación a iniciar sesión", () => {
    renderHome();

    expect(screen.getByText("Registro Ciudadano")).toBeDefined();
    expect(screen.getByText("Validador CVD")).toBeDefined();
    expect(screen.getByText("Iniciar Sesión")).toBeDefined();

    expect(screen.queryByText("Casilla Electrónica")).toBeNull();
    expect(screen.queryByText("Panel de Administración")).toBeNull();
  });

  it("el rol ESTUDIANTE ve únicamente sus módulos y no Administración ni Reportes", () => {
    iniciarSesion("ESTUDIANTE");
    renderHome();

    expect(screen.getByText("Casilla Electrónica")).toBeDefined();
    expect(screen.getByText("Mesa de Partes Virtual")).toBeDefined();
    expect(screen.getByText("Registro Ciudadano")).toBeDefined();
    expect(screen.getByText("Validador CVD")).toBeDefined();

    expect(screen.queryByText("Panel de Administración")).toBeNull();
    expect(screen.queryByText("Reportes y Tableros de Control")).toBeNull();
    expect(screen.queryByText("Ventanilla Presencial")).toBeNull();
    expect(screen.queryByText("Bandeja de Expedientes")).toBeNull();
    expect(screen.queryByText("Iniciar Sesión")).toBeNull();
  });

  it("el rol SUPER_ADMIN ve todos los módulos incluido el Panel de Administración", () => {
    iniciarSesion("SUPER_ADMIN");
    renderHome();

    expect(screen.getByText("Panel de Administración")).toBeDefined();
    expect(screen.getByText("Reportes y Tableros de Control")).toBeDefined();
    expect(screen.getByText("Ventanilla Presencial")).toBeDefined();
  });
});
