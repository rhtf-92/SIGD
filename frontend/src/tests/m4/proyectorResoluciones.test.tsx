import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi } from "vitest";

import PlantillaResolucionEditor from "../../components/flujos/PlantillaResolucionEditor";
import ProyectorResolucionesPage from "../../pages/flujos/ProyectorResolucionesPage";

describe("Suite de Pruebas de Proyector de Resoluciones Directorales (ENT-M04-02)", () => {
  it("renderiza el editor con los campos normativos obligatorios (Visto, Considerando, Resuelve)", () => {
    const handleGuardar = vi.fn();
    const handleFirma = vi.fn();

    render(
      <MemoryRouter>
        <PlantillaResolucionEditor
          onGuardarBorrador={handleGuardar}
          onProcederFirma={handleFirma}
        />
      </MemoryRouter>,
    );

    expect(screen.getByLabelText(/Tipo de Resolución \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/CUT de Expediente Vinculado \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre del Administrado \*/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Visto \(Expedientes y Actuados Previos\) \*/i)).toBeInTheDocument();
    expect(screen.getByText(/Parte Resolutiva \(Artículos\)/i)).toBeInTheDocument();
  });

  it("permite añadir y quitar considerandos dinámicamente", async () => {
    const user = userEvent.setup();
    const handleGuardar = vi.fn();
    const handleFirma = vi.fn();

    render(
      <MemoryRouter>
        <PlantillaResolucionEditor
          onGuardarBorrador={handleGuardar}
          onProcederFirma={handleFirma}
        />
      </MemoryRouter>,
    );

    const botonAgregar = screen.getByRole("button", { name: /\+ Añadir Considerando/i });
    await user.click(botonAgregar);

    // Debe existir un considerando adicional
    const botonesEliminar = screen.getAllByTitle(/Eliminar considerando/i);
    expect(botonesEliminar.length).toBeGreaterThan(1);
  });

  it("invoca onGuardarBorrador con el payload de la resolución al hacer clic en Guardar Borrador", async () => {
    const user = userEvent.setup();
    const handleGuardar = vi.fn();
    const handleFirma = vi.fn();

    render(
      <MemoryRouter>
        <PlantillaResolucionEditor
          onGuardarBorrador={handleGuardar}
          onProcederFirma={handleFirma}
        />
      </MemoryRouter>,
    );

    const botonGuardar = screen.getByRole("button", { name: /Guardar Borrador/i });
    await user.click(botonGuardar);

    expect(handleGuardar).toHaveBeenCalledTimes(1);
    expect(handleGuardar).toHaveBeenCalledWith(
      expect.objectContaining({
        numeroResolucion: expect.stringContaining("RD N.°"),
        tipo: "TITULACION",
      }),
    );
  });

  it("renderiza ProyectorResolucionesPage con el encabezado institucional y navegación accesible", () => {
    render(
      <MemoryRouter>
        <ProyectorResolucionesPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: /Proyector de Resoluciones Directorales y Actas/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Módulo 04 · Validez Legal y Firma Digital/i)).toBeInTheDocument();
  });
});
