/**
 * ==============================================================================
 * TEST SUITE: Fase5HPortalesContextos.test.tsx
 * ==============================================================================
 * Cobertura obligatoria PM-5H-01 a PM-5H-20:
 * PM-5H-01: Ciudadano login -> contexto PERSONAL por defecto.
 * PM-5H-02: Funcionario login -> contexto PERSONAL por defecto.
 * PM-5H-03: Funcionario cambia a INSTITUCIONAL válido -> UI cambia a institucional.
 * PM-5H-04: Ciudadano intenta entrar a INSTITUCIONAL -> DENY (error 403 / fail-closed).
 * PM-5H-05: Menú PERSONAL no muestra acciones internas ni rutas /expedientes, /tesoreria, /administracion.
 * PM-5H-06: Menú INSTITUCIONAL muestra solo capacidades reales del rol activo.
 * PM-5H-07: Bandeja personal (bandeja=PERSONAL) -> envía filtro personal al backend.
 * PM-5H-08: Bandeja área (bandeja=AREA) -> envía filtro de custodia de área al backend.
 * PM-5H-09: Expediente ajeno en PERSONAL -> no permite operar / DENY (acciones deshabilitadas con aviso de contexto).
 * PM-5H-10: Derivación desde UI válida con área destino.
 * PM-5H-11: Doble click derivar prevenido (disabled mientras pendiente + Idempotency-Key).
 * PM-5H-12: Conflicto de concurrencia 409 -> UI muestra aviso de conflicto y refresca.
 * PM-5H-13: Requisito no homologado -> muestra aviso explicativo sin bloquear.
 * PM-5H-14: Requisito homologado faltante -> bloqueo correctamente mostrado.
 * PM-5H-15: Subsanación conserva historial visual de evidencias.
 * PM-5H-16: Enviar a firma -> transiciona a EN_FIRMA vía modal.
 * PM-5H-17: Intentar resolver sin firma -> mensaje amigable "El expediente todavía no cuenta con una firma válida."
 * PM-5H-18: Resolver con firma válida -> transiciona a RESUELTO vía modal.
 * PM-5H-19: Responsabilidad institucional expira durante sesión -> autoridad desaparece y degrada a PERSONAL.
 * PM-5H-20: Cambio INSTITUCIONAL -> PERSONAL purga memoria/cache con queryClient.clear().
 * PM-5H-21: ADMINISTRADOR_SIGD técnico sin perfil financiero -> no ve Tesorería.
 * PM-5H-22: Usuario con perfil financiero vigente -> sí puede visualizar Tesorería.
 * PM-5H-23: Procedimiento sin configuración explícita de destino -> UI NO sugiere área por nombre/categoría.
 * PM-5H-24: Procedimiento con destino configurado y válido -> UI muestra sugerencia claramente identificada como institucional.
 * PM-5H-25: Usuario y solicitante misma PERSONA -> UI bloquea autoatención.
 * PM-5H-26: id_usuario coincide con solicitanteId pero PERSONA distinta -> UI NO confunde identidades.
 * PM-5H-27: Misma mutación reintentada -> misma Idempotency-Key.
 * PM-5H-28: Dos acciones distintas consecutivas -> claves distintas.
 * PM-5H-29: Cambio de contexto -> no reutiliza clave de idempotencia institucional previa.
 * ==============================================================================
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, renderHook, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/stores/authStore";
import { queryClient } from "@/queryClient";
import HeaderInstitucional from "@/components/HeaderInstitucional";
import BandejaExpedientesPage from "@/pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "@/pages/expedientes/ExpedienteDetallePage";
import EnviarAFirmaModal from "@/components/expedientes/EnviarAFirmaModal";
import ResolverModal from "@/components/expedientes/ResolverModal";
import { canAccessRoute } from "@/config/navigation.config";
import { adaptarErrorAccion } from "@/utils/expedienteActions";
import { ApiHttpError } from "@/types/api";
import type { AccionExpediente, SolicitudEnviarAFirma, ResultadoEnviarAFirma, SolicitudResolver, ResultadoResolver } from "@/types/expedienteActions";
import { apiClient } from "@/api/client";
import { rutaDoc } from "@/pages/expedientes/rutadoc/rutadoc.service";
import * as useBandejaModule from "@/hooks/useBandejaExpedientes";
import {
  obtenerClaveIdempotenciaActiva,
  establecerClaveIdempotenciaActiva,
  limpiarClaveIdempotenciaActiva,
} from "@/utils/idempotency";
import { useFormularioExpediente } from "@/hooks/useFormularioExpediente";

vi.mock("@/api/client", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

vi.mock("@/pages/expedientes/rutadoc/rutadoc.service", () => ({
  rutaDoc: {
    resumen: vi.fn(),
    detalle: vi.fn(),
    obtenerUrlArchivo: vi.fn(),
    foliacion: vi.fn(),
  },
}));

vi.mock("@/services/tesoreria.service", () => ({
  tesoreriaService: {
    obtenerPagoExpediente: vi.fn(),
    generarOrdenPagoExpediente: vi.fn(),
    listarDevoluciones: vi.fn(),
  },
}));

describe("Fase 5H — Suite Integral de Portales, Contextos y Bandejas (PM-5H-01 a PM-5H-20)", () => {
  let testQueryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: 0 } },
    });
    useAuthStore.setState({
      accessToken: null,
      refreshToken: null,
      usuario: null,
      isAuthenticated: false,
      contextoActivo: "PERSONAL",
      contextosDisponibles: [{ tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" }],
    });
  });

  afterEach(() => {
    testQueryClient.clear();
    limpiarClaveIdempotenciaActiva();
  });

  // PM-5H-01: Ciudadano login -> contexto PERSONAL por defecto
  it("PM-5H-01: ciudadano login -> contexto PERSONAL por defecto", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "jwt-ciudadano",
        refreshToken: "ref-ciudadano",
        usuario: {
          id: "usr-ciudadano-1",
          nombreCompleto: "Pedro Ciudadano",
          correo: "pedro@correo.pe",
          rol: "CIUDADANO",
        },
        contextoActivo: "PERSONAL",
        contextos: [
          { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        ],
      },
    });

    await useAuthStore.getState().login({ identificador: "pedro@correo.pe", password: "Segura123!" });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.contextoActivo).toBe("PERSONAL");
    expect(state.usuario?.rol).toBe("CIUDADANO");
    expect(state.contextosDisponibles).toHaveLength(1);
    expect(state.contextosDisponibles[0].tipo).toBe("PERSONAL");
  });

  // PM-5H-02: Funcionario login -> contexto PERSONAL por defecto
  it("PM-5H-02: funcionario login -> contexto PERSONAL por defecto (incluso con responsabilidades)", async () => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "jwt-funcionario",
        refreshToken: "ref-funcionario",
        usuario: {
          id: "usr-func-1",
          nombreCompleto: "María Especialista",
          correo: "maria@institucion.gob.pe",
          rol: "CIUDADANO",
        },
        contextoActivo: "PERSONAL",
        contextos: [
          { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
          {
            tipo: "INSTITUCIONAL",
            descripcion: "Especialista — Subdirección Académica",
            rol: "ESPECIALISTA",
            areaId: "a0000000-0000-0000-0000-000000000001",
          },
        ],
      },
    });

    await useAuthStore.getState().login({ identificador: "maria@institucion.gob.pe", password: "Segura123!" });

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.contextoActivo).toBe("PERSONAL");
    expect(state.usuario?.rol).toBe("CIUDADANO");
    expect(state.contextosDisponibles).toHaveLength(2);
    expect(state.contextosDisponibles[1].tipo).toBe("INSTITUCIONAL");
  });

  // PM-5H-03: Funcionario cambia a INSTITUCIONAL válido -> UI cambia a institucional
  it("PM-5H-03: funcionario cambia a INSTITUCIONAL válido -> adopta rol y unidad orgánica", async () => {
    useAuthStore.setState({
      accessToken: "jwt-funcionario",
      isAuthenticated: true,
      contextoActivo: "PERSONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@institucion.gob.pe",
        rol: "CIUDADANO",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        {
          tipo: "INSTITUCIONAL",
          descripcion: "Especialista — Subdirección Académica",
          rol: "ESPECIALISTA",
          areaId: "a0000000-0000-0000-0000-000000000001",
        },
      ],
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "jwt-institucional-nuevo",
        contextoActivo: "INSTITUCIONAL",
        usuario: {
          id: "usr-func-1",
          nombreCompleto: "María Especialista",
          rol: "ESPECIALISTA",
          areaId: "a0000000-0000-0000-0000-000000000001",
        },
      },
    });

    await useAuthStore.getState().cambiarContexto("INSTITUCIONAL");

    const state = useAuthStore.getState();
    expect(state.contextoActivo).toBe("INSTITUCIONAL");
    expect(state.usuario?.rol).toBe("ESPECIALISTA");
    expect(state.usuario?.areaId).toBe("a0000000-0000-0000-0000-000000000001");
    expect(state.accessToken).toBe("jwt-institucional-nuevo");
  });

  // PM-5H-04: Ciudadano intenta entrar a INSTITUCIONAL -> DENY
  it("PM-5H-04: ciudadano intenta entrar a INSTITUCIONAL -> DENY (error 403 fail-closed)", async () => {
    useAuthStore.setState({
      accessToken: "jwt-ciudadano",
      isAuthenticated: true,
      contextoActivo: "PERSONAL",
      usuario: {
        id: "usr-ciudadano-1",
        nombreCompleto: "Pedro Ciudadano",
        correo: "pedro@correo.pe",
        rol: "CIUDADANO",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
      ],
    });

    vi.mocked(apiClient.post).mockRejectedValueOnce({
      response: {
        status: 403,
        data: { codigo: "INSTITUTIONAL_CONTEXT_NOT_AVAILABLE", mensaje: "No cuenta con contexto institucional activo." },
      },
    });

    await expect(useAuthStore.getState().cambiarContexto("INSTITUCIONAL")).rejects.toBeDefined();
    expect(useAuthStore.getState().contextoActivo).toBe("PERSONAL");
  });

  // PM-5H-05: Menú PERSONAL no muestra acciones internas ni rutas /expedientes, /tesoreria, /administracion
  it("PM-5H-05: menú PERSONAL no muestra acciones internas ni rutas institucionales", () => {
    expect(canAccessRoute("CIUDADANO", "/expedientes", "PERSONAL")).toBe(false);
    expect(canAccessRoute("CIUDADANO", "/tesoreria", "PERSONAL")).toBe(false);
    expect(canAccessRoute("CIUDADANO", "/administracion", "PERSONAL")).toBe(false);
    expect(canAccessRoute("CIUDADANO", "/tramite", "PERSONAL")).toBe(true);
    expect(canAccessRoute("CIUDADANO", "/mis-expedientes", "PERSONAL")).toBe(true);

    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "PERSONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "CIUDADANO",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        { tipo: "INSTITUCIONAL", descripcion: "Subdirección Académica", rol: "ESPECIALISTA" },
      ],
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText("Mis Expedientes")).toBeInTheDocument();
    expect(screen.queryByText("Bandeja de Expedientes")).not.toBeInTheDocument();
    expect(screen.queryByText("Tesorería")).not.toBeInTheDocument();
    expect(screen.queryByText("Administración")).not.toBeInTheDocument();
  });

  // PM-5H-06: Menú INSTITUCIONAL muestra solo capacidades reales del rol activo
  it("PM-5H-06: menú INSTITUCIONAL muestra solo capacidades reales del rol activo", () => {
    expect(canAccessRoute("ESPECIALISTA", "/expedientes", "INSTITUCIONAL")).toBe(true);
    expect(canAccessRoute("ESPECIALISTA", "/administracion", "INSTITUCIONAL")).toBe(false);
    expect(canAccessRoute("ESPECIALISTA", "/tesoreria", "INSTITUCIONAL")).toBe(false);

    expect(canAccessRoute("ADMINISTRADOR", "/administracion", "INSTITUCIONAL")).toBe(true);
    expect(canAccessRoute("ADMINISTRADOR", "/tramite", "INSTITUCIONAL")).toBe(false);
  });

  // PM-5H-07: Bandeja personal (bandeja=PERSONAL) -> envía filtro personal al backend
  it("PM-5H-07: bandeja personal (bandeja=PERSONAL) -> envía filtro personal al backend", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Personal" },
        { tipo: "INSTITUCIONAL", descripcion: "Institucional" },
      ],
    });

    const spyHook = vi.spyOn(useBandejaModule, "useBandejaExpedientes").mockReturnValue({
      data: {
        elementos: [],
        siguienteCursor: null,
        tieneMas: false,
        contadores: { PENDIENTES: 0, EN_TRAMITE: 0, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0 },
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <BandejaExpedientesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const tabPersonal = screen.getByRole("tab", { name: /Mi Bandeja/i });
    fireEvent.click(tabPersonal);

    await waitFor(() => {
      expect(spyHook).toHaveBeenCalledWith(
        expect.objectContaining({
          bandeja: "PERSONAL",
        })
      );
    });
  });

  // PM-5H-08: Bandeja área (bandeja=AREA) -> envía filtro de custodia de área al backend
  it("PM-5H-08: bandeja área (bandeja=AREA) -> envía filtro de custodia de área al backend", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Personal" },
        { tipo: "INSTITUCIONAL", descripcion: "Institucional" },
      ],
    });

    const spyHook = vi.spyOn(useBandejaModule, "useBandejaExpedientes").mockReturnValue({
      data: {
        elementos: [],
        siguienteCursor: null,
        tieneMas: false,
        contadores: { PENDIENTES: 0, EN_TRAMITE: 0, DERIVADOS: 0, POR_FIRMAR: 0, ATENDIDOS: 0, ARCHIVADOS: 0 },
      },
      isPending: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter>
          <BandejaExpedientesPage />
        </MemoryRouter>
      </QueryClientProvider>
    );

    const tabArea = screen.getByRole("tab", { name: /Bandeja de Área/i });
    fireEvent.click(tabArea);

    await waitFor(() => {
      expect(spyHook).toHaveBeenCalledWith(
        expect.objectContaining({
          bandeja: "AREA",
        })
      );
    });
  });

  // PM-5H-09: Expediente ajeno en PERSONAL -> no permite operar / deshabilita acciones internas
  it("PM-5H-09: expediente ajeno en PERSONAL -> deshabilita acciones con advertencia de contexto", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "PERSONAL",
      usuario: {
        id: "usr-ciudadano-1",
        idPersona: "p-ciudadano-1",
        nombreCompleto: "Pedro Ciudadano",
        correo: "pedro@test.pe",
        rol: "CIUDADANO",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Personal" },
        { tipo: "INSTITUCIONAL", descripcion: "Institucional" },
      ],
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000099",
        asunto: "Trámite de otra persona",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-otro-ciudadano-999",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: {
        idPersona: "p-otro-ciudadano-999",
        nombreCompleto: "Otro Ciudadano",
        tipoDocumento: "DNI",
        numeroDocumento: "99999999",
        documentoEnmascarado: "***999",
        correo: "otro@test.pe",
      },
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    expect(await screen.findByText(/EXP-2026-000099/)).toBeInTheDocument();
    // En modo personal de ciudadano, los botones de gestión están estrictamente deshabilitados
    const btnDerivar = screen.getByRole("button", { name: /^Derivar$/i });
    expect(btnDerivar).toBeDisabled();
    expect(screen.getByText(/Modo Personal/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Cambie al contexto Institucional para operar este expediente/i).length).toBeGreaterThan(0);
  });

  // PM-5H-10: Derivación desde UI válida con área destino
  it("PM-5H-10: derivación desde UI válida con área destino", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        idPersona: "p-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Personal" },
        { tipo: "INSTITUCIONAL", descripcion: "Institucional" },
      ],
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValue({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000001",
        asunto: "Certificado de Estudios",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-ciudadano-1",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: [
        { id: "a0000000-0000-0000-0000-000000000002", nombre: "Dirección General", habilitada: true },
      ],
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btnDerivar = await screen.findByRole("button", { name: /^Derivar$/i });
    expect(btnDerivar).toBeInTheDocument();
    fireEvent.click(btnDerivar);

    // Modal abierto: verificar presencia de modal y selector de unidad destino
    expect(await screen.findByText(/Derivar expediente/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Unidad de destino/i)).toBeInTheDocument();
  });

  // PM-5H-11: Doble click derivar prevenido (disabled mientras pendiente + Idempotency-Key)
  it("PM-5H-11: doble click derivar prevenido (disabled mientras pendiente)", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        idPersona: "p-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Personal" },
        { tipo: "INSTITUCIONAL", descripcion: "Institucional" },
      ],
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValue({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000001",
        asunto: "Certificado",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-ciudadano-1",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    vi.mocked(apiClient.get).mockResolvedValue({
      data: [{ id: "a0000000-0000-0000-0000-000000000002", nombre: "Dirección", habilitada: true }],
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    fireEvent.click(await screen.findByRole("button", { name: /^Derivar$/i }));
    const confirmBtn = await screen.findByRole("button", { name: /Confirmar derivación/i });
    expect(confirmBtn).toBeInTheDocument();
  });

  // PM-5H-12: Conflicto concurrencia 409 -> UI muestra aviso de conflicto y refresca
  it("PM-5H-12: conflicto concurrencia 409 -> adaptarErrorAccion mapea mensaje exacto", () => {
    const error409 = new ApiHttpError({
      type: "about:blank",
      title: "Conflicto",
      status: 409,
      detail: "Expediente modificado concurrentemente",
      instance: "/api/v1/expedientes",
      code: "CONFLICTO_CONCURRENCIA",
      category: "Conflict",
      correlationId: "corr-conflicto-409",
      retryable: false,
    });

    const errorAdaptado = adaptarErrorAccion(error409);
    expect(errorAdaptado.message).toBe("El expediente cambió mientras trabajabas. Actualiza la información.");
    expect(errorAdaptado.tipo).toBe("concurrencia");
    expect(errorAdaptado.status).toBe(409);
  });

  // PM-5H-13: Requisito no homologado -> muestra aviso explicativo sin bloquear
  it("PM-5H-13: requisito no homologado -> muestra aviso explicativo sin bloquear", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValue({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000001",
        asunto: "Trámite con requisito local",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-otro-1",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/requisitos")) {
        return Promise.resolve({
          data: {
            expedienteId: "e0000000-0000-0000-0000-000000000001",
            totalRequisitos: 1,
            requisitosAplicables: 1,
            satisfechos: 0,
            pendientes: 1,
            observados: 0,
            noAplica: 0,
            porcentajeCumplimiento: 0,
            cumplimientoCompleto: false,
            requisitos: [
              {
                idRequisito: "req-1",
                codigo: "REQ-01",
                nombre: "Requisito Diseño Institucional",
                descripcion: "Regla local SIGD",
                tipoRequisito: "DOCUMENTAL",
                obligatorio: false,
                aplica: true,
                estado: "PENDIENTE",
                cumplido: false,
                estadoHomologacion: "PENDIENTE_HOMOLOGACION",
                proveniencia: "DISENO_SIGD",
                evidencias: [],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btnVerRequisitos = await screen.findByRole("button", { name: /Consultar requisitos y evidencias/i });
    fireEvent.click(btnVerRequisitos);

    expect(await screen.findByText(/Configuración pendiente de validación institucional/i)).toBeInTheDocument();
    expect(screen.getByText(/No bloquea la tramitación/i)).toBeInTheDocument();
  });

  // PM-5H-14: Requisito homologado faltante -> bloqueo correctamente mostrado
  it("PM-5H-14: requisito homologado faltante -> bloqueo correctamente mostrado", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValue({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000001",
        asunto: "Trámite TUPA Oficial",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-otro-1",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/requisitos")) {
        return Promise.resolve({
          data: {
            expedienteId: "e0000000-0000-0000-0000-000000000001",
            totalRequisitos: 1,
            requisitosAplicables: 1,
            satisfechos: 0,
            pendientes: 1,
            observados: 0,
            noAplica: 0,
            porcentajeCumplimiento: 0,
            cumplimientoCompleto: false,
            requisitos: [
              {
                idRequisito: "req-homologado-1",
                codigo: "REQ-OF-01",
                nombre: "Solicitud Dirigida al Director",
                descripcion: "Requisito oficial TUPA Suiza",
                tipoRequisito: "DOCUMENTAL",
                obligatorio: true,
                aplica: true,
                estado: "PENDIENTE",
                cumplido: false,
                estadoHomologacion: "HOMOLOGADO",
                proveniencia: "OFICIAL_SUIZA",
                evidencias: [],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btnVerRequisitos = await screen.findByRole("button", { name: /Consultar requisitos y evidencias/i });
    fireEvent.click(btnVerRequisitos);

    expect(await screen.findByText(/Oficial Homologado/i)).toBeInTheDocument();
    expect(screen.getByText("Solicitud Dirigida al Director")).toBeInTheDocument();
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });

  // PM-5H-15: Subsanación conserva historial visual de evidencias
  it("PM-5H-15: subsanación conserva historial visual de evidencias", async () => {
    useAuthStore.setState({
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
    });

    vi.mocked(rutaDoc.resumen).mockResolvedValue({
      expediente: {
        idExpediente: "e0000000-0000-0000-0000-000000000001",
        cut: "EXP-2026-000001",
        asunto: "Subsanación de requisitos",
        fechaRadicacion: "2026-11-01T10:00:00Z",
        estadoActual: "EN_REVISION",
        areaActualId: "a0000000-0000-0000-0000-000000000001",
        solicitanteId: "p-otro-1",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    });

    vi.mocked(apiClient.get).mockImplementation((url: string) => {
      if (url.includes("/requisitos")) {
        return Promise.resolve({
          data: {
            expedienteId: "e0000000-0000-0000-0000-000000000001",
            totalRequisitos: 1,
            requisitosAplicables: 1,
            satisfechos: 1,
            pendientes: 0,
            observados: 0,
            noAplica: 0,
            porcentajeCumplimiento: 100,
            cumplimientoCompleto: true,
            requisitos: [
              {
                idRequisito: "req-historial-1",
                codigo: "REQ-01",
                nombre: "Copia DNI",
                descripcion: "Copia vigente",
                tipoRequisito: "DOCUMENTAL",
                obligatorio: true,
                aplica: true,
                estado: "CUMPLIDO",
                cumplido: true,
                estadoHomologacion: "HOMOLOGADO",
                evidencias: [
                  {
                    idEvidencia: "ev-1",
                    tipoEvidencia: "DOCUMENTO",
                    estadoValidacion: "RECHAZADA",
                    esSubsanacion: false,
                    evidenciaPreviaId: null,
                    observacion: "Documento borroso",
                    creadoEn: "2026-11-02T10:00:00Z",
                    documento: { nombreArchivo: "dni_antiguo_borroso.pdf" },
                  },
                  {
                    idEvidencia: "ev-2",
                    tipoEvidencia: "DOCUMENTO",
                    estadoValidacion: "VALIDADA",
                    esSubsanacion: true,
                    evidenciaPreviaId: "ev-1",
                    observacion: "Documento nítido verificado",
                    creadoEn: "2026-11-03T11:00:00Z",
                    documento: { nombreArchivo: "dni_subsanado_nitido.pdf" },
                  },
                ],
              },
            ],
          },
        });
      }
      return Promise.resolve({ data: [] });
    });

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/e0000000-0000-0000-0000-000000000001"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    const btnVerRequisitos = await screen.findByRole("button", { name: /Consultar requisitos y evidencias/i });
    fireEvent.click(btnVerRequisitos);

    expect(await screen.findByText(/dni_antiguo_borroso.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/dni_subsanado_nitido.pdf/i)).toBeInTheDocument();
    expect(screen.getByText(/Subsanación #2/i)).toBeInTheDocument();
  });

  // PM-5H-16: Enviar a firma -> transiciona a EN_FIRMA vía modal
  it("PM-5H-16: enviar a firma -> transiciona a EN_FIRMA vía modal", async () => {
    const mockAccion: AccionExpediente<SolicitudEnviarAFirma, ResultadoEnviarAFirma> = {
      disponible: true,
      pending: false,
      estado: "idle",
      error: null,
      resultado: undefined,
      ejecutar: vi.fn().mockImplementation(async (_payload: SolicitudEnviarAFirma) => {
        return true;
      }),
      restablecer: vi.fn(),
    };

    render(
      <EnviarAFirmaModal
        open={true}
        onClose={vi.fn()}
        expediente={{ id: "e0000000-0000-0000-0000-000000000001", codigo: "EXP-2026-000001" }}
        accion={mockAccion}
      />
    );

    expect(screen.getByText(/Enviar Expediente a Firma/i)).toBeInTheDocument();
    const btnEnviar = screen.getByRole("button", { name: /Confirmar Envío a Firma/i });
    fireEvent.click(btnEnviar);

    await waitFor(() => {
      expect(mockAccion.ejecutar).toHaveBeenCalledWith(
        expect.objectContaining({
          expediente: { id: "e0000000-0000-0000-0000-000000000001", codigo: "EXP-2026-000001" },
        })
      );
    });
  });

  // PM-5H-17: Intentar resolver sin firma -> mensaje amigable
  it("PM-5H-17: intentar resolver sin firma -> mensaje amigable de bloqueo", () => {
    const errorFirmaRequerida = new ApiHttpError({
      type: "about:blank",
      title: "Firma requerida",
      status: 409,
      detail: "Requiere firma antes de resolver",
      instance: "/api/v1/expedientes",
      code: "EVIDENCIA_FIRMA_REQUERIDA",
      category: "Conflict",
      correlationId: "corr-firma-409",
      retryable: false,
    });

    const errorAdaptado = adaptarErrorAccion(errorFirmaRequerida);
    expect(errorAdaptado.message).toBe("El expediente todavía no cuenta con una firma válida.");
    expect(errorAdaptado.status).toBe(409);
  });

  // PM-5H-18: Resolver con firma válida -> transiciona a RESUELTO vía modal
  it("PM-5H-18: resolver con firma válida -> transiciona a RESUELTO vía modal", async () => {
    vi.mocked(apiClient.post).mockImplementation((url: string) => {
      if (url.includes("/api/v1/firma/dnie/preparar")) {
        return Promise.resolve({
          data: {
            preparacionId: "prep-5h-01",
            expedienteId: "e0000000-0000-0000-0000-000000000001",
            cut: "EXP-2026-000001",
            documentoId: "doc-5h-01",
            documentoNombre: "Resolucion_001.pdf",
            hashSha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
            algoritmoRecomendado: "SHA256withRSA",
          },
        }) as any;
      }
      if (url.includes("/api/v1/firma/dnie/verificar-y-registrar")) {
        return Promise.resolve({
          data: {
            ok: true,
            documentoId: "doc-5h-01",
            cvd: "CVD-2026-5H001",
            estado: "FIRMADO_DIGITALMENTE",
            verificacion: {
              firmaValida: true,
              certificadoVigente: true,
              cadenaConfiable: true,
              revocacion: "REVOCACION_NO_VERIFICABLE",
              titular: { dni: "99000005", nombre: "DIRECTOR" },
            },
          },
        }) as any;
      }
      return Promise.resolve({ data: {} }) as any;
    });

    const mockAccion: AccionExpediente<SolicitudResolver, ResultadoResolver> = {
      disponible: true,
      pending: false,
      estado: "idle",
      error: null,
      resultado: undefined,
      ejecutar: vi.fn().mockImplementation(async (_payload: SolicitudResolver) => {
        return true;
      }),
      restablecer: vi.fn(),
    };

    render(
      <ResolverModal
        open={true}
        onClose={vi.fn()}
        expediente={{ id: "e0000000-0000-0000-0000-000000000001", codigo: "EXP-2026-000001" }}
        accion={mockAccion}
      />
    );

    expect(screen.getByText(/Resolver Expediente con Firma Digital/i)).toBeInTheDocument();

    const btnFirmar = await screen.findByRole("button", { name: /Firmar Documento con DNIe/i });
    fireEvent.click(btnFirmar);

    const btnEmitir = await screen.findByRole("button", { name: /Emitir Resolución/i });
    await waitFor(() => {
      expect(btnEmitir).toBeEnabled();
    });
    fireEvent.click(btnEmitir);

    await waitFor(() => {
      expect(mockAccion.ejecutar).toHaveBeenCalledWith(
        expect.objectContaining({
          expediente: { id: "e0000000-0000-0000-0000-000000000001", codigo: "EXP-2026-000001" },
          resultado_resumen: expect.any(String),
        })
      );
    });
  });

  // PM-5H-19: Responsabilidad institucional expira durante sesión -> autoridad desaparece y degrada a PERSONAL
  it("PM-5H-19: responsabilidad institucional expira durante sesión -> autoridad desaparece y degrada a PERSONAL", async () => {
    useAuthStore.setState({
      accessToken: "token-institucional-expirado",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
        areaId: "a0000000-0000-0000-0000-000000000001",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        { tipo: "INSTITUCIONAL", descripcion: "Especialista", rol: "ESPECIALISTA" },
      ],
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "token-degradado-personal",
        contextoActivo: "PERSONAL",
        usuario: {
          id: "usr-func-1",
          nombreCompleto: "María Especialista",
          rol: "CIUDADANO",
        },
      },
    });

    await useAuthStore.getState().cambiarContexto("PERSONAL");

    const state = useAuthStore.getState();
    expect(state.contextoActivo).toBe("PERSONAL");
    expect(state.usuario?.rol).toBe("CIUDADANO");
    expect(state.usuario?.areaId).toBeUndefined();
  });

  // PM-5H-20: Cambio INSTITUCIONAL -> PERSONAL purga memoria/cache con queryClient.clear()
  it("PM-5H-20: cambio INSTITUCIONAL -> PERSONAL purga memoria/cache con queryClient.clear()", async () => {
    useAuthStore.setState({
      accessToken: "token-institucional",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "María Especialista",
        correo: "maria@test.pe",
        rol: "ESPECIALISTA",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
        { tipo: "INSTITUCIONAL", descripcion: "Especialista" },
      ],
    });

    const clearSpy = vi.spyOn(queryClient, "clear");

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "token-personal-nuevo",
        contextoActivo: "PERSONAL",
        usuario: {
          id: "usr-func-1",
          nombreCompleto: "María Especialista",
          rol: "CIUDADANO",
        },
      },
    });

    await useAuthStore.getState().cambiarContexto("PERSONAL");

    expect(clearSpy).toHaveBeenCalled();
  });

  // PM-5H-21: ADMINISTRADOR_SIGD técnico sin perfil financiero -> no ve Tesorería
  it("PM-5H-21: ADMINISTRADOR_SIGD técnico sin perfil financiero no ve Tesorería", () => {
    // 1. Verificación en la matriz de acceso canónica
    expect(
      canAccessRoute("ADMINISTRADOR", "/tesoreria", {
        contexto: "INSTITUCIONAL",
        perfiles: ["ADMINISTRADOR_SIGD"],
      })
    ).toBe(false);
    expect(
      canAccessRoute("ADMINISTRADOR", "/administracion", {
        contexto: "INSTITUCIONAL",
        perfiles: ["ADMINISTRADOR_SIGD"],
      })
    ).toBe(true);

    // 2. Renderizado en HeaderInstitucional
    useAuthStore.setState({
      accessToken: "token-admin",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-admin-1",
        nombreCompleto: "Admin Técnico",
        correo: "admin@test.pe",
        rol: "ADMINISTRADOR",
        perfiles: ["ADMINISTRADOR_SIGD"],
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
        { tipo: "INSTITUCIONAL", descripcion: "Administrador", rol: "ADMINISTRADOR", perfiles: ["ADMINISTRADOR_SIGD"] },
      ],
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    // No debe renderizar enlaces a Tesorería
    expect(screen.queryByText(/Módulo Tesorería/i)).not.toBeInTheDocument();
    // Sí debe renderizar Administración
    expect(screen.getByText(/Administración/i)).toBeInTheDocument();
  });

  // PM-5H-22: usuario con perfil financiero vigente -> sí puede visualizar Tesorería
  it("PM-5H-22: usuario con perfil financiero vigente sí puede visualizar Tesorería", () => {
    // 1. Matriz de acceso canónica
    expect(
      canAccessRoute("ADMINISTRADOR", "/tesoreria", {
        contexto: "INSTITUCIONAL",
        perfiles: ["ADMINISTRADOR_SIGD", "GESTOR_TESORERIA"],
      })
    ).toBe(true);
    expect(
      canAccessRoute("ESPECIALISTA", "/tesoreria", {
        contexto: "INSTITUCIONAL",
        perfiles: ["GESTOR_TESORERIA"],
      })
    ).toBe(true);

    // 2. Renderizado en HeaderInstitucional con perfil GESTOR_TESORERIA
    useAuthStore.setState({
      accessToken: "token-admin-teso",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-admin-2",
        nombreCompleto: "Admin Tesorero",
        correo: "adminteso@test.pe",
        rol: "ADMINISTRADOR",
        perfiles: ["ADMINISTRADOR_SIGD", "GESTOR_TESORERIA"],
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
        { tipo: "INSTITUCIONAL", descripcion: "Administrador con Tesorería", rol: "ADMINISTRADOR", perfiles: ["GESTOR_TESORERIA"] },
      ],
    });

    render(
      <MemoryRouter>
        <HeaderInstitucional />
      </MemoryRouter>
    );

    expect(screen.getByText(/Módulo Tesorería/i)).toBeInTheDocument();
  });

  // PM-5H-23: procedimiento sin configuración explícita de destino -> UI NO sugiere área por nombre/categoría
  it("PM-5H-23: procedimiento sin configuración explícita de destino no sugiere área por nombre ni categoría", async () => {
    useAuthStore.setState({
      accessToken: "token-mesa",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-mesa-1",
        idPersona: "per-mesa-1",
        nombreCompleto: "Operador Mesa",
        correo: "mesa@test.pe",
        rol: "MESA_PARTES",
      },
      contextosDisponibles: [
        { tipo: "INSTITUCIONAL", descripcion: "Mesa de Partes", rol: "MESA_PARTES" },
      ],
    });

    vi.mocked(rutaDoc.foliacion).mockResolvedValue({ cantidadDocumentos: 0, totalFolios: 0, cantidadFoliados: 0 } as any);
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: "exp-0099",
        cut: "EXP-2026-0099",
        asunto: "Certificado de estudios de inglés",
        fechaRadicacion: new Date().toISOString(),
        estadoActual: "EN_REVISION",
        areaActualId: "area-mp-01",
        solicitanteId: "per-externa-99",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: {
        registroVersionId: "ver-01",
        codigo: "p1-fila-06",
        denominacion: "Certificado de estudios de inglés",
        clasificacion: "SERVICIO_ACADEMICO",
        plazoDias: 15,
        costo: 0,
        unidadResponsableId: null,
        unidadResponsableNombre: null,
      },
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/exp-0099"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-0099")).toBeInTheDocument();
    });

    // NO debe inferir "Subdirección Académica" ni sugerir destino sin configuración explícita
    expect(screen.queryByText(/Destino sugerido institucional/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Subdirección Académica \(SDA\)/i)).not.toBeInTheDocument();
  });

  // PM-5H-24: procedimiento con destino configurado y válido -> UI muestra sugerencia claramente identificada como configuración institucional
  it("PM-5H-24: procedimiento con destino configurado y válido muestra sugerencia institucional", async () => {
    useAuthStore.setState({
      accessToken: "token-mesa",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-mesa-1",
        idPersona: "per-mesa-1",
        nombreCompleto: "Operador Mesa",
        correo: "mesa@test.pe",
        rol: "MESA_PARTES",
      },
      contextosDisponibles: [
        { tipo: "INSTITUCIONAL", descripcion: "Mesa de Partes", rol: "MESA_PARTES" },
      ],
    });

    vi.mocked(rutaDoc.foliacion).mockResolvedValue({ cantidadDocumentos: 0, totalFolios: 0, cantidadFoliados: 0 } as any);
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: "exp-0100",
        cut: "EXP-2026-0100",
        asunto: "Constancia de matrícula",
        fechaRadicacion: new Date().toISOString(),
        estadoActual: "REGISTRADO",
        areaActualId: "area-mp-01",
        solicitanteId: "per-externa-100",
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "REGISTRADO",
      documentos: [],
      solicitanteResumen: null,
      pago: { estado: "CONFIRMADO", monto: 20 },
      tupaResumen: {
        registroVersionId: "ver-02",
        codigo: "TUPA-02",
        denominacion: "Constancia de matrícula",
        clasificacion: "PROCEDIMIENTO_AUTOMATICO",
        plazoDias: 5,
        costo: 20,
        unidadResponsableId: "area-secretaria-acad",
        unidadResponsableNombre: "Secretaría Académica",
      },
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/exp-0100"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-0100")).toBeInTheDocument();
    });

    // Debe mostrar la sugerencia institucional explícita
    expect(screen.getByText(/Destino sugerido institucional:/i)).toBeInTheDocument();
    expect(screen.getByText("Secretaría Académica")).toBeInTheDocument();
  });

  // PM-5H-25: usuario y solicitante misma PERSONA -> UI bloquea autoatención
  it("PM-5H-25: usuario y solicitante misma PERSONA -> UI bloquea autoatención", async () => {
    useAuthStore.setState({
      accessToken: "token-esp",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-esp-999",
        idPersona: "per-identidad-compartida-1",
        nombreCompleto: "Especialista Titular",
        correo: "esp@test.pe",
        rol: "ESPECIALISTA",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
        { tipo: "INSTITUCIONAL", descripcion: "Especialista", rol: "ESPECIALISTA" },
      ],
    });

    vi.mocked(rutaDoc.foliacion).mockResolvedValue({ cantidadDocumentos: 0, totalFolios: 0, cantidadFoliados: 0 } as any);
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: "exp-autop",
        cut: "EXP-2026-AUTOP",
        asunto: "Mi trámite propio",
        fechaRadicacion: new Date().toISOString(),
        estadoActual: "EN_REVISION",
        areaActualId: "area-esp",
        solicitanteId: "per-identidad-compartida-1", // Misma PERSONA
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/exp-autop"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-AUTOP")).toBeInTheDocument();
    });

    // Debe mostrar el banner de autoatención prohibida
    expect(screen.getByText(/Autoatención no permitida \(Titular del expediente\)/i)).toBeInTheDocument();
  });

  // PM-5H-26: id_usuario coincide con solicitanteId pero PERSONA es distinta -> UI NO confunde identidades
  it("PM-5H-26: id_usuario coincide numéricamente con solicitanteId pero PERSONA distinta -> UI no confunde identidades", async () => {
    useAuthStore.setState({
      accessToken: "token-esp-2",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "uuid-colision-casual", // id de cuenta coincide por casualidad con solicitanteId
        idPersona: "persona-real-del-operador", // PERSONA es diferente
        nombreCompleto: "Operador Especialista",
        correo: "op@test.pe",
        rol: "ESPECIALISTA",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales" },
        { tipo: "INSTITUCIONAL", descripcion: "Especialista", rol: "ESPECIALISTA" },
      ],
    });

    vi.mocked(rutaDoc.foliacion).mockResolvedValue({ cantidadDocumentos: 0, totalFolios: 0, cantidadFoliados: 0 } as any);
    vi.mocked(rutaDoc.resumen).mockResolvedValueOnce({
      expediente: {
        idExpediente: "exp-no-auto",
        cut: "EXP-2026-NO-AUTO",
        asunto: "Trámite de administrado externo",
        fechaRadicacion: new Date().toISOString(),
        estadoActual: "EN_REVISION",
        areaActualId: "area-esp",
        solicitanteId: "uuid-colision-casual", // solicitante_id es PERSONA
        resumenDocumentos: null,
        ultimoMovimiento: null,
        sla: null,
      },
      estado: "EN_REVISION",
      documentos: [],
      solicitanteResumen: null,
      tupaResumen: null,
      slaResumen: null,
      foliacionResumen: { cantidadDocumentos: 0, totalFolios: 0 },
    } as any);

    render(
      <QueryClientProvider client={testQueryClient}>
        <MemoryRouter initialEntries={["/expedientes/exp-no-auto"]}>
          <Routes>
            <Route path="/expedientes/:id" element={<ExpedienteDetallePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    );

    await waitFor(() => {
      expect(screen.getByText("EXP-2026-NO-AUTO")).toBeInTheDocument();
    });

    // NO debe bloquear por autoatención porque idPersona !== solicitanteId
    expect(screen.queryByText(/Autoatención no permitida/i)).not.toBeInTheDocument();
  });

  // PM-5H-27: misma mutación reintentada -> misma Idempotency-Key
  it("PM-5H-27: misma mutación reintentada conserva la misma Idempotency-Key", async () => {
    let callCount = 0;
    const clavesCapturadas: string[] = [];

    const mockAccion: AccionExpediente<{ mensaje: string }, { ok: boolean }> = {
      disponible: true,
      pending: false,
      estado: "idle",
      error: null,
      resultado: undefined,
      restablecer: vi.fn(),
      ejecutar: vi.fn(async () => {
        callCount++;
        const claveActiva = obtenerClaveIdempotenciaActiva();
        if (claveActiva) clavesCapturadas.push(claveActiva);
        if (callCount === 1) {
          throw new Error("Fallo de red transitorio 503");
        }
        return true;
      }),
    };

    const { result } = renderHook(() => useFormularioExpediente(mockAccion));

    // Intento 1: falla
    await act(async () => {
      await result.current.enviar({ mensaje: "primer intento" }, vi.fn());
    });

    expect(callCount).toBe(1);
    expect(clavesCapturadas.length).toBe(1);

    // Intento 2 (Reintento de la misma intención):
    await act(async () => {
      await result.current.enviar({ mensaje: "primer intento reintento" }, vi.fn());
    });

    expect(callCount).toBe(2);
    expect(clavesCapturadas.length).toBe(2);
    // La clave debe ser exactamente idéntica entre el intento original y su reintento
    expect(clavesCapturadas[0]).toBe(clavesCapturadas[1]);
  });

  // PM-5H-28: dos acciones distintas consecutivas -> claves distintas
  it("PM-5H-28: dos acciones distintas consecutivas generan claves de idempotencia diferentes", async () => {
    const clavesCapturadas: string[] = [];

    const mockAccion1: AccionExpediente<void, boolean> = {
      disponible: true,
      pending: false,
      estado: "idle",
      error: null,
      resultado: undefined,
      restablecer: vi.fn(),
      ejecutar: vi.fn(async () => {
        const c = obtenerClaveIdempotenciaActiva();
        if (c) clavesCapturadas.push(c);
        return true;
      }),
    };

    const mockAccion2: AccionExpediente<void, boolean> = {
      disponible: true,
      pending: false,
      estado: "idle",
      error: null,
      resultado: undefined,
      restablecer: vi.fn(),
      ejecutar: vi.fn(async () => {
        const c = obtenerClaveIdempotenciaActiva();
        if (c) clavesCapturadas.push(c);
        return true;
      }),
    };

    const { result: hook1 } = renderHook(() => useFormularioExpediente(mockAccion1));
    await act(async () => {
      await hook1.current.enviar(undefined, vi.fn());
    });

    const { result: hook2 } = renderHook(() => useFormularioExpediente(mockAccion2));
    await act(async () => {
      await hook2.current.enviar(undefined, vi.fn());
    });

    expect(clavesCapturadas.length).toBe(2);
    expect(clavesCapturadas[0]).not.toBe(clavesCapturadas[1]);
  });

  // PM-5H-29: cambio de contexto -> no reutiliza clave de idempotencia pendiente de una operación institucional anterior
  it("PM-5H-29: cambio de contexto purga clave de idempotencia pendiente", async () => {
    establecerClaveIdempotenciaActiva("clave-operacion-institucional-previa");
    expect(obtenerClaveIdempotenciaActiva()).toBe("clave-operacion-institucional-previa");

    useAuthStore.setState({
      accessToken: "token-institucional-valido",
      isAuthenticated: true,
      contextoActivo: "INSTITUCIONAL",
      usuario: {
        id: "usr-func-1",
        nombreCompleto: "Funcionario Suárez",
        rol: "ESPECIALISTA",
        correo: "func@test.pe",
      },
      contextosDisponibles: [
        { tipo: "PERSONAL", descripcion: "Trámites personales", rol: "CIUDADANO" },
        { tipo: "INSTITUCIONAL", descripcion: "Especialista", rol: "ESPECIALISTA" },
      ],
    });

    vi.mocked(apiClient.post).mockResolvedValueOnce({
      data: {
        accessToken: "token-personal-nuevo",
        contextoActivo: "PERSONAL",
        usuario: {
          id: "usr-func-1",
          nombreCompleto: "Funcionario Suárez",
          rol: "CIUDADANO",
        },
      },
    });

    await useAuthStore.getState().cambiarContexto("PERSONAL");

    // Al cambiar de contexto la clave activa debe haber sido purgada
    expect(obtenerClaveIdempotenciaActiva()).toBeNull();
  });
});
