import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";
import { useAuthStore } from "../stores/authStore";
import ProtectedRoute from "./ProtectedRoute";

function RutaActual() {
  return <output aria-label="ruta actual">{useLocation().pathname}</output>;
}

function renderGuardedRoute() {
  return render(
    <MemoryRouter initialEntries={["/casilla"]}>
      <Routes>
        <Route
          path="/casilla"
          element={
            <ProtectedRoute>
              <p>Contenido privado</p>
            </ProtectedRoute>
          }
        />
        <Route
          path="/login"
          element={
            <>
              <p>Formulario de ingreso</p>
              <RutaActual />
            </>
          }
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ProtectedRoute", () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
  });

  it("redirige a /login si no hay sesión", () => {
    renderGuardedRoute();

    expect(screen.getByText("Formulario de ingreso")).toBeInTheDocument();
    expect(screen.getByLabelText("ruta actual")).toHaveTextContent("/login");
  });

  it("permite entrar cuando hay una sesión del store", () => {
    useAuthStore.setState({
      accessToken: "token-real-de-prueba",
      isAuthenticated: true,
    });

    renderGuardedRoute();

    expect(screen.getByText("Contenido privado")).toBeInTheDocument();
  });
});
