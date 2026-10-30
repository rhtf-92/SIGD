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

describe("HomePage — landing institucional", () => {
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

  it("el usuario externo (sin sesión) ve la imagen principal", () => {
    renderHome();

    expect(screen.getByRole("img", { name: "IESTP Suiza" })).toBeDefined();
    expect(document.querySelector("video")).toBeNull();
  });

  it("el rol ESTUDIANTE (usuario externo) ve la imagen principal", () => {
    iniciarSesion("ESTUDIANTE");
    renderHome();

    expect(screen.getByRole("img", { name: "IESTP Suiza" })).toBeDefined();
  });

  it("el rol SUPER_ADMIN no ve imágenes principales", () => {
    iniciarSesion("SUPER_ADMIN");
    renderHome();

    expect(screen.queryByRole("img", { name: "IESTP Suiza" })).toBeNull();
  });

  it("el rol DOCENTE (personal interno) no ve imágenes principales", () => {
    iniciarSesion("DOCENTE");
    renderHome();

    expect(screen.queryByRole("img", { name: "IESTP Suiza" })).toBeNull();
  });

  it("el rol MESA_PARTES (personal interno) no ve imágenes principales", () => {
    iniciarSesion("MESA_PARTES");
    renderHome();

    expect(screen.queryByRole("img", { name: "IESTP Suiza" })).toBeNull();
  });
});
