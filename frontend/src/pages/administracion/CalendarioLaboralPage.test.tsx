import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMocks = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  apiClient: {
    get: apiMocks.get,
    post: apiMocks.post,
    put: apiMocks.put,
    delete: apiMocks.delete,
  },
}));

import { apiClient } from "../../api/client";
import CalendarioLaboralPage from "./CalendarioLaboralPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <CalendarioLaboralPage />
    </MemoryRouter>,
  );
}

describe("CalendarioLaboralPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("muestra solo los feriados devueltos por la API en la pestaña de no laborables", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        calendario: [
          {
            id_calendario: "f1111111-1111-4111-8111-111111111111",
            fecha: "2099-01-02",
            descripcion: "AUDITORIA - feriado ficticio uno",
            es_laborable: false,
            tipo_feriado: "NACIONAL",
          },
          {
            id_calendario: "f2222222-2222-4222-8222-222222222222",
            fecha: "2099-03-04",
            descripcion: "AUDITORIA - feriado ficticio dos",
            es_laborable: false,
            tipo_feriado: "REGIONAL_UCAYALI",
          },
          {
            id_calendario: "f3333333-3333-4333-8333-333333333333",
            fecha: "2099-05-06",
            descripcion: "AUDITORIA - habilitación laborable ficticia",
            es_laborable: true,
            tipo_feriado: null,
          },
        ],
      },
    } as never);

    renderPage();

    expect(
      await screen.findByText("AUDITORIA - feriado ficticio uno"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AUDITORIA - feriado ficticio dos"),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("AUDITORIA - habilitación laborable ficticia"),
    ).not.toBeInTheDocument();

    // Ahora existen botones para gestión de feriados (+ Registrar Nuevo Feriado, Editar, Eliminar)
    expect(
      screen.getByRole("button", { name: /\+ Registrar Nuevo Feriado/i }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Editar$/i }).length).toBe(2);
    expect(screen.getAllByRole("button", { name: /^Eliminar$/i }).length).toBe(2);
  });

  it("muestra el estado vacío cuando la API no devuelve feriados", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { calendario: [] },
    } as never);

    renderPage();

    expect(
      await screen.findByText(
        "No hay feriados registrados en el calendario laboral.",
      ),
    ).toBeInTheDocument();
  });

  it("muestra el error de carga y permite reintentar", async () => {
    vi.mocked(apiClient.get)
      .mockRejectedValueOnce(new Error("AUDITORIA - error ficticio de carga"))
      .mockResolvedValueOnce({ data: { calendario: [] } } as never);

    renderPage();

    expect(
      await screen.findByText("AUDITORIA - error ficticio de carga"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));

    await waitFor(() => expect(apiClient.get).toHaveBeenCalledTimes(2));
    expect(
      await screen.findByText(
        "No hay feriados registrados en el calendario laboral.",
      ),
    ).toBeInTheDocument();
  });

  it("permite abrir el modal de registro y agregar un nuevo feriado exitosamente", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        calendario: [
          {
            id_calendario: "f1111111-1111-4111-8111-111111111111",
            fecha: "2026-06-24",
            descripcion: "Fiesta Patronal de San Juan",
            es_laborable: false,
            tipo_feriado: "REGIONAL_UCAYALI",
          },
        ],
      },
    } as never);

    vi.mocked(apiClient.post).mockResolvedValue({
      data: {
        id_calendario: "f9999999-9999-4999-8999-999999999999",
        fecha: "2026-11-20",
        descripcion: "Aniversario Institucional IESTP Suiza",
        es_laborable: false,
        tipo_feriado: "INSTITUCIONAL",
      },
    } as never);

    renderPage();

    expect(await screen.findByText("Fiesta Patronal de San Juan")).toBeInTheDocument();

    // Clic en registrar nuevo feriado
    fireEvent.click(screen.getByRole("button", { name: /\+ Registrar Nuevo Feriado/i }));

    expect(screen.getByText("Registrar Nuevo Feriado / Excepción")).toBeInTheDocument();

    // Rellenar formulario
    fireEvent.change(screen.getByLabelText(/Fecha del Feriado/i), {
      target: { value: "2026-11-20" },
    });
    fireEvent.change(screen.getByLabelText(/Denominación \/ Motivo/i), {
      target: { value: "Aniversario Institucional IESTP Suiza" },
    });

    // Guardar
    fireEvent.click(screen.getByRole("button", { name: /^Guardar Feriado$/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        "/api/v1/admin/calendario-laboral/feriado-excepcional",
        expect.objectContaining({
          fecha: "2026-11-20",
          descripcion: "Aniversario Institucional IESTP Suiza",
        }),
      );
    });

    expect(
      await screen.findByText(/Día "Aniversario Institucional IESTP Suiza" registrado exitosamente/i),
    ).toBeInTheDocument();
  });

  it("permite abrir el modal de edición y actualizar un feriado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        calendario: [
          {
            id_calendario: "f1111111-1111-4111-8111-111111111111",
            fecha: "2026-06-24",
            descripcion: "Fiesta de San Juan",
            es_laborable: false,
            tipo_feriado: "REGIONAL_UCAYALI",
          },
        ],
      },
    } as never);

    vi.mocked(apiClient.put).mockResolvedValue({
      data: {
        id_calendario: "f1111111-1111-4111-8111-111111111111",
        fecha: "2026-06-24",
        descripcion: "Fiesta Patronal de San Juan Bautista (Ucayali)",
        es_laborable: false,
        tipo_feriado: "REGIONAL_UCAYALI",
      },
    } as never);

    renderPage();

    expect(await screen.findByText("Fiesta de San Juan")).toBeInTheDocument();

    // Clic en editar
    fireEvent.click(screen.getByRole("button", { name: /^Editar$/i }));

    expect(screen.getByText("Editar Feriado / Excepción")).toBeInTheDocument();

    // Modificar descripción
    fireEvent.change(screen.getByLabelText(/Denominación \/ Motivo/i), {
      target: { value: "Fiesta Patronal de San Juan Bautista (Ucayali)" },
    });

    // Guardar cambios
    fireEvent.click(screen.getByRole("button", { name: /^Guardar Cambios$/i }));

    await waitFor(() => {
      expect(apiClient.put).toHaveBeenCalledWith(
        "/api/v1/admin/calendario-laboral/f1111111-1111-4111-8111-111111111111",
        expect.objectContaining({
          descripcion: "Fiesta Patronal de San Juan Bautista (Ucayali)",
        }),
      );
    });

    expect(
      await screen.findByText(/Registro de "Fiesta Patronal de San Juan Bautista \(Ucayali\)" actualizado correctamente/i),
    ).toBeInTheDocument();
  });

  it("permite abrir el modal de eliminación y borrar un feriado", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: {
        calendario: [
          {
            id_calendario: "f1111111-1111-4111-8111-111111111111",
            fecha: "2026-06-24",
            descripcion: "Feriado de prueba para borrar",
            es_laborable: false,
            tipo_feriado: "REGIONAL_UCAYALI",
          },
        ],
      },
    } as never);

    vi.mocked(apiClient.delete).mockResolvedValue({
      data: { eliminado: true },
    } as never);

    renderPage();

    expect(await screen.findByText("Feriado de prueba para borrar")).toBeInTheDocument();

    // Clic en eliminar
    fireEvent.click(screen.getByRole("button", { name: /^Eliminar$/i }));

    expect(screen.getByText("¿Eliminar feriado del calendario laboral?")).toBeInTheDocument();
    expect(screen.getByText(/Impacto SLA/i)).toBeInTheDocument();

    // Confirmar eliminación
    fireEvent.click(screen.getByRole("button", { name: /^Confirmar Eliminación$/i }));

    await waitFor(() => {
      expect(apiClient.delete).toHaveBeenCalledWith(
        "/api/v1/admin/calendario-laboral/f1111111-1111-4111-8111-111111111111",
      );
    });

    expect(
      await screen.findByText(/Día feriado eliminado exitosamente del calendario laboral/i),
    ).toBeInTheDocument();
  });

  it("permite cambiar al año 2025 y cargar los feriados históricos oficiales (gob.pe)", async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url: string) => {
      if (url.includes("anio=2025")) {
        return {
          data: {
            anio: 2025,
            anios_disponibles: [2025, 2026, 2027],
            calendario: [
              {
                id_calendario: "f2025-01",
                fecha: "2025-01-01",
                descripcion: "Año Nuevo",
                tipo_feriado: "NACIONAL",
                es_laborable: false,
                base_legal: "D. Leg. N° 713",
              },
              {
                id_calendario: "f2025-02",
                fecha: "2025-04-17",
                descripcion: "Jueves Santo",
                tipo_feriado: "NACIONAL",
                es_laborable: false,
                base_legal: "D. Leg. N° 713",
              },
              {
                id_calendario: "f2025-03",
                fecha: "2025-05-02",
                descripcion: "Día No Laborable Compensable (Sector Público)",
                tipo_feriado: "NACIONAL",
                es_laborable: false,
                base_legal: "D.S. N° 042-2025-PCM",
              },
              {
                id_calendario: "f2025-04",
                fecha: "2025-06-24",
                descripcion: "Fiesta Patronal de San Juan Bautista",
                tipo_feriado: "REGIONAL_UCAYALI",
                unidad_territorial: "UCAYALI",
                es_laborable: false,
                base_legal: "Ley N° 29001",
              },
            ],
          },
        } as never;
      }
      return {
        data: {
          anio: 2026,
          anios_disponibles: [2025, 2026, 2027],
          calendario: [
            {
              id_calendario: "f2026-01",
              fecha: "2026-01-01",
              descripcion: "Año Nuevo 2026",
              tipo_feriado: "NACIONAL",
              es_laborable: false,
            },
          ],
        },
      } as never;
    });

    renderPage();

    expect(await screen.findByText("Año Nuevo 2026")).toBeInTheDocument();

    // Cambiar selector al año 2025
    const selectAnio = screen.getByLabelText(/Año:/i);
    fireEvent.change(selectAnio, { target: { value: "2025" } });

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledWith("/api/v1/admin/calendario-laboral?anio=2025");
    });

    expect(await screen.findByText("Jueves Santo")).toBeInTheDocument();
    expect(screen.getByText("Día No Laborable Compensable (Sector Público)")).toBeInTheDocument();
    expect(screen.getByText("Fiesta Patronal de San Juan Bautista")).toBeInTheDocument();
  });
});
