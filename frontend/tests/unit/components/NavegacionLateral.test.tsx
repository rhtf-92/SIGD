import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import NavegacionLateral from "../../../src/components/NavegacionLateral";
import { MODULOS } from "../../../src/config/modulos";
import { useAuthStore } from "../../../src/stores/authStore";
import type { RolCanonicoId } from "../../../src/types/rbacRoles";

function renderNavegacion() {
  return render(
    <MemoryRouter>
      <NavegacionLateral />
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

describe("NavegacionLateral — menú lateral de módulos internos por rol", () => {
  beforeEach(cerrarSesion);
  afterEach(cerrarSesion);

  it("el rol SUPER_ADMIN ve la totalidad del catálogo", () => {
    iniciarSesion("SUPER_ADMIN");
    renderNavegacion();

    expect(screen.getAllByRole("link")).toHaveLength(MODULOS.length);
    for (const modulo of MODULOS) {
      expect(screen.getByText(modulo.titulo)).toBeDefined();
    }
  });

  it("cada acceso apunta a la ruta canónica del módulo", () => {
    iniciarSesion("SUPER_ADMIN");
    renderNavegacion();

    for (const modulo of MODULOS) {
      const enlace = screen.getByText(modulo.titulo).closest("a");
      expect(enlace?.getAttribute("href")).toBe(modulo.ruta);
    }
  });

  it("el rol MESA_PARTES no ve módulos de Dirección ni de Administración", () => {
    iniciarSesion("MESA_PARTES");
    renderNavegacion();

    expect(screen.getByText("Ventanilla Presencial")).toBeDefined();
    expect(screen.getByText("Bandeja de Expedientes")).toBeDefined();

    expect(screen.queryByText("Panel de Administración")).toBeNull();
    expect(screen.queryByText("Reportes y Tableros de Control")).toBeNull();
    expect(screen.queryByText("Proyector de Resoluciones")).toBeNull();
  });

  it("sin sesión resuelta sólo lista los módulos públicos del portal ciudadano", () => {
    renderNavegacion();

    const publicos = MODULOS.filter((modulo) => modulo.publico === true);
    expect(screen.getAllByRole("link")).toHaveLength(publicos.length);
    for (const modulo of publicos) {
      expect(screen.getByText(modulo.titulo)).toBeDefined();
    }

    expect(screen.queryByText("Bandeja de Expedientes")).toBeNull();
    expect(screen.queryByText("Panel de Administración")).toBeNull();
  });
});