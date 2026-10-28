import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, test, expect, beforeEach, vi } from "vitest";

import AdministracionPage from "../../../src/pages/administracion/AdministracionPage";
import { useAuthStore } from "../../../src/stores/authStore";

describe("AdministracionPage (pages/administracion - SIGD 2026)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({ usuario: null, isAuthenticated: false, accessToken: null });
  });

  test("1. Muestra tarjeta de Gestión TUPA cuando el usuario es ADMINISTRADOR", () => {
    useAuthStore.setState({
      usuario: {
        id: "admin-1",
        nombreCompleto: "Administrador Central",
        correo: "admin@suiza.edu.pe",
        rol: "ADMINISTRADOR",
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/administracion"]}>
        <Routes>
          <Route path="/administracion" element={<AdministracionPage />} />
          <Route path="/administracion/tupa" element={<p>Módulo Gestión TUPA</p>} />
        </Routes>
      </MemoryRouter>
    );

    // Encabezados de administración
    expect(screen.getByRole("heading", { name: /Panel de Administración/i })).toBeInTheDocument();

    // Tarjeta de Gestión TUPA
    expect(screen.getByRole("heading", { name: "Gestión TUPA" })).toBeInTheDocument();
    expect(
      screen.getByText("Versiones, procedimientos, publicación e histórico del TUPA.")
    ).toBeInTheDocument();

    // Otras tarjetas administrativas
    expect(screen.getByRole("heading", { name: "Usuarios" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Roles y Permisos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Auditoría" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Tablas Maestras" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Calendario Laboral" })).toBeInTheDocument();
  });

  test("2. Navega a /administracion/tupa al hacer clic en Administrar dentro de Gestión TUPA", () => {
    useAuthStore.setState({
      usuario: {
        id: "admin-1",
        nombreCompleto: "Administrador Central",
        correo: "admin@suiza.edu.pe",
        rol: "ADMINISTRADOR",
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/administracion"]}>
        <Routes>
          <Route path="/administracion" element={<AdministracionPage />} />
          <Route path="/administracion/tupa" element={<p>Módulo Gestión TUPA</p>} />
        </Routes>
      </MemoryRouter>
    );

    const cardTupa = screen.getByRole("heading", { name: "Gestión TUPA" }).closest("article");
    expect(cardTupa).not.toBeNull();

    const botonAdministrar = cardTupa?.querySelector("button");
    expect(botonAdministrar).not.toBeNull();
    fireEvent.click(botonAdministrar!);

    expect(screen.getByText("Módulo Gestión TUPA")).toBeInTheDocument();
  });

  test("3. Oculta tarjeta de Gestión TUPA si el rol no es ADMINISTRADOR", () => {
    useAuthStore.setState({
      usuario: {
        id: "ciudadano-1",
        nombreCompleto: "Ciudadano Demo",
        correo: "ciudadano@suiza.edu.pe",
        rol: "CIUDADANO",
      },
      isAuthenticated: true,
    });

    render(
      <MemoryRouter initialEntries={["/administracion"]}>
        <Routes>
          <Route path="/administracion" element={<AdministracionPage />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole("heading", { name: "Gestión TUPA" })).not.toBeInTheDocument();
    expect(
      screen.queryByText("Versiones, procedimientos, publicación e histórico del TUPA.")
    ).not.toBeInTheDocument();
  });
});
