// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import SeccionAccesoSigd from "../../../src/components/landing/SeccionAccesoSigd";

vi.mock("../../../src/services/casillaService", () => ({
  casillaService: {
    getEstadisticas: vi.fn().mockResolvedValue({
      total: 3,
      noLeidos: 2,
      leidos: 1,
      notificados: 0,
      urgentes: 0,
    }),
  },
}));

function iniciarSesion(rol = "SUPER_ADMIN") {
  window.localStorage.setItem("sigd_token", "demo-jwt-prueba");
  window.localStorage.setItem("sigd_rol", rol);
}

function renderizar() {
  return render(
    <MemoryRouter>
      <SeccionAccesoSigd />
    </MemoryRouter>,
  );
}

describe("SeccionAccesoSigd", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("invitado: bloquea todos los módulos y muestra el CTA de inicio de sesión", () => {
    renderizar();

    expect(screen.getByText(/Acceso exclusivo para usuarios/i)).toBeInTheDocument();
    expect(screen.queryByText("Mesa de Partes Virtual")).toBeNull();
    expect(screen.queryByText("Casilla Electrónica")).toBeNull();
    expect(screen.getAllByRole("link", { name: /Iniciar sesión/i }).length).toBeGreaterThan(0);
  });

  it("autenticado: busca por nombre, muestra badge y permite marcar favoritos", async () => {
    iniciarSesion();
    renderizar();

    const buscador = screen.getByRole("searchbox", { name: /Buscar módulos del SIGD/i });
    expect(screen.getByText("Mesa de Partes Virtual")).toBeInTheDocument();

    fireEvent.change(buscador, { target: { value: "casilla" } });
    expect(screen.getByText("Casilla Electrónica")).toBeInTheDocument();
    expect(screen.queryByText("Mesa de Partes Virtual")).toBeNull();

    await waitFor(() => expect(screen.getByText("2 pendientes")).toBeInTheDocument());

    fireEvent.click(
      screen.getByRole("button", { name: /Agregar Casilla Electrónica a favoritos/i }),
    );

    await waitFor(() => {
      expect(window.localStorage.getItem("sigd_modulos_favoritos")).toContain("casilla");
    });
    expect(screen.getByText(/1 favorito/)).toBeInTheDocument();
  });

  it("autenticado: Ctrl+K enfoca el buscador y el filtro de favoritos queda vacío", async () => {
    iniciarSesion("ESTUDIANTE");
    renderizar();

    const buscador = screen.getByRole("searchbox", { name: /Buscar módulos del SIGD/i });
    fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    expect(buscador).toHaveFocus();

    fireEvent.click(screen.getByRole("button", { name: "Favoritos" }));
    expect(
      screen.getByText(/Aún no tienes módulos favoritos que coincidan con la búsqueda/i),
    ).toBeInTheDocument();
  });
});
