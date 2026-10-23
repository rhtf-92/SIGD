import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UsuariosPage from "@/pages/administracion/UsuariosPage";
import { DEBOUNCE_BUSQUEDA_MS, type Usuario } from "@/types/usuarioAdmin";

const get = vi.fn();

vi.mock("@/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
  },
}));

const USUARIOS: Usuario[] = [
  {
    id: "1",
    nombre: "Juan Carlos Pérez",
    dni: "71234567",
    correo: "jperez@iestpsuiza.edu.pe",
    sede: "Sede Principal",
    area: "Mesa de Partes",
    cargo: "Asistente Administrativo",
    rol: "Operador",
    estado: "Activo",
    ultimoAcceso: "29/08/2026 09:42",
  },
  {
    id: "2",
    nombre: "María Fernanda López",
    dni: "74561238",
    correo: "mlopez@iestpsuiza.edu.pe",
    sede: "Sede Principal",
    area: "Secretaría Académica",
    cargo: "Secretaria Académica",
    rol: "Responsable de Área",
    estado: "Inactivo",
    ultimoAcceso: "29/08/2026 08:35",
  },
];

function montarConProvider() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });

  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <UsuariosPage />
      </QueryClientProvider>
    </MemoryRouter>,
  );
}

describe("UsuariosPage — H-04 / H-05: Directorio de Usuarios (Solo Lectura)", () => {
  beforeEach(() => {
    get.mockResolvedValue({ data: { data: USUARIOS } });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renderiza los usuarios devueltos por GET /api/v1/admin/usuarios", async () => {
    montarConProvider();

    expect(
      await screen.findByText("Juan Carlos Pérez"),
    ).toBeInTheDocument();
    expect(screen.getByText("María Fernanda López")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      "/api/v1/admin/usuarios",
      expect.objectContaining({ params: expect.any(Object) }),
    );
  });

  it("presenta explícitamente el encabezado de solo lectura y no expone botones de mutación simulada", async () => {
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    expect(screen.getByText("Directorio de Usuarios (Solo Lectura)")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /administrar/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /conmutar estado/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
  });

  it("expone los filtros de servidor por unidad orgánica, rol y estado con sede deshabilitada", async () => {
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    expect(screen.getByLabelText("Unidad orgánica")).toBeInTheDocument();
    expect(screen.getByLabelText("Rol asignado")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado")).toBeInTheDocument();
    const selectSede = screen.getByLabelText(/sede/i);
    expect(selectSede).toBeInTheDocument();
    expect(selectSede).toBeDisabled();
  });

  it("aplica el filtro de estado sin código de filtrado ficticio", async () => {
    const usuario = userEvent.setup();
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    await usuario.selectOptions(screen.getByLabelText("Estado"), "Inactivo");

    await waitFor(() => {
      const ultimaLlamada = get.mock.calls.at(-1)?.[1] as {
        params: Record<string, unknown>;
      };
      expect(ultimaLlamada.params.estado).toBe("Inactivo");
    });
  });

  it("aplaza la consulta del buscador mediante debounce de 300 ms", async () => {
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    vi.useFakeTimers();

    const llamadasIniciales = get.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Buscar usuario"), {
      target: { value: "Pérez" },
    });

    expect(get.mock.calls.length).toBe(llamadasIniciales);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_BUSQUEDA_MS);
    });

    const ultimaLlamada = get.mock.calls.at(-1)?.[1] as {
      params: Record<string, unknown>;
    };
    expect(ultimaLlamada.params.busqueda).toBe("Pérez");
  });
});
