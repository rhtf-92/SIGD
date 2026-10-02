import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import UsuariosPage from "@/pages/administracion/UsuariosPage";
import { ApiHttpError } from "@/types/api";
import { DEBOUNCE_BUSQUEDA_MS, type Usuario } from "@/types/usuarioAdmin";

const get = vi.fn();
const put = vi.fn();
const patch = vi.fn();

vi.mock("@/api/client", () => ({
  apiClient: {
    get: (...args: unknown[]) => get(...args),
    put: (...args: unknown[]) => put(...args),
    patch: (...args: unknown[]) => patch(...args),
  },
}));

const USUARIOS: Usuario[] = [
  {
    id: 1,
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
    id: 2,
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

function problemaDuplicado(campo: string, motivo: string) {
  return new ApiHttpError({
    type: "https://sigd.iestpsuiza.edu.pe/errors/conflict",
    title: "Conflicto de unicidad institucional",
    status: 409,
    detail: "Ya existe un usuario registrado con el mismo valor.",
    instance: "/api/v1/usuarios/1",
    code: "ERR_USUARIO_DUPLICADO",
    category: "Conflict",
    correlationId: "9f1c3a52-0d8e-4c1a-9c3b-7d2e5a6b8c40",
    invalidParams: [{ name: campo, reason: motivo }],
    retryable: false,
  });
}

describe("UsuariosPage — ENT-M05-02 / T-FE-ADM-04 (filtrado y edición de usuarios)", () => {
  beforeEach(() => {
    get.mockResolvedValue({ data: { data: USUARIOS } });
    put.mockResolvedValue({ data: USUARIOS[0] });
    patch.mockResolvedValue({ data: { ...USUARIOS[0], estado: "Inactivo" } });
  });

  afterEach(() => {
    // Se restauran los temporizadores reales aunque un caso falle, para no
    // arrastrar la falsificación de timers a los casos siguientes.
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("renderiza los usuarios devueltos por GET /api/v1/usuarios", async () => {
    montarConProvider();

    expect(
      await screen.findByText("Juan Carlos Pérez"),
    ).toBeInTheDocument();
    expect(screen.getByText("María Fernanda López")).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      "/api/v1/usuarios",
      expect.objectContaining({ params: expect.any(Object) }),
    );
  });

  it("expone los filtros de servidor por unidad orgánica, sede, rol y estado", async () => {
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    expect(screen.getByLabelText("Unidad orgánica")).toBeInTheDocument();
    expect(screen.getByLabelText("Sede")).toBeInTheDocument();
    expect(screen.getByLabelText("Rol asignado")).toBeInTheDocument();
    expect(screen.getByLabelText("Estado")).toBeInTheDocument();
  });

  it("aplica el filtro de estado sin volver a escribir código de filtrado local", async () => {
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

    // Los temporizadores falsos se activan solo tras el primer render para
    // que la resolución de la consulta inicial no quede congelada.
    vi.useFakeTimers();

    const llamadasIniciales = get.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Buscar usuario"), {
      target: { value: "Pérez" },
    });

    // La pulsación no debe disparar peticiones de forma inmediata.
    expect(get.mock.calls.length).toBe(llamadasIniciales);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(DEBOUNCE_BUSQUEDA_MS);
    });

    const ultimaLlamada = get.mock.calls.at(-1)?.[1] as {
      params: Record<string, unknown>;
    };
    expect(ultimaLlamada.params.busqueda).toBe("Pérez");
  });

  it("abre el modal de administración con los datos del usuario seleccionado", async () => {
    const usuario = userEvent.setup();
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    const fila = screen.getByText("Juan Carlos Pérez").closest("tr");
    expect(fila).not.toBeNull();
    await usuario.click(within(fila as HTMLElement).getByRole("button", { name: "Administrar" }));

    const dialogo = await screen.findByRole("dialog");
    expect(within(dialogo).getByLabelText("Correo institucional")).toHaveValue(
      "jperez@iestpsuiza.edu.pe",
    );
    expect(within(dialogo).getByLabelText("Cargo")).toHaveValue(
      "Asistente Administrativo",
    );
  });

  it("persiste la edición con PUT /api/v1/usuarios/:id y refresca la tabla sin F5", async () => {
    const usuario = userEvent.setup();
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    const fila = screen.getByText("Juan Carlos Pérez").closest("tr");
    await usuario.click(within(fila as HTMLElement).getByRole("button", { name: "Administrar" }));

    const dialogo = await screen.findByRole("dialog");
    await usuario.clear(within(dialogo).getByLabelText("Cargo"));
    await usuario.type(within(dialogo).getByLabelText("Cargo"), "Jefe de Mesa de Partes");
    await usuario.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }));

    await waitFor(() => {
      expect(put).toHaveBeenCalledWith(
        "/api/v1/usuarios/1",
        expect.objectContaining({ cargo: "Jefe de Mesa de Partes" }),
      );
    });

    expect(
      await screen.findByText(
        "Los cambios fueron registrados correctamente.",
      ),
    ).toBeInTheDocument();
  });

  it("expone el error RFC 7807 en el campo infractor ante un 409 Conflict de correo duplicado", async () => {
    put.mockRejectedValueOnce(
      problemaDuplicado(
        "correo",
        "Ya existe una cuenta institucional registrada con este correo.",
      ),
    );

    const usuario = userEvent.setup();
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    const fila = screen.getByText("Juan Carlos Pérez").closest("tr");
    await usuario.click(within(fila as HTMLElement).getByRole("button", { name: "Administrar" }));

    const dialogo = await screen.findByRole("dialog");
    const campoCorreo = within(dialogo).getByLabelText("Correo institucional");
    // Correo del dominio institucional: la validación de cliente lo acepta y
    // el conflicto de duplicidad lo devuelve el servidor como 409.
    await usuario.clear(campoCorreo);
    await usuario.type(campoCorreo, "jperez@iestpsuiza.edu.pe");
    await usuario.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }));

    expect(
      await within(dialogo).findByText(
        "Ya existe una cuenta institucional registrada con este correo.",
      ),
    ).toBeInTheDocument();
    expect(campoCorreo).toHaveAttribute("aria-invalid", "true");
  });

  it("rechaza en cliente un correo fuera del dominio institucional y no llama a la API", async () => {
    const usuario = userEvent.setup();
    montarConProvider();
    await screen.findByText("Juan Carlos Pérez");

    const fila = screen.getByText("Juan Carlos Pérez").closest("tr");
    await usuario.click(within(fila as HTMLElement).getByRole("button", { name: "Administrar" }));

    const dialogo = await screen.findByRole("dialog");
    const campoCorreo = within(dialogo).getByLabelText("Correo institucional");
    await usuario.clear(campoCorreo);
    await usuario.type(campoCorreo, "jperez@gmail.com");
    await usuario.click(within(dialogo).getByRole("button", { name: "Guardar cambios" }));

    expect(
      await within(dialogo).findByText(
        "El correo debe pertenecer al dominio @iestpsuiza.edu.pe.",
      ),
    ).toBeInTheDocument();
    expect(put).not.toHaveBeenCalled();
  });
});
