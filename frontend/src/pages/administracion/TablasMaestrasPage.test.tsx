import "@testing-library/jest-dom/vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import TablasMaestrasPage from "./TablasMaestrasPage";
import { apiClient } from "../../api/client";

vi.mock("../../components/administracion/AdminPageHeader", () => ({
  default: ({ title, description }: { title: string; description: string }) => (
    <header data-testid="admin-header">
      <h1>{title}</h1>
      <p>{description}</p>
    </header>
  ),
}));

describe("TablasMaestrasPage - Trazabilidad y Sede Única", () => {
  let getSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    getSpy = vi.spyOn(apiClient, "get").mockImplementation((url: string) => {
      if (url.includes("tipo-documento")) {
        return Promise.resolve({
          data: [
            { id: "1", codigo: "SOL", nombre: "Solicitud / FUT", tamano_maximo_mb: 25, exige_firma: false, vigente: true },
            { id: "2", codigo: "RD", nombre: "Resolución Directoral", tamano_maximo_mb: 50, exige_firma: true, vigente: true },
          ],
        });
      }
      if (url.includes("organigrama")) {
        return Promise.resolve({
          data: [
            { id: 1, codigo: "ARE_DIR", nombre: "Dirección General", path: "01" },
            { id: 2, codigo: "ARE_SEC", nombre: "Secretaría Académica", path: "01.01" },
          ],
        });
      }
      return Promise.resolve({ data: [] });
    });
  });

  afterEach(() => {
    getSpy.mockRestore();
  });

  it("elimina la pestaña 'Sedes' y muestra la insignia institucional de Sede Única en Ucayali", async () => {
    render(<TablasMaestrasPage />);

    // Verifica que NO existe la pestaña Sedes
    expect(screen.queryByRole("button", { name: /^Sedes$/i })).not.toBeInTheDocument();

    // Verifica que existe la insignia institucional de Sede Única en Ucayali
    expect(screen.getByText(/Entidad Unisede Institucional — Región Ucayali/i)).toBeInTheDocument();
    expect(screen.getByText(/Sede Única Activa/i)).toBeInTheDocument();
  });

  it("renderiza las 5 pestañas de trazabilidad y gestión procesal", async () => {
    render(<TablasMaestrasPage />);

    expect(screen.getByRole("button", { name: /Tipos documentales/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Áreas y Organigrama/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Estados de trámite \(FSM\)/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Acciones de trazabilidad/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Transiciones de flujo/i })).toBeInTheDocument();
  });

  it("muestra por defecto el catálogo de Tipos Documentales con firma digital y tamaño", async () => {
    render(<TablasMaestrasPage />);

    await waitFor(() => {
      expect(screen.getByText("Solicitud / FUT")).toBeInTheDocument();
      expect(screen.getByText("Resolución Directoral")).toBeInTheDocument();
    });

    expect(screen.getAllByText(/Exige Firma/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Sin Firma/i).length).toBeGreaterThan(0);
  });

  it("permite cambiar a la pestaña de 'Estados de trámite (FSM)' y ver el ciclo de vida", async () => {
    const user = userEvent.setup();
    render(<TablasMaestrasPage />);

    const tabEstados = screen.getByRole("button", { name: /Estados de trámite \(FSM\)/i });
    await user.click(tabEstados);

    expect(screen.getByText("REGISTRADO")).toBeInTheDocument();
    expect(screen.getByText("ARCHIVADO")).toBeInTheDocument();
    expect(screen.getAllByText("Terminal").length).toBeGreaterThan(0);
  });

  it("permite cambiar a la pestaña de 'Áreas y Organigrama' y visualizar la jerarquía institucional", async () => {
    const user = userEvent.setup();
    render(<TablasMaestrasPage />);

    const tabAreas = screen.getByRole("button", { name: /Áreas y Organigrama/i });
    await user.click(tabAreas);

    expect(screen.getByText(/Organigrama Institucional Jerárquico/i)).toBeInTheDocument();
    expect(screen.getAllByText("Dirección General").length).toBeGreaterThan(0);
  });

  it("filtra registros reactivamente mediante el campo de búsqueda", async () => {
    const user = userEvent.setup();
    render(<TablasMaestrasPage />);

    await waitFor(() => {
      expect(screen.getByText("Resolución Directoral")).toBeInTheDocument();
    });

    const inputBusqueda = screen.getByPlaceholderText(/Buscar por código, nombre o detalle/i);
    await user.type(inputBusqueda, "FUT");

    expect(screen.getByText("Solicitud / FUT")).toBeInTheDocument();
    expect(screen.queryByText("Resolución Directoral")).not.toBeInTheDocument();
  });

  it("permite alternar el estado lógico preservando la trazabilidad histórica", async () => {
    const user = userEvent.setup();
    render(<TablasMaestrasPage />);

    await waitFor(() => {
      expect(screen.getByText("Solicitud / FUT")).toBeInTheDocument();
    });

    const botonesInactivar = screen.getAllByRole("button", { name: /Inactivar/i });
    await user.click(botonesInactivar[0]!);

    expect(
      screen.getByText(/desactivado \(borrado lógico\).*La trazabilidad histórica procesal de los trámites se encuentra preservada/i),
    ).toBeInTheDocument();
  });

  it("permite agregar un nuevo registro paramétrico", async () => {
    const user = userEvent.setup();
    render(<TablasMaestrasPage />);

    const btnNuevo = screen.getByRole("button", { name: /\+? ?Nuevo registro/i });
    await user.click(btnNuevo);

    const inputCodigo = screen.getByPlaceholderText(/Ej\. ACT_COMP, RES_REC/i);
    const inputNombre = screen.getByPlaceholderText(/Nombre oficial del registro/i);
    const inputDetalle = screen.getByPlaceholderText(/Descripción funcional en el flujo/i);

    await user.type(inputCodigo, "DICTAMEN");
    await user.type(inputNombre, "Dictamen Técnico Legal");
    await user.type(inputDetalle, "Opinión jurídica de asesoría legal");

    const btnGuardar = screen.getByRole("button", { name: /Guardar registro/i });
    await user.click(btnGuardar);

    expect(screen.getByText(/Registro DICTAMEN añadido satisfactoriamente al catálogo/i)).toBeInTheDocument();
    expect(screen.getByText("Dictamen Técnico Legal")).toBeInTheDocument();
  });
});
