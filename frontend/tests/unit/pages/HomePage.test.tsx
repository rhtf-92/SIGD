import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import HomePage from "../../../src/pages/HomePage";
import { useAuthStore } from "../../../src/stores/authStore";

function renderHomePage() {
  return render(
    <MemoryRouter>
      <HomePage />
    </MemoryRouter>
  );
}

describe("HomePage — Diseño Público Definitivo Aprobado SIGD", () => {
  beforeEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  afterEach(() => {
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
    });
    localStorage.clear();
  });

  describe("1. Hero Panorámico Institucional", () => {
    it("renderiza el título oficial del instituto y la descripción canónica", () => {
      renderHomePage();
      expect(
        screen.getByRole("heading", {
          name: /Trámites Documentarios del IESTP SUIZA/i,
        })
      ).toBeInTheDocument();
      expect(
        screen.getByText(
          /Presenta solicitudes, consulta el estado de tus trámites y valida documentos de forma digital, segura y confiable\./i
        )
      ).toBeInTheDocument();
    });

    it("renderiza los botones de acción del hero con las rutas correctas", () => {
      renderHomePage();
      const botonIniciar = screen.getByRole("link", { name: /Iniciar trámite/i });
      expect(botonIniciar).toBeInTheDocument();
      expect(botonIniciar).toHaveAttribute("href", "/mesa-partes");

      const botonConsultar = screen.getByRole("link", { name: /Consultar CUT/i });
      expect(botonConsultar).toBeInTheDocument();
      expect(botonConsultar).toHaveAttribute("href", "/consulta");
    });

    it("renderiza las imágenes gráficas oficiales del hero con texto alternativo", () => {
      renderHomePage();
      expect(
        screen.getByAltText(/Entrada del Instituto Superior Tecnológico Suiza/i)
      ).toBeInTheDocument();
      expect(
        screen.getByAltText(/Estudiantes del IESTP Suiza/i)
      ).toBeInTheDocument();
    });
  });

  describe("2. Cuatro Tarjetas de Servicios Públicos", () => {
    it("renderiza exactamente las 4 tarjetas de servicios públicos aprobadas", () => {
      renderHomePage();

      // 1. Mesa de Partes Digital
      expect(
        screen.getByRole("heading", { name: /^Mesa de Partes Digital$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Presenta tus trámites y adjunta documentos\./i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Mesa de Partes Digital/i })
      ).toHaveAttribute("href", "/mesa-partes");

      // 2. Consulta por CUT
      expect(
        screen.getByRole("heading", { name: /^Consulta por CUT$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Revisa el estado de tu trámite en línea\./i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Consulta por CUT/i })
      ).toHaveAttribute("href", "/consulta");

      // 3. Catálogo TUPA
      expect(
        screen.getByRole("heading", { name: /^Catálogo TUPA$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Consulta requisitos, costos y plazos oficiales\./i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Catálogo TUPA/i })
      ).toHaveAttribute("href", "/tupa");

      // 4. Validador CVD
      expect(
        screen.getByRole("heading", { name: /^Validador CVD$/i })
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Verifica la autenticidad de documentos emitidos\./i)
      ).toBeInTheDocument();
      expect(
        screen.getByRole("link", { name: /Validador CVD/i })
      ).toHaveAttribute("href", "/validador-cvd");
    });
  });

  describe("3. Aislamiento estricto de módulos institucionales restringidos", () => {
    it("NO expone módulos internos ni tarjetas reservadas al personal en la Home pública", () => {
      renderHomePage();

      expect(screen.queryByText("Bandeja de Expedientes")).not.toBeInTheDocument();
      expect(screen.queryByText("Panel de Administración")).not.toBeInTheDocument();
      expect(screen.queryByText("Ventanilla Presencial")).not.toBeInTheDocument();
      expect(screen.queryByText("Reportes y Tableros")).not.toBeInTheDocument();
      expect(screen.queryByText("Mis Expedientes")).not.toBeInTheDocument();
      expect(screen.queryByText("Casilla Electrónica")).not.toBeInTheDocument();
    });

    it("NO muestra badges técnicos de módulos bloqueados", () => {
      renderHomePage();

      expect(screen.queryByText("Requiere rol institucional")).not.toBeInTheDocument();
      expect(screen.queryByText("Requiere login")).not.toBeInTheDocument();
      expect(screen.queryByText("Acceso con rol asignado")).not.toBeInTheDocument();
    });
  });
});
