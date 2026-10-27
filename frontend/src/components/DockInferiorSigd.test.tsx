// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it } from "vitest";

import DockInferiorSigd from "./DockInferiorSigd";
import { permisosIniciales } from "../hooks/useRbacConfig";

function configurarSesion(rol: string | null) {
  window.localStorage.clear();
  if (rol) {
    window.localStorage.setItem("sigd_token", "token-prueba");
    window.localStorage.setItem("sigd_rol", rol);
    window.localStorage.setItem("sigd_permisos", JSON.stringify(permisosIniciales));
  }
}

function renderizarDock() {
  return render(
    <MemoryRouter initialEntries={["/"]}>
      <DockInferiorSigd />
    </MemoryRouter>,
  );
}

describe("DockInferiorSigd", () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  it("invitado: muestra módulos públicos y Entrar, oculta Casilla", () => {
    configurarSesion(null);
    renderizarDock();
    const nav = screen.getByRole("navigation", { name: "Accesos rápidos a módulos" });
    expect(nav).toBeDefined();
    expect(screen.queryByTitle("Mesa de Partes Virtual")).toBeNull();
    expect(screen.getByTitle("Iniciar sesión")).toBeDefined();
    expect(screen.queryByTitle("Casilla Electrónica")).toBeNull();
    expect(screen.queryByTitle("Administración")).toBeNull();
  });

  it("ESTUDIANTE: ve Casilla pero no Administración ni Ventanilla", () => {
    configurarSesion("ESTUDIANTE");
    renderizarDock();
    expect(screen.getByTitle("Casilla Electrónica")).toBeDefined();
    expect(screen.queryByTitle("Administración")).toBeNull();
    expect(screen.queryByTitle("Ventanilla Presencial")).toBeNull();
    expect(screen.queryByTitle("Iniciar sesión")).toBeNull();
  });

  it("SUPER_ADMIN: ve todos sus módulos incluido Administración", () => {
    configurarSesion("SUPER_ADMIN");
    renderizarDock();
    expect(screen.getByTitle("Casilla Electrónica")).toBeDefined();
    expect(screen.getByTitle("Bandeja de Expedientes")).toBeDefined();
    expect(screen.getByTitle("Administración")).toBeDefined();
    expect(screen.getByTitle("Reportes y Tableros")).toBeDefined();
  });
});
