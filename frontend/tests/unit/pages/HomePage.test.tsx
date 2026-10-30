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

  it("muestra el apartado de ayuda sin imágenes para invitados", () => {
    renderHome();

    expect(screen.getByText("Ayuda con la página")).toBeDefined();
    expect(
      screen.getByText("Un sistema digital para gestionar tus documentos con seguridad"),
    ).toBeDefined();

    expect(screen.queryByRole("img", { name: "IESTP Suiza" })).toBeNull();
    expect(document.querySelector("video")).toBeNull();
    expect(screen.queryByText("Acceso rápido")).toBeNull();
    expect(screen.queryByText("Accesos al Sistema SIGD")).toBeNull();
    expect(screen.queryByText("Servicios del SIGD")).toBeNull();
  });

  it("el rol ESTUDIANTE (usuario externo) ve la imagen principal", () => {
    iniciarSesion("ESTUDIANTE");
    renderHome();

    expect(screen.getByRole("img", { name: "IESTP Suiza" })).toBeDefined();
  });

  it("el rol SUPER_ADMIN no ve imágenes principales para evitar espacios vacíos", () => {
    iniciarSesion("SUPER_ADMIN");
    renderHome();

    expect(screen.queryByRole("img", { name: "IESTP Suiza" })).toBeNull();
  });
});
