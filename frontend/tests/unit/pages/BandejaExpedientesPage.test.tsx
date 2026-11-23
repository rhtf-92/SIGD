import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, renderHook, waitFor, act } from "@testing-library/react";
import type { ReactNode } from "react";
import type { AxiosResponse } from "axios";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";
import { useBandejaExpedientes, useExpedienteDetalle } from "../../../src/hooks/useBandejaExpedientes";
import { useExpedienteTimeline } from "../../../src/hooks/useExpedienteTimeline";
import BandejaExpedientesPage from "../../../src/pages/expedientes/BandejaExpedientesPage";
import ExpedienteDetallePage from "../../../src/pages/expedientes/ExpedienteDetallePage";
import type { ResultadoBandejaRutaDoc, ExpedienteDetalleRutaDoc, PestanaRutaDoc } from "../../../src/types/expediente";
import type { ActuacionRutaDoc } from "../../../src/types/trazabilidadExpediente";
import BandejaTabs from "../../../src/components/expedientes/BandejaTabs";
import { type EstadoFlujoExpediente } from "../../../src/types/expediente";

const conteosMock: Record<EstadoFlujoExpediente, number> = {
  PENDIENTE: 3,
  EN_PROCESO: 2,
  OBSERVADO: 1,
  DERIVADO: 4,
  NOTIFICADO: 0,
  ARCHIVADO: 5,
};

describe("T-FE-EXP-05: Suite de pruebas unitarias de Bandeja de Expedientes", () => {
  const onCambiarEstadoMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("1. Debe renderizar las 6 pestañas operativas obligatorias", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(6);
  });

  it("2. Debe contener el contenedor accesible role=tablist con aria-label descriptivo", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tablist = screen.getByRole("tablist");
    expect(tablist).toHaveAttribute(
      "aria-label",
      "Pestañas de la Bandeja Operativa de Expedientes"
    );
  });

  it("3. Debe marcar aria-selected=true únicamente en la pestaña activa", () => {
    render(
      <BandejaTabs
        estadoActivo="OBSERVADO"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabObservado = screen.getByRole("tab", { name: /observado/i });
    const tabPendiente = screen.getByRole("tab", { name: /pendiente/i });

    expect(tabObservado).toHaveAttribute("aria-selected", "true");
    expect(tabPendiente).toHaveAttribute("aria-selected", "false");
  });

  it("4. Debe reflejar dinámicamente los contadores en los badges sin números quemados", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    expect(screen.getByTestId("badge-pendiente").textContent).toBe("3");
    expect(screen.getByTestId("badge-observado").textContent).toBe("1");
    expect(screen.getByTestId("badge-derivado").textContent).toBe("4");
    expect(screen.getByTestId("badge-notificado").textContent).toBe("0");
  });

  it("5. Debe emitir el cambio al hacer clic en la pestaña OBSERVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabObservado = screen.getByRole("tab", { name: /observado/i });
    fireEvent.click(tabObservado);

    expect(onCambiarEstadoMock).toHaveBeenCalledTimes(1);
    expect(onCambiarEstadoMock).toHaveBeenCalledWith("OBSERVADO");
  });

  it("6. Debe emitir el cambio al hacer clic en la pestaña DERIVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabDerivado = screen.getByRole("tab", { name: /derivado/i });
    fireEvent.click(tabDerivado);

    expect(onCambiarEstadoMock).toHaveBeenCalledWith("DERIVADO");
  });

  it("7. Debe emitir el cambio al hacer clic en la pestaña ARCHIVADO", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabArchivado = screen.getByRole("tab", { name: /archivado/i });
    fireEvent.click(tabArchivado);

    expect(onCambiarEstadoMock).toHaveBeenCalledWith("ARCHIVADO");
  });

  it("8. Debe asignar estilos de resaltado visual a la pestaña activa", () => {
    render(
      <BandejaTabs
        estadoActivo="EN_PROCESO"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabEnProceso = screen.getByRole("tab", { name: /en proceso/i });
    expect(tabEnProceso.className).toContain("bg-blue-700");
  });

  it("9. Debe tolerar conteos indefinidos o vacíos mostrando 0 por defecto", () => {
    const conteosVacios = {} as Record<EstadoFlujoExpediente, number>;
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosVacios}
      />
    );
    expect(screen.getByTestId("badge-pendiente").textContent).toBe("0");
    expect(screen.getByTestId("badge-archivado").textContent).toBe("0");
  });

  it("10. Cada botón de pestaña debe contar con id y aria-controls vinculados para WAI-ARIA", () => {
    render(
      <BandejaTabs
        estadoActivo="PENDIENTE"
        onCambiarEstado={onCambiarEstadoMock}
        conteos={conteosMock}
      />
    );
    const tabPendiente = screen.getByRole("tab", { name: /pendiente/i });
    expect(tabPendiente).toHaveAttribute("id", "tab-pendiente");
    expect(tabPendiente).toHaveAttribute("aria-controls", "panel-pendiente");
  });
});

const idApi = "11111111-1111-4111-8111-111111111111";
const detalleApi: ExpedienteDetalleRutaDoc = {
  idExpediente: idApi, cut: "EXP-2026-999999", asunto: "Solicitud sintética no persistida",
  fechaRadicacion: "2026-10-18T12:00:00.000Z", estadoActual: "REGISTRADO", areaActualId: null,
  solicitanteId: "22222222-2222-4222-8222-222222222222", resumenDocumentos: null,
  ultimoMovimiento: null, sla: null,
};
const paginaApi: ResultadoBandejaRutaDoc = {
  elementos: [detalleApi], siguienteCursor: "cursor-opaco", tieneMas: true,
  contadores: { PENDIENTES: 12, EN_TRAMITE: 3, DERIVADOS: 2, POR_FIRMAR: 4, ATENDIDOS: 6, ARCHIVADOS: 7 },
};
const actuacionApi: ActuacionRutaDoc = {
  movimientoId: "movimiento-real-del-dto", secuencia: "1", fechaHora: "2026-10-18T12:00:00.000Z",
  estadoAnterior: "REGISTRADO", evento: "RECEPCIONAR", estadoNuevo: "RECEPCIONADO",
  usuarioOperadorId: "33333333-3333-4333-8333-333333333333", areaAnteriorId: null,
  areaDestinoId: null, remitente: null, destinatario: null, proveido: null, datosAsociados: {},
  duracionMs: null, duracionMinutos: null, tipoActuacion: "NORMAL",
};
function contextoApi() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  return { cliente, wrapper: ({ children }: { children: ReactNode }) =>
    <QueryClientProvider client={cliente}>{children}</QueryClientProvider> };
}
function errorApi(status: number) {
  return new ApiHttpError({ status, type: "test", title: "Error de prueba", detail: "Error de prueba",
    instance: "test", code: "TEST", category: "Security", correlationId: "test", retryable: false });
}

describe("Consumidores reales de RutaDoc: respuestas HTTP simuladas sin PostgreSQL", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("envía pestaña, búsqueda y filtros del contrato; conserva contadores y cursores sin duplicados", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValueOnce({ data: paginaApi } as AxiosResponse)
      .mockResolvedValueOnce({ data: { ...paginaApi, elementos: [detalleApi, { ...detalleApi, idExpediente: "otro-uuid" }],
        siguienteCursor: null, tieneMas: false } } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useBandejaExpedientes({ pestana: "PENDIENTES", busqueda: "  solicitud  ",
      areaId: idApi, fechaDesde: "2026-01-01", fechaHasta: "2026-12-31", limite: 10 }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(get).toHaveBeenNthCalledWith(1, "/api/v1/expedientes", expect.objectContaining({ params: {
      pestana: "PENDIENTES", terminoBusqueda: "solicitud", areaId: idApi,
      fechaDesde: "2026-01-01", fechaHasta: "2026-12-31", limite: 10, cursor: undefined,
    } }));
    expect(result.current.data).toEqual([detalleApi]);
    expect(result.current.contadores).toEqual(paginaApi.contadores);
    expect(result.current.siguienteCursor).toBe("cursor-opaco");
    await act(async () => { await result.current.fetchNextPage(); });
    expect(get).toHaveBeenLastCalledWith("/api/v1/expedientes", expect.objectContaining({
      params: expect.objectContaining({ cursor: "cursor-opaco", pestana: "PENDIENTES" }),
    }));
    await waitFor(() => expect(result.current.data).toHaveLength(2));
    expect(result.current.tieneMas).toBe(false);
    expect(result.current.hasNextPage).toBe(false);
  });

  it("reinicia el cursor cuando cambian pestaña o búsqueda", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: paginaApi } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result, rerender } = renderHook(({ pestana, busqueda }: { pestana: PestanaRutaDoc; busqueda: string }) =>
      useBandejaExpedientes({ pestana, busqueda }), { wrapper, initialProps: { pestana: "PENDIENTES", busqueda: "" } });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    rerender({ pestana: "POR_FIRMAR", busqueda: "informe" });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenLastCalledWith("/api/v1/expedientes", expect.objectContaining({
      params: expect.objectContaining({ pestana: "POR_FIRMAR", terminoBusqueda: "informe", cursor: undefined }),
    }));
  });

  it("acepta una bandeja vacía sin sustituirla por fixtures", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { ...paginaApi, elementos: [], tieneMas: false, siguienteCursor: null } } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useBandejaExpedientes({ pestana: "ARCHIVADOS" }), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it.each([401, 403, 404, 500])("conserva el error %i de Bandeja sin devolver una lista simulada", async (status) => {
    vi.spyOn(apiClient, "get").mockRejectedValue(errorApi(status));
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useBandejaExpedientes({ pestana: "PENDIENTES" }), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error).toMatchObject({ status });
    expect(result.current.data).toBeUndefined();
  });

  it("consulta detalle por ID sin solicitar la bandeja", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: detalleApi } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useExpedienteDetalle(idApi), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(detalleApi);
    expect(get).toHaveBeenCalledTimes(1);
    expect(get).toHaveBeenCalledWith(`/api/v1/expedientes/${idApi}`, expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  it("no consulta detalle ni trazabilidad sin un ID", () => {
    const get = vi.spyOn(apiClient, "get");
    const { wrapper } = contextoApi();
    renderHook(() => { useExpedienteDetalle(undefined); useExpedienteTimeline(undefined); }, { wrapper });
    expect(get).not.toHaveBeenCalled();
  });

  it.each([401, 403, 404])("muestra el error %i del detalle sin datos ni trazabilidad ajenos", async (status) => {
    const get = vi.spyOn(apiClient, "get").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v1/admin/organigrama")) {
        if (status === 403) {
          throw errorApi(403);
        }
        return { data: [] } as AxiosResponse;
      }
      if (urlStr.includes(`/api/v1/expedientes/${idApi}`)) {
        throw errorApi(status);
      }
      throw new Error(`Endpoint inesperado: ${urlStr}`);
    });
    const { wrapper } = contextoApi();
    render(<MemoryRouter initialEntries={[`/expedientes/${idApi}`]}>
      <Routes><Route path="/expedientes/:id" element={<ExpedienteDetallePage />} /></Routes>
    </MemoryRouter>, { wrapper });
    const mensaje = status === 401 ? /Inicia sesión/ : status === 403 ? /No tienes permiso/ : /No se encontró/;
    expect(await screen.findByRole("alert")).toHaveTextContent(mensaje);
    expect(screen.queryByText(detalleApi.asunto)).not.toBeInTheDocument();
    expect(get).toHaveBeenCalledWith(
      `/api/v1/expedientes/${idApi}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(get).toHaveBeenCalledWith("/api/v1/admin/organigrama");
    expect(get).not.toHaveBeenCalledWith(
      expect.stringContaining("/trazabilidad"),
      expect.anything()
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("muestra detalle y actuaciones desde sus endpoints, sin PDF, nombres ni hashes ficticios", async () => {
    const get = vi.spyOn(apiClient, "get").mockImplementation(async (url) => {
      const urlStr = String(url);
      if (urlStr.includes("/api/v1/admin/organigrama")) {
        return { data: [] } as AxiosResponse;
      }
      if (urlStr.endsWith("/trazabilidad")) {
        return { data: { expedienteId: idApi, actuaciones: [actuacionApi] } } as AxiosResponse;
      }
      if (urlStr.endsWith("/checklist")) {
        return { data: [] } as AxiosResponse;
      }
      if (urlStr.endsWith("/acumulaciones")) {
        return { data: { ok: true, acumulaciones: [] } } as AxiosResponse;
      }
      if (urlStr.endsWith("/desgloses")) {
        return { data: { ok: true, desgloses: [] } } as AxiosResponse;
      }
      if (urlStr.endsWith("/anotaciones")) {
        return { data: { ok: true, anotaciones: [] } } as AxiosResponse;
      }
      if (urlStr === `/api/v1/expedientes/${idApi}`) {
        return { data: detalleApi } as AxiosResponse;
      }
      throw new Error(`Endpoint inesperado: ${urlStr}`);
    });
    const { wrapper } = contextoApi();
    render(<MemoryRouter initialEntries={[`/expedientes/${idApi}`]}>
      <Routes><Route path="/expedientes/:id" element={<ExpedienteDetallePage />} /></Routes>
    </MemoryRouter>, { wrapper });
    expect(await screen.findAllByText(detalleApi.asunto)).toHaveLength(2);
    expect(await screen.findByText("RECEPCIONAR")).toBeInTheDocument();
    expect(screen.getByText(actuacionApi.usuarioOperadorId)).toBeInTheDocument();
    expect(screen.queryByText(/Hash SHA-256/)).not.toBeInTheDocument();
    expect(document.querySelector('img[src*="folio-ejemplo"]')).toBeNull();

    expect(get).toHaveBeenCalledWith(
      `/api/v1/expedientes/${idApi}`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(get).toHaveBeenCalledWith("/api/v1/admin/organigrama");
    expect(get).toHaveBeenCalledWith(
      `/api/v1/expedientes/${idApi}/trazabilidad`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(get).toHaveBeenCalledWith(`/api/v1/expedientes/${idApi}/checklist`);
    expect(get).toHaveBeenCalledWith(`/api/v1/rutadoc/expedientes/${idApi}/acumulaciones`);
    expect(get).toHaveBeenCalledWith(`/api/v1/rutadoc/expedientes/${idApi}/desgloses`);
    expect(get).toHaveBeenCalledWith(`/api/v1/expedientes/${idApi}/anotaciones-internas`);
    expect(get).toHaveBeenCalledTimes(7);

    expect(screen.queryByRole("button", { name: "Derivar Expediente" })).not.toBeInTheDocument();
  });

  it("extrae actuaciones, conserva fechaHora, UUID y orden de secuencia del productor", async () => {
    const actuaciones = [actuacionApi, { ...actuacionApi, movimientoId: "segundo", secuencia: "2" }];
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { expedienteId: idApi, actuaciones } } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useExpedienteTimeline(idApi), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(actuaciones);
    expect(result.current.data?.[0].fechaHora).toBe(actuacionApi.fechaHora);
    expect(result.current.data?.[0]).not.toHaveProperty("timestamp");
  });

  it("admite historial vacío", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { expedienteId: idApi, actuaciones: [] } } as AxiosResponse);
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useExpedienteTimeline(idApi), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });

  it.each([401, 403, 404])("propaga el error %i de trazabilidad sin fabricar actuaciones", async (status) => {
    vi.spyOn(apiClient, "get").mockRejectedValue(errorApi(status));
    const { wrapper } = contextoApi();
    const { result } = renderHook(() => useExpedienteTimeline(idApi), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });

  it("conecta las seis pestañas reales, sus contadores y la navegación al detalle", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: { ...paginaApi, tieneMas: false, siguienteCursor: null } } as AxiosResponse);
    const { wrapper } = contextoApi();
    render(<MemoryRouter><Routes>
      <Route path="/" element={<BandejaExpedientesPage />} />
      <Route path="/expedientes/:id" element={<p>Detalle seleccionado</p>} />
    </Routes></MemoryRouter>, { wrapper });
    expect(await screen.findByText(detalleApi.cut)).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pendientes 12" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("tab", { name: "Por firmar 4" }));
    await waitFor(() => expect(get).toHaveBeenLastCalledWith("/api/v1/expedientes", expect.objectContaining({
      params: expect.objectContaining({ pestana: "POR_FIRMAR" }),
    })));
    expect(screen.getAllByRole("tab")).toHaveLength(6);
    expect(screen.queryByRole("tab", { name: /Notificados/ })).not.toBeInTheDocument();
    fireEvent.click(await screen.findByRole("button", { name: "Ver" }));
    expect(await screen.findByText("Detalle seleccionado")).toBeInTheDocument();
  });

  it("aplica búsqueda con espera breve, sin solicitar cada pulsación", async () => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValue({ data: { ...paginaApi, tieneMas: false } } as AxiosResponse);
    const { wrapper } = contextoApi();
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>, { wrapper });
    await screen.findByText(detalleApi.cut);
    const buscar = screen.getByRole("searchbox");
    fireEvent.change(buscar, { target: { value: "sol" } });
    fireEvent.change(buscar, { target: { value: "solicitud" } });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(2));
    expect(get).toHaveBeenLastCalledWith("/api/v1/expedientes", expect.objectContaining({
      params: expect.objectContaining({ terminoBusqueda: "solicitud", cursor: undefined }),
    }));
  });

  it("muestra bandeja vacía sólo cuando la API responde correctamente sin elementos", async () => {
    vi.spyOn(apiClient, "get").mockResolvedValue({ data: { ...paginaApi, elementos: [], tieneMas: false } } as AxiosResponse);
    const { wrapper } = contextoApi();
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByText(/No hay expedientes en esta pestaña/)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each([401, 403])("la Bandeja no confunde el error %i con una lista vacía", async (status) => {
    vi.spyOn(apiClient, "get").mockRejectedValue(errorApi(status));
    const { wrapper } = contextoApi();
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>, { wrapper });
    expect(await screen.findByRole("alert")).toHaveTextContent(status === 401 ? /Inicia sesión/ : /No tienes permiso/);
    expect(screen.queryByText(/No hay expedientes en esta pestaña/)).not.toBeInTheDocument();
  });

  it.each([500, 403])("maneja el error %i al cargar otra página sin exponer datos ante una denegación", async (status) => {
    const get = vi.spyOn(apiClient, "get").mockResolvedValueOnce({ data: paginaApi } as AxiosResponse)
      .mockRejectedValueOnce(errorApi(status));
    const { wrapper } = contextoApi();
    render(<MemoryRouter><BandejaExpedientesPage /></MemoryRouter>, { wrapper });
    await screen.findByText(detalleApi.cut);
    fireEvent.click(screen.getByRole("button", { name: "Cargar más" }));
    await screen.findByRole("alert");
    if (status === 500) {
      expect(screen.getByText(detalleApi.cut)).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Cargar más" })).toBeEnabled();
    } else {
      expect(screen.queryByText(detalleApi.cut)).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: "Cargar más" })).not.toBeInTheDocument();
    }
    expect(get).toHaveBeenCalledTimes(2);
  });
});
