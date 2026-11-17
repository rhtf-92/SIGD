import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { AxiosResponse } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { apiClient } from "../../../src/api/client";
import ExpedienteDetallePage from "../../../src/pages/expedientes/ExpedienteDetallePage";
import type { ExpedienteDetalleRutaDoc } from "../../../src/types/expediente";
import { useAuthStore } from "../../../src/stores/authStore";

const mockExpedienteDerivado: ExpedienteDetalleRutaDoc = {
  idExpediente: "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca",
  cut: "EXP-2026-000011",
  asunto: "Derecho de Reincorporación (Reingreso)",
  fechaRadicacion: "2026-10-27T18:23:27.000Z",
  estadoActual: "DERIVADO",
  areaActualId: "2b147b0d-7c8f-434f-b75a-598a1ccb855b",
  solicitanteId: "00000000-0000-0000-0000-000000000011",
  resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 5 },
  documentos: [
    {
      idDocumento: "doc-01",
      nombre: "Solicitud_reincorporacion.pdf",
      mimeType: "application/pdf",
      folioInicio: 1,
      folioFin: 2,
      tieneFirmaDigital: false,
    },
  ],
  ultimoMovimiento: {
    idMovimiento: "mov-deriv-01",
    evento: "DERIVACION",
    estadoNuevo: "DERIVADO",
    fechaHora: "2026-10-27T18:59:52.000Z",
    usuarioOperadorId: "990000000",
  },
  sla: null,
};

function renderDetalle(id: string = "9ef7bc8b-b0e1-4c46-9fe8-1c93d7d594ca") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/expedientes/${id}`]}>
        <Routes>
          <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

function setupGetMock(expediente: ExpedienteDetalleRutaDoc = mockExpedienteDerivado) {
  return vi.spyOn(apiClient, "get").mockImplementation(async (url: string) => {
    if (url.includes("/trazabilidad")) {
      return { data: { expedienteId: expediente.idExpediente, actuaciones: [] } } as AxiosResponse;
    }
    if (url.includes("/api/v1/areas")) {
      return {
        data: [{ id: "area-destino-01", nombre: "Secretaría Académica", estado: "Activo" }],
      } as AxiosResponse;
    }
    if (url.includes("/api/v1/expedientes/")) {
      return { data: expediente } as AxiosResponse;
    }
    return { data: {} } as AxiosResponse;
  });
}

describe("TSK-DEV-03C: Desacoplamiento de autorizaciones RBAC en ExpedienteDetallePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.setState({
      usuario: {
        id: "11111111-1111-4111-8111-111111111111",
        nombreCompleto: "Operador de prueba",
        correo: "operador@example.invalid",
        rol: "MESA_PARTES",
        permisos: [
          { codigo: "EXPEDIENTE_RECEPCIONAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
          { codigo: "EXPEDIENTE_DERIVAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
          { codigo: "EXPEDIENTE_ADJUNTAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
        ],
      },
    });
  });

  afterEach(() => {
    useAuthStore.setState({ usuario: null });
  });

  it("1. No ofrece recepcion sin una facultad persistida, aunque el expediente sea DERIVADO", async () => {
    useAuthStore.setState({ usuario: null });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();
    await screen.findByRole("heading", { name: mockExpedienteDerivado.cut });
    expect(screen.queryByRole("button", { name: /Recepcionar Expediente/ })).toBeNull();
  });

  it("2. Muestra el botón '✓ Recepcionar Expediente' cuando cuenta con EXPEDIENTE_RECEPCIONAR y estado es DERIVADO", async () => {
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    expect(btnRecepcionar).toBeInTheDocument();
    expect(btnRecepcionar).toBeEnabled();
  });

  it("3. NO muestra el botón '✓ Recepcionar Expediente' si el estado ya es EN_REVISION", async () => {
    setupGetMock({ ...mockExpedienteDerivado, estadoActual: "EN_REVISION" });
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
  });

  it("4. Al pulsar 'Recepcionar', invoca el endpoint POST /api/v1/expedientes/:id/recepcionar y muestra éxito", async () => {
    setupGetMock(mockExpedienteDerivado);

    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: {
        ok: true,
        mensaje: "Recepción formal registrada exitosamente.",
        nuevoEstado: "EN_REVISION",
        secuencia: "3",
      },
    } as AxiosResponse);

    renderDetalle();

    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    fireEvent.click(btnRecepcionar);

    await waitFor(() => {
      expect(postSpy).toHaveBeenCalledWith(
        `/api/v1/expedientes/${mockExpedienteDerivado.idExpediente}/recepcionar`,
        {},
      );
    });

    expect(await screen.findByText(/Expediente recepcionado formalmente/)).toBeInTheDocument();
  });

  it("5. Muestra mensaje de error cuando el servidor rechaza la recepción (409 Conflict)", async () => {
    setupGetMock(mockExpedienteDerivado);

    vi.spyOn(apiClient, "post").mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          code: "EXPEDIENTE_YA_RECEPCIONADO",
          message: "El expediente ya fue recepcionado.",
        },
      },
    });

    renderDetalle();

    const btnRecepcionar = await screen.findByRole("button", { name: "✓ Recepcionar Expediente" });
    fireEvent.click(btnRecepcionar);

    expect(await screen.findByRole("alert")).toHaveTextContent(
      /El expediente cambió o la acción no corresponde a su estado actual/,
    );
  });

  it("6. Muestra el botón 'Proyectar Resolución' cuando el estado es EN_REVISION", async () => {
    setupGetMock({ ...mockExpedienteDerivado, estadoActual: "EN_REVISION" });
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    const btnProyectar = await screen.findByRole("button", { name: "Proyectar Resolución" });
    expect(btnProyectar).toBeInTheDocument();
    expect(btnProyectar).toBeEnabled();
  });

  it("7. HAL-B03-08: Usuario SOLO con EXPEDIENTE_DERIVAR NO puede recepcionar", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-solo-derivar",
        nombreCompleto: "Derivador puro",
        correo: "derivar@example.invalid",
        rol: "SECRETARIO",
        permisos: [{ codigo: "EXPEDIENTE_DERIVAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Derivar Expediente" })).toBeInTheDocument();
  });

  it("8. HAL-B03-08: Usuario SOLO con EXPEDIENTE_RESOLVER NO puede recepcionar", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-solo-resolver",
        nombreCompleto: "Resolutor puro",
        correo: "resolver@example.invalid",
        rol: "DIRECTOR",
        permisos: [{ codigo: "EXPEDIENTE_RESOLVER", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
  });

  it("9. HAL-B03-04: Usuario con EXPEDIENTE_ADJUNTAR puede digitalizar", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-adjuntar",
        nombreCompleto: "Digitalizador",
        correo: "adjuntar@example.invalid",
        rol: "OPERADOR",
        permisos: [{ codigo: "EXPEDIENTE_ADJUNTAR", ambito: "GLOBAL", areaId: null }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Digitalizar Documentos/ })).toBeInTheDocument();
  });

  it("10. HAL-B03-04: Usuario SIN EXPEDIENTE_ADJUNTAR no puede digitalizar (incluso con roles directivos)", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-sin-adjuntar",
        nombreCompleto: "Director sin adjuntar",
        correo: "dir@example.invalid",
        rol: "DIRECTOR",
        roles: ["DIRECTOR"],
        permisos: [{ codigo: "EXPEDIENTE_LEER", ambito: "GLOBAL", areaId: null }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Digitalizar Documentos/ })).not.toBeInTheDocument();
  });

  it("11. B03-10: Usuario con EXPEDIENTE_DERIVAR puede derivar expediente", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-derivar",
        nombreCompleto: "Derivador autorizado",
        correo: "derivar@example.invalid",
        rol: "ASISTENTE",
        permisos: [{ codigo: "EXPEDIENTE_DERIVAR", ambito: "GLOBAL", areaId: null }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Derivar Expediente" })).toBeInTheDocument();
  });

  it("12. B03-10: Usuario SIN EXPEDIENTE_DERIVAR no puede derivar expediente", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-sin-derivar",
        nombreCompleto: "Solo lectura",
        correo: "lector@example.invalid",
        rol: "DOCENTE",
        permisos: [{ codigo: "EXPEDIENTE_LEER", ambito: "GLOBAL", areaId: null }],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();
  });

  it("13. Fail-Closed: Usuario con permisos vacíos [] no puede ejecutar ninguna operación", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-vacio",
        nombreCompleto: "Usuario vacío",
        correo: "vacio@example.invalid",
        rol: "ADMINISTRADOR",
        roles: ["ADMINISTRADOR"],
        permisos: [],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Digitalizar Documentos/ })).not.toBeInTheDocument();
  });

  it("14. Fail-Closed: Usuario con permisos ausentes (undefined) no puede ejecutar ninguna operación", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-undefined",
        nombreCompleto: "Usuario sin permisos",
        correo: "sinpermisos@example.invalid",
        rol: "DIRECTOR",
        roles: ["DIRECTOR"],
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Digitalizar Documentos/ })).not.toBeInTheDocument();
  });

  it("15. GESTOR_APOYO_AREA: Con contexto activo y ámbito AREA coincidente, puede digitalizar, recepcionar y derivar", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-gestor",
        nombreCompleto: "Gestor de Apoyo",
        correo: "gestor@example.invalid",
        rol: "",
        capacidadActiva: "GESTOR_APOYO_AREA",
        contextoActivo: {
          idAsignacion: "asig-gestor-1",
          tipo: "CAPACIDAD",
          codigo: "GESTOR_APOYO_AREA",
          nombre: "Gestor de Apoyo de Área",
          areaId: mockExpedienteDerivado.areaActualId,
          areaNombre: "Área Actual",
          permisos: [
            { codigo: "EXPEDIENTE_RECEPCIONAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
            { codigo: "EXPEDIENTE_DERIVAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
            { codigo: "EXPEDIENTE_ADJUNTAR", ambito: "AREA", areaId: mockExpedienteDerivado.areaActualId },
          ],
          vigenteDesde: "2026-01-01T00:00:00Z",
          vigenteHasta: null,
          activo: true,
        },
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "✓ Recepcionar Expediente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Derivar Expediente" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Digitalizar Documentos/ })).toBeInTheDocument();
  });

  it("16. GESTOR_APOYO_AREA: Con ámbito AREA no coincidente (área ajena), NO puede digitalizar, recepcionar ni derivar", async () => {
    useAuthStore.setState({
      usuario: {
        id: "usr-gestor-ajeno",
        nombreCompleto: "Gestor de Área Ajena",
        correo: "gestorajeno@example.invalid",
        rol: "",
        capacidadActiva: "GESTOR_APOYO_AREA",
        contextoActivo: {
          idAsignacion: "asig-gestor-ajeno",
          tipo: "CAPACIDAD",
          codigo: "GESTOR_APOYO_AREA",
          nombre: "Gestor de Apoyo de Área Ajena",
          areaId: "00000000-0000-0000-0000-area-ajena-0000",
          areaNombre: "Área Ajena",
          permisos: [
            { codigo: "EXPEDIENTE_RECEPCIONAR", ambito: "AREA", areaId: "00000000-0000-0000-0000-area-ajena-0000" },
            { codigo: "EXPEDIENTE_DERIVAR", ambito: "AREA", areaId: "00000000-0000-0000-0000-area-ajena-0000" },
            { codigo: "EXPEDIENTE_ADJUNTAR", ambito: "AREA", areaId: "00000000-0000-0000-0000-area-ajena-0000" },
          ],
          vigenteDesde: "2026-01-01T00:00:00Z",
          vigenteHasta: null,
          activo: true,
        },
      },
    });
    setupGetMock(mockExpedienteDerivado);
    renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "✓ Recepcionar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Digitalizar Documentos/ })).not.toBeInTheDocument();
  });

  it("17. Conmutación de contexto institucional actualiza las facultades inmediatamente", async () => {
    // Inicialmente con contexto sin permisos de derivación
    useAuthStore.setState({
      usuario: {
        id: "usr-switch",
        nombreCompleto: "Usuario Multicontexto",
        correo: "switch@example.invalid",
        rol: "DOCENTE",
        contextoActivo: {
          idAsignacion: "asig-docente",
          tipo: "ROL",
          codigo: "DOCENTE",
          nombre: "Docente",
          areaId: null,
          areaNombre: null,
          permisos: [{ codigo: "EXPEDIENTE_LEER", ambito: "GLOBAL", areaId: null }],
          vigenteDesde: "2026-01-01T00:00:00Z",
          vigenteHasta: null,
          activo: true,
        },
      },
    });
    setupGetMock(mockExpedienteDerivado);
    const { rerender } = renderDetalle();

    expect(await screen.findByRole("heading", { name: "EXP-2026-000011" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();

    // Conmuta a contexto con EXPEDIENTE_DERIVAR
    useAuthStore.setState({
      usuario: {
        id: "usr-switch",
        nombreCompleto: "Usuario Multicontexto",
        correo: "switch@example.invalid",
        rol: "SECRETARIO",
        contextoActivo: {
          idAsignacion: "asig-secretario",
          tipo: "ROL",
          codigo: "SECRETARIO",
          nombre: "Secretario General",
          areaId: null,
          areaNombre: null,
          permisos: [{ codigo: "EXPEDIENTE_DERIVAR", ambito: "GLOBAL", areaId: null }],
          vigenteDesde: "2026-01-01T00:00:00Z",
          vigenteHasta: null,
          activo: true,
        },
      },
    });

    rerender(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <MemoryRouter initialEntries={[`/expedientes/${mockExpedienteDerivado.idExpediente}`]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(await screen.findByRole("button", { name: "Derivar Expediente" })).toBeInTheDocument();
  });
});
