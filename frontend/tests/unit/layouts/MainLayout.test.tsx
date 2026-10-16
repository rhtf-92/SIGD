import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { act, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import MainLayout from "../../../src/layouts/MainLayout";
import { useAuthStore } from "../../../src/stores/authStore";
import type { RolCanonicoId } from "../../../src/types/rbacRoles";

const MENU_LATERAL = "Menú lateral de módulos del sistema";

function renderLayout() {
  return render(
    <MemoryRouter>
      <MainLayout>
        <p>Contenido público</p>
      </MainLayout>
    </MemoryRouter>,
  );
}

function iniciarSesion(rol: RolCanonicoId) {
  window.localStorage.setItem("sigd_token", "test-token");
  window.localStorage.setItem("sigd_rol", rol);
  useAuthStore.setState({
    accessToken: "test-token",
    refreshToken: null,
    isAuthenticated: true,
    usuario: {
      id: "u-1",
      nombreCompleto: "Usuario de Prueba",
      correo: "prueba@iestpsuiza.edu.pe",
      rol,
    },
  });
}

function cerrarSesion() {
  window.localStorage.clear();
  useAuthStore.setState({
    accessToken: null,
    refreshToken: null,
    usuario: null,
    isAuthenticated: false,
  });
}

describe("MainLayout — montaje condicional de la barra lateral", () => {
  beforeEach(cerrarSesion);
  afterEach(cerrarSesion);

  it("el ciudadano externo sin sesión navega sin barra lateral", () => {
    renderLayout();

    expect(screen.queryByRole("navigation", { name: MENU_LATERAL })).toBeNull();
    expect(screen.getByText("Contenido público")).toBeDefined();
    expect(screen.getByText("Iniciar sesión")).toBeDefined();
  });

  it("el usuario interno con sesión activa sí obtiene la barra lateral", () => {
    iniciarSesion("MESA_PARTES");
    renderLayout();

    expect(
      screen.getByRole("navigation", { name: MENU_LATERAL }),
    ).toBeDefined();
    expect(screen.getByText("Ventanilla Presencial")).toBeDefined();
    expect(screen.getByText("Contenido público")).toBeDefined();
  });

  it("la barra lateral se monta y desmonta de forma reactiva al cambiar la sesión", () => {
    renderLayout();

    expect(screen.queryByRole("navigation", { name: MENU_LATERAL })).toBeNull();

    act(() => {
      iniciarSesion("DIRECTOR");
    });
    expect(
      screen.getByRole("navigation", { name: MENU_LATERAL }),
    ).toBeDefined();

    act(() => {
      cerrarSesion();
    });
    expect(screen.queryByRole("navigation", { name: MENU_LATERAL })).toBeNull();
  });
});