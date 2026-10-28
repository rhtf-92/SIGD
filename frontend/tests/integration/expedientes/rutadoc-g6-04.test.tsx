import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Link, MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { apiClient } from "../../../src/api/client";
import { ApiHttpError } from "../../../src/types/api";
import Bandeja from "../../../src/pages/expedientes/BandejaExpedientesPage";
import Detalle from "../../../src/pages/expedientes/ExpedienteDetallePage";
import BandejaTabFilter from "../../../src/components/expedientes/BandejaTabFilter";
import { FechaRutaDoc } from "../../../src/pages/expedientes/rutadoc/RutaDocEstado";
import { useAuthStore } from "../../../src/stores/authStore";

const A = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const B = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const C = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const fecha = "2026-10-01T10:00:00.000Z";
const contadores = { PENDIENTES: 7, EN_TRAMITE: 6, DERIVADOS: 5, POR_FIRMAR: 4, ATENDIDOS: 3, ARCHIVADOS: 2 };
const cursor = "v2-opaco_+/=no-decodificar";
function resumen(id: string) {
  return { idExpediente: id, cut: id === A ? "CUT-A" : "CUT-B", asunto: id === A ? "Asunto A" : "Asunto B",
    fechaRadicacion: fecha, estadoActual: "REGISTRADO", areaActualId: null };
}
function detalle(id: string) {
  return { ...resumen(id), solicitanteId: null, resumenDocumentos: null, ultimoMovimiento: null, sla: null };
}
function sla(id: string) {
  return { fechaInicio: "2026-10-01", fechaCalculo: "2026-10-16", fechaLimite: id === A ? "2026-11-29" : "2026-10-12",
    diasHabilesLimite: id === A ? 47 : 3, diasHabilesTranscurridos: 9,
    diasHabilesRestantes: id === A ? 38 : -6, porcentaje: id === A ? 19.15 : 300,
    estado: id === A ? "VERDE" : "ROJO" };
}
function recurso(id: string, sufijo: string) {
  if (sufijo === "/resumen") throw new ApiHttpError({ type: "about:blank", title: "Not Found", status: 404, detail: "Not found", instance: sufijo, code: "NOT_FOUND", category: "Business", correlationId: C, retryable: false });
  if (sufijo === "/tupa") return { tupa: null };
  if (sufijo === "") return detalle(id);
  if (sufijo === "/sla-status") return sla(id);
  if (sufijo === "/foliacion") return [{
    idDocumento: id === A ? C : B, nombre: id === A ? "Documento A" : "Documento B", tipo: null,
    folioInicio: 1, folioFin: id === A ? 3 : 7, cantidadFolios: id === A ? 3 : 7,
    rango: id === A ? "F. 0001 a F. 0003" : "F. 0001 a F. 0007", checksumSha256: null,
  }];
  return { expedienteId: id, actuaciones: [{
    movimientoId: id === A ? C : B, secuencia: "9007199254740993", fechaHora: fecha,
    estadoAnterior: "REGISTRADO", estadoNuevo: "RECEPCIONADO", evento: id === A ? "EVENTO_A" : "EVENTO_B",
    usuarioOperadorId: "9223372036854775807", areaAnteriorId: null, areaDestinoId: null,
    remitente: null, destinatario: null, proveido: null, datosAsociados: {},
    duracionMs: null, duracionMinutos: null, tipoActuacion: "NORMAL",
  }] };
}
const respuesta = (data: unknown) => ({ data } as AxiosResponse);
type Handler = (url: string, config?: AxiosRequestConfig) => Promise<AxiosResponse>;
function instalar(handler: Handler) {
  return vi.spyOn(apiClient, "get").mockImplementation(((url: string, config?: AxiosRequestConfig) =>
    url.includes("/organigrama/areas-activas")
      ? Promise.resolve(respuesta([{ id: "a0000000-0000-0000-0000-000000000001", nombre: "Unidad vigente", habilitada: true }]))
      : handler(url, config)) as typeof apiClient.get);
}
function parametrosUltimaLlamada(get: ReturnType<typeof instalar>) {
  const params = get.mock.calls.at(-1)?.[1]?.params;
  expect(params).toBeTypeOf("object");
  expect(params).not.toBeNull();
  return params as Record<string, unknown>;
}
function endpoint(url: string) {
  const pathname = new URL(url).pathname;
  const tupa = /^\/api\/v1\/tramites\/expedientes\/([^/]+)\/tupa$/.exec(pathname);
  if (tupa) return { id: decodeURIComponent(tupa[1]), sufijo: "/tupa" };
  const resto = pathname.replace("/api/v1/expedientes/", "");
  const [id, ...partes] = resto.split("/");
  return { id, sufijo: partes.length ? "/" + partes.join("/") : "" };
}
let clientes: QueryClient[] = [];
function montar(path = "/expedientes/" + A) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clientes.push(client);
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}>
    <Link to={"/expedientes/" + A}>Abrir A</Link><Link to={"/expedientes/" + B}>Abrir B</Link>
    <Routes><Route path="/expedientes" element={<Bandeja />} /><Route path="/expedientes/:id" element={<Detalle />} /></Routes>
  </MemoryRouter></QueryClientProvider>);
}
beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.setState({ accessToken: "token-operador", refreshToken: null,
    usuario: { id: C, nombreCompleto: "Operador", correo: "operador@example.test", rol: "ESPECIALISTA" }, isAuthenticated: true });
});
afterEach(() => { clientes.forEach(c => c.clear()); clientes = []; });
function normal(url: string) {
  const { id, sufijo } = endpoint(url);
  return Promise.resolve(respuesta(recurso(id, sufijo)));
}

describe("G6-04 frontend contra respuestas de contrato (sin API integrada)", () => {
  it("distingue carga y error de contadores sin inventar ceros", async () => {
    let rechazar!: (error: Error) => void;
    instalar(() => new Promise((_resolve, reject) => { rechazar = reject; }));
    montar("/expedientes");
    expect(screen.getByRole("tab", { name: "Pendientes (Cargando…)" })).toBeInTheDocument();
    await act(async () => rechazar(new Error("Error de red")));
    expect(await screen.findByRole("tab", { name: "Pendientes (No disponible)" })).toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: /\(0\)/ })).not.toBeInTheDocument();
  });

  it("identifica contadores ausentes sin convertirlos en cero", () => {
    render(<BandejaTabFilter estadoActivo="PENDIENTES" onCambiarEstado={() => {}} />);
    expect(screen.getByRole("tab", { name: "Pendientes (Sin dato)" })).toBeInTheDocument();
  });

  it("marca la pestaña activa, conserva cero real y aplica búsqueda solo al enviar", async () => {
    const get = instalar(async () => respuesta({ elementos: [resumen(A)],
      contadores: { ...contadores, PENDIENTES: 0 }, siguienteCursor: null, tieneMas: false }));
    montar("/expedientes");
    const activa = await screen.findByRole("tab", { name: "Pendientes (0)" });
    expect(screen.getByRole("region", { name: "Tabla de expedientes, desplazamiento horizontal" })).toHaveAttribute("tabindex", "0");
    expect(screen.getByRole("table")).toHaveClass("min-w-[56rem]", "table-fixed");
    expect(screen.getByLabelText("Buscar CUT o asunto").closest("form")).toHaveClass("grid", "grid-cols-1");
    expect(activa).toHaveAttribute("aria-selected", "true");
    expect(activa).toHaveClass("bg-blue-800", "underline", "focus-visible:outline-2");
    activa.focus();
    expect(activa).toHaveFocus();
    const llamadas = get.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Buscar CUT o asunto"), { target: { value: "Petición" } });
    expect(get).toHaveBeenCalledTimes(llamadas);
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(parametrosUltimaLlamada(get).terminoBusqueda).toBe("Petición"));
    fireEvent.click(await screen.findByRole("tab", { name: "En trámite (6)" }));
    const nueva = await screen.findByRole("tab", { name: "En trámite (6)" });
    expect(nueva).toHaveAttribute("aria-selected", "true");
    expect(nueva).toHaveClass("bg-blue-800");
    expect(activa).toHaveAttribute("aria-selected", "false");
    expect(activa).not.toHaveClass("bg-blue-800");
  });

  it("formatea fechas civiles sin desplazamiento e instantes en Lima preservando el original", () => {
    const vista = render(<><FechaRutaDoc valor="2026-10-01" /><FechaRutaDoc valor="2026-10-01T02:30:00Z" /></>);
    expect(screen.getByText("01/10/2026")).toHaveAttribute("datetime", "2026-10-01");
    expect(screen.getByText(/30\/09\/2026.*21:30/)).toHaveAttribute("datetime", "2026-10-01T02:30:00Z");
    expect(vista.container.querySelectorAll("time")).toHaveLength(2);
  });

  it("presenta radicación es-PE e identificador secundario completo accesible sin alterar rutas", async () => {
    const get = instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "" ? { ...detalle(id), areaActualId: C, solicitanteId: B } : recurso(id, sufijo));
    });
    montar();
    const area = (await screen.findByText("Área actual")).nextElementSibling!;
    const desplegable = within(area as HTMLElement).getByText(/ver identificador completo/).closest("summary")!;
    const contenedor = desplegable.closest("details")!;
    expect(contenedor).not.toHaveAttribute("open");
    desplegable.focus();
    expect(desplegable).toHaveFocus();
    fireEvent.click(desplegable);
    await waitFor(() => expect(contenedor).toHaveAttribute("open"));
    expect(within(area as HTMLElement).getByText(C)).toBeVisible();
    expect(screen.getByText("Radicación").nextElementSibling?.querySelector("time"))
      .toHaveAttribute("datetime", fecha);
    expect(screen.getByText("Radicación").nextElementSibling).toHaveTextContent(/01\/10\/2026.*05:00/);
    expect(get.mock.calls.every(([url]) => {
      const ruta = new URL(url).pathname;
      return ruta.startsWith(`/api/v1/expedientes/${A}`) || ruta === `/api/v1/tramites/expedientes/${A}/tupa`;
    })).toBe(true);
  });

  it("conserva el nombre documental del DTO como etiqueta", async () => {
    instalar(normal);
    montar();
    expect(await screen.findByText("Documento A")).toBeInTheDocument();
    expect(screen.queryByText("Nombre no disponible")).not.toBeInTheDocument();
  });

  it.each([A, B])("muestra las cinco capacidades con acciones habilitadas para operador en %s y conserva las lecturas", async id => {
    const get = instalar(normal);
    const errorEscritura = new Error("La página no debe enviar escrituras sin confirmación");
    const escrituras = [
      vi.spyOn(apiClient, "post").mockRejectedValue(errorEscritura),
      vi.spyOn(apiClient, "put").mockRejectedValue(errorEscritura),
      vi.spyOn(apiClient, "patch").mockRejectedValue(errorEscritura),
      vi.spyOn(apiClient, "delete").mockRejectedValue(errorEscritura),
      vi.spyOn(apiClient, "request").mockRejectedValue(errorEscritura),
    ];
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(errorEscritura);
    montar("/expedientes/" + id);
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    for (const nombre of ["Derivar", "Observar", "Acumular"]) {
      const boton = within(acciones).getByRole("button", { name: nombre });
      expect(boton).toBeVisible();
      expect(boton).toBeEnabled();
      fireEvent.click(boton);
      const dialogo = await screen.findByRole("dialog");
      expect(dialogo).toBeInTheDocument();
      const botonCerrar = within(dialogo).getByRole("button", { name: "Cancelar" });
      fireEvent.click(botonCerrar);
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    }
    const ccd = screen.getByRole("region", { name: "Clasificación CCD" });
    expect(ccd).toBeVisible();
    expect(ccd).toHaveTextContent("La consulta de clasificación documental no está disponible");
    const versiones = screen.getByRole("region", { name: "Versiones documentales" });
    expect(versiones).toBeVisible();
    expect(versiones).toHaveTextContent("La consulta del historial de versiones documentales no está disponible");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText(/sin clasificación|sin versiones|no hay versiones|suspender/i)).not.toBeInTheDocument();
    expect(await screen.findByText(id === A ? "EVENTO_A · NORMAL" : "EVENTO_B · NORMAL")).toBeInTheDocument();
    expect(await screen.findByText(id === A ? "F. 0001 a F. 0003 · 3 folios" : "F. 0001 a F. 0007 · 7 folios")).toBeInTheDocument();
    expect(await within(screen.getByRole("region", { name: "SLA" })).findByText(id === A ? "VERDE" : "ROJO")).toBeInTheDocument();
    expect(get.mock.calls.map(([url]) => new URL(url, "http://localhost").pathname).filter((ruta) => ruta !== "/api/v1/organigrama/areas-activas" && !ruta.endsWith("/resumen")).sort()).toEqual([
      `/api/v1/expedientes/${id}`, `/api/v1/expedientes/${id}/trazabilidad`,
      `/api/v1/expedientes/${id}/foliacion`, `/api/v1/expedientes/${id}/sla-status`,
      `/api/v1/tramites/expedientes/${id}/tupa`,
    ].sort());
    escrituras.forEach(escritura => expect(escritura).not.toHaveBeenCalled());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("usuario sin permiso (ESTUDIANTE) visualiza las acciones deshabilitadas y no puede ejecutar", async () => {
    useAuthStore.setState({
      accessToken: "mock-token",
      refreshToken: "mock-refresh",
      usuario: { id: "est-1", correo: "estudiante@institucion.edu.pe", rol: "CIUDADANO", nombreCompleto: "Estudiante Prueba" },
      isAuthenticated: true,
    });
    instalar(normal);
    montar("/expedientes/" + A);
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    for (const nombre of ["Derivar", "Observar", "Acumular"]) {
      const boton = within(acciones).getByRole("button", { name: nombre });
      expect(boton).toBeVisible();
      expect(boton).toBeDisabled();
      expect(boton).toHaveAccessibleDescription(/No cuenta con permisos/);
      fireEvent.click(boton);
    }
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("habilita Subsanar solo en OBSERVADO para usuario con permiso, confirma y actualiza las vistas", async () => {
    act(() => useAuthStore.setState({
      accessToken: "mock-token", refreshToken: null, isAuthenticated: true,
      usuario: { id: "operador-1", correo: "mesa@institucion.edu.pe", rol: "MESA_PARTES", nombreCompleto: "Mesa de Partes" },
    }));
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "" ? { ...detalle(id), estadoActual: "OBSERVADO" } : recurso(id, sufijo));
    });
    const post = vi.spyOn(apiClient, "post").mockResolvedValue({ data: {
      ok: true, expedienteId: A, motivo: "Documentos corregidos", estado: "EN_TRAMITE",
    } } as AxiosResponse);
    montar();
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    const boton = within(acciones).getByRole("button", { name: "Subsanar" });
    expect(boton).toBeEnabled();
    fireEvent.click(boton);
    const dialogo = await screen.findByRole("dialog");
    expect(post).not.toHaveBeenCalled();
    fireEvent.change(within(dialogo).getByRole("textbox"), { target: { value: "  Documentos   corregidos  " } });
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar subsanación" }));
    expect(post).not.toHaveBeenCalled();
    fireEvent.click(within(dialogo).getByRole("checkbox"));
    const invalidar = vi.spyOn(clientes[0], "invalidateQueries");
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar subsanación" }));
    await waitFor(() => expect(post).toHaveBeenCalledOnce());
    expect(post).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/expedientes/${A}/movimientos/subsanar`),
      { motivo: "Documentos corregidos" },
    );
    expect(await screen.findByRole("status")).toHaveTextContent("La subsanación fue registrada correctamente.");
    for (const key of [["rutadoc", A, "detalle"], ["rutadoc", A, "trazabilidad"], ["rutadoc", A, "sla"], ["rutadoc", "bandeja"]]) {
      expect(invalidar).toHaveBeenCalledWith({ queryKey: key, exact: true }, { throwOnError: true });
    }
  });

  it("mantiene Subsanar deshabilitado fuera de OBSERVADO o sin permiso", async () => {
    useAuthStore.setState({ accessToken: null, refreshToken: null, usuario: null, isAuthenticated: false });
    instalar(normal);
    montar();
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    const boton = within(acciones).getByRole("button", { name: "Subsanar" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/No cuenta con permisos/);
    act(() => useAuthStore.setState({
      accessToken: "mock-token", refreshToken: null, isAuthenticated: true,
      usuario: { id: "operador-1", correo: "mesa@institucion.edu.pe", rol: "MESA_PARTES", nombreCompleto: "Mesa de Partes" },
    }));
    expect(boton).toBeDisabled();
    await waitFor(() => expect(boton).toHaveAccessibleDescription(/estado OBSERVADO/));
  });

  it("no ofrece Subsanar a ESTUDIANTE aunque el expediente esté OBSERVADO", async () => {
    useAuthStore.setState({
      accessToken: "mock-token", refreshToken: null, isAuthenticated: true,
      usuario: { id: "est-1", correo: "estudiante@institucion.edu.pe", rol: "CIUDADANO", nombreCompleto: "Estudiante" },
    });
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "" ? { ...detalle(id), estadoActual: "OBSERVADO" } : recurso(id, sufijo));
    });
    const post = vi.spyOn(apiClient, "post");
    montar();
    const boton = await screen.findByRole("button", { name: "Subsanar" });
    expect(boton).toBeDisabled();
    expect(boton).toHaveAccessibleDescription(/No cuenta con permisos/);
    fireEvent.click(boton);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(post).not.toHaveBeenCalled();
  });

  it("ofrece Subsanar al ciudadano titular observado, pero no al especialista ajeno", async () => {
    useAuthStore.setState({ accessToken: 'token-ciudadano', refreshToken: null, isAuthenticated: true,
      usuario: { id: C, idPersona: B, correo: 'titular@example.test', rol: 'CIUDADANO', nombreCompleto: 'Titular' } });
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === '' ? { ...detalle(id), solicitanteId: B, estadoActual: 'OBSERVADO' } : recurso(id, sufijo));
    });
    montar();
    const boton = await screen.findByRole('button', { name: 'Subsanar' });
    expect(boton).toBeEnabled();
    act(() => useAuthStore.setState({ accessToken: 'token-especialista', refreshToken: null, isAuthenticated: true,
      usuario: { id: C, correo: 'especialista@example.test', rol: 'ESPECIALISTA', nombreCompleto: 'Especialista' } }));
    await waitFor(() => expect(boton).toBeDisabled());
  });

  it("conserva el modal Subsanar y muestra error RFC 9457 sin reenvío automático", async () => {
    useAuthStore.setState({
      accessToken: "mock-token", refreshToken: null, isAuthenticated: true,
      usuario: { id: "operador-1", correo: "mesa@institucion.edu.pe", rol: "MESA_PARTES", nombreCompleto: "Mesa de Partes" },
    });
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "" ? { ...detalle(id), estadoActual: "OBSERVADO" } : recurso(id, sufijo));
    });
    const post = vi.spyOn(apiClient, "post").mockRejectedValue(new ApiHttpError({
      type: "about:blank", title: "Conflicto", status: 409, detail: "Detalle privado",
      instance: `/expedientes/${A}`, code: "ESTADO_INVALIDO", category: "Conflict", correlationId: C, retryable: false,
    }));
    montar();
    fireEvent.click(await screen.findByRole("button", { name: "Subsanar" }));
    const dialogo = await screen.findByRole("dialog");
    fireEvent.change(within(dialogo).getByRole("textbox"), { target: { value: "Solicitud corregida" } });
    fireEvent.click(within(dialogo).getByRole("checkbox"));
    fireEvent.click(within(dialogo).getByRole("button", { name: "Confirmar subsanación" }));
    expect(await within(dialogo).findByRole("alert")).toHaveTextContent(/estado actual/);
    expect(within(dialogo).getByRole("alert")).not.toHaveTextContent("Detalle privado");
    expect(within(dialogo).getByRole("textbox")).toHaveValue("Solicitud corregida");
    expect(post).toHaveBeenCalledOnce();
  });

  it("confirmación de derivación exitosa ejecuta POST y muestra notificación de éxito", async () => {
    instalar(normal);
    const postSpy = vi.spyOn(apiClient, "post").mockResolvedValueOnce({
      data: { derivacionId: "der-uuid-1234", nuevoEstado: "DERIVADO" },
    } as AxiosResponse);
    montar("/expedientes/" + A);
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    const botonDerivar = within(acciones).getByRole("button", { name: "Derivar" });
    fireEvent.click(botonDerivar);
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toBeInTheDocument();

    const selectDestino = screen.getByLabelText(/Unidad de destino/i);
    await within(dialogo).findByRole("option", { name: "Unidad vigente" });
    fireEvent.change(selectDestino, { target: { value: "a0000000-0000-0000-0000-000000000001" } });

    const textareaProveido = screen.getByLabelText(/Proveído motivado/i);
    fireEvent.change(textareaProveido, { target: { value: "Derivación formal para evaluación técnica" } });

    const botonConfirmar = within(dialogo).getByRole("button", { name: "Confirmar derivación" });
    fireEvent.click(botonConfirmar);

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });

    expect(postSpy).toHaveBeenCalledTimes(1);
    expect(postSpy).toHaveBeenCalledWith(
      expect.stringContaining(`/api/v1/expedientes/${A}/movimientos/derivar`),
      {
        destinos: [{ area_destino_id: "a0000000-0000-0000-0000-000000000001", es_copia: false }],
        proveido: "Derivación formal para evaluación técnica",
      }
    );

    const toast = await screen.findByRole("status");
    expect(toast).toHaveTextContent("La derivación fue registrada correctamente.");
  });

  it("error de API en derivación se expone como alerta sin cerrar el modal", async () => {
    instalar(normal);
    vi.spyOn(apiClient, "post").mockRejectedValueOnce(
      new Error("Error de validación o rechazo del servidor")
    );
    montar("/expedientes/" + A);
    const acciones = await screen.findByRole("region", { name: "Acciones del expediente" });
    fireEvent.click(within(acciones).getByRole("button", { name: "Derivar" }));
    const dialogo = await screen.findByRole("dialog");
    expect(dialogo).toBeInTheDocument();

    const selectDestino = screen.getByLabelText(/Unidad de destino/i);
    await within(dialogo).findByRole("option", { name: "Unidad vigente" });
    fireEvent.change(selectDestino, { target: { value: "a0000000-0000-0000-0000-000000000001" } });

    const textareaProveido = screen.getByLabelText(/Proveído motivado/i);
    fireEvent.change(textareaProveido, { target: { value: "Pase con error simulado" } });

    const botonConfirmar = within(dialogo).getByRole("button", { name: "Confirmar derivación" });
    fireEvent.click(botonConfirmar);

    const alerta = await within(dialogo).findByRole("alert");
    expect(alerta).toBeVisible();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
  it("advierte el calendario provisional sin cambiar los valores SLA del backend", async () => {
    const recibido = Object.freeze(sla(A));
    const original = JSON.stringify(recibido);
    instalar(async url => {
      const { sufijo } = endpoint(url);
      return sufijo === "/sla-status" ? respuesta(recibido) : normal(url);
    });
    montar();
    const aviso = await screen.findByRole("note");
    expect(aviso).toBeVisible();
    expect(aviso).toHaveTextContent("el calendario institucional definitivo está pendiente de aprobación");
    expect(aviso).toHaveTextContent("Los valores mostrados proceden del backend");
    const panel = within(screen.getByRole("region", { name: "SLA" }));
    const valores = {
      "Estado SLA": recibido.estado, "Inicio": "01/10/2026",
      "Calculado": "16/10/2026", "Fecha límite": "29/11/2026",
      "Plazo hábil": String(recibido.diasHabilesLimite),
      "Días transcurridos": String(recibido.diasHabilesTranscurridos),
      "Días restantes": String(recibido.diasHabilesRestantes),
      "Porcentaje": `${recibido.porcentaje}%`,
    };
    for (const [etiqueta, valor] of Object.entries(valores)) {
      expect(panel.getByText(etiqueta).nextElementSibling).toHaveTextContent(valor);
    }
    expect(JSON.stringify(recibido)).toBe(original);
    for (const etiqueta of ["Inicio", "Calculado", "Fecha límite"]) {
      const clave = { Inicio: "fechaInicio", Calculado: "fechaCalculo", "Fecha límite": "fechaLimite" } as const;
      expect(panel.getByText(etiqueta).nextElementSibling?.querySelector("time"))
        .toHaveAttribute("datetime", recibido[clave[etiqueta as keyof typeof clave]]);
    }
  });
  it("pagina con cursor opaco, usa contadores y reinicia al cambiar filtros o pestaña", async () => {
    const get = instalar(async (_url, config) => {
      const segunda = Boolean(config?.params?.cursor);
      return respuesta({ elementos: [resumen(segunda ? B : A)], contadores,
        siguienteCursor: segunda ? null : cursor, tieneMas: !segunda });
    });
    montar("/expedientes");
    expect(await screen.findByText("CUT-A")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Pendientes (7)" })).toHaveAttribute("aria-selected", "true");
    fireEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(await screen.findByText("CUT-B")).toBeInTheDocument();
    expect(parametrosUltimaLlamada(get).cursor).toBe(cursor);
    fireEvent.click(screen.getByRole("button", { name: "Anterior" }));
    expect(await screen.findByText("CUT-A")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Buscar CUT o asunto"), { target: { value: "Solicitud" } });
    fireEvent.change(screen.getByLabelText("Área UUID"), { target: { value: B } });
    fireEvent.change(screen.getByLabelText("Desde"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-10-16" } });
    fireEvent.change(screen.getByLabelText("Por página"), { target: { value: "1" } });
    fireEvent.click(screen.getByRole("button", { name: "Aplicar filtros" }));
    await waitFor(() => expect(get.mock.calls.at(-1)?.[1]?.params).toMatchObject({
      terminoBusqueda: "Solicitud", areaId: B, fechaDesde: "2026-10-01", fechaHasta: "2026-10-16", limite: 1,
    }));
    expect(parametrosUltimaLlamada(get).cursor).toBeUndefined();
    fireEvent.click(await screen.findByRole("tab", { name: "En trámite (6)" }));
    await waitFor(() => expect(parametrosUltimaLlamada(get).pestana).toBe("EN_TRAMITE"));
    expect(parametrosUltimaLlamada(get).cursor).toBeUndefined();
  });

  it("abre detalle directo, conserva SLA literal y aísla eventos/folios/SLA al navegar A→B", async () => {
    const get = instalar(normal);
    montar();
    expect(await screen.findByText("CUT-A")).toBeInTheDocument();
    expect(await screen.findByText("EVENTO_A · NORMAL")).toBeInTheDocument();
    expect(await screen.findByText("F. 0001 a F. 0003 · 3 folios")).toBeInTheDocument();
    const panel = screen.getByRole("region", { name: "SLA" });
    await waitFor(() => expect(within(panel).getByText("VERDE")).toBeInTheDocument());
    for (const valor of ["47", "9", "38", "19.15%", "29/11/2026"]) {
      expect(within(panel).getByText(valor)).toBeInTheDocument();
    }
    expect(screen.getByText("Secuencia: 9007199254740993")).toBeInTheDocument();
    expect(screen.getByText("9223372036854775807")).toBeInTheDocument();
    expect(get.mock.calls.every(([url]) => {
      const ruta = new URL(url).pathname;
      return ruta.startsWith(`/api/v1/expedientes/${A}`) || ruta === `/api/v1/tramites/expedientes/${A}/tupa`;
    })).toBe(true);
    fireEvent.click(screen.getByRole("link", { name: "Abrir B" }));
    expect(await screen.findByText("CUT-B")).toBeInTheDocument();
    expect(await screen.findByText("EVENTO_B · NORMAL")).toBeInTheDocument();
    expect(await screen.findByText("F. 0001 a F. 0007 · 7 folios")).toBeInTheDocument();
    expect(await within(screen.getByRole("region", { name: "SLA" })).findByText("ROJO")).toBeInTheDocument();
    expect(screen.queryByText("EVENTO_A · NORMAL")).not.toBeInTheDocument();
    expect(screen.queryByText("F. 0001 a F. 0003 · 3 folios")).not.toBeInTheDocument();
    expect(screen.queryByText("VERDE")).not.toBeInTheDocument();
  });

  it("ignora las respuestas tardías de todos los recursos A después de mostrar B", async () => {
    const pendientes: (() => void)[] = [];
    const signals: AbortSignal[] = [];
    instalar((url, config) => {
      const { id, sufijo } = endpoint(url);
      if (id === A && sufijo !== "/resumen") {
        if (config?.signal) signals.push(config.signal as AbortSignal);
        // Ignora deliberadamente AbortSignal: prueba también aislamiento por clave.
        return new Promise(resolve => pendientes.push(() => resolve(respuesta(recurso(A, sufijo)))));
      }
      return normal(url);
    });
    montar();
    await waitFor(() => expect(pendientes).toHaveLength(5));
    expect(screen.getByRole("status")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("link", { name: "Abrir B" }));
    expect(await screen.findByText("EVENTO_B · NORMAL")).toBeInTheDocument();
    expect(await screen.findByText("ROJO")).toBeInTheDocument();
    await act(async () => { pendientes.forEach(resolve => resolve()); });
    expect(signals.every(signal => signal.aborted)).toBe(true);
    expect(screen.getByText("CUT-B")).toBeInTheDocument();
    expect(screen.queryByText("CUT-A")).not.toBeInTheDocument();
    expect(screen.queryByText("EVENTO_A · NORMAL")).not.toBeInTheDocument();
    expect(screen.queryByText("F. 0001 a F. 0003 · 3 folios")).not.toBeInTheDocument();
    expect(screen.queryByText("VERDE")).not.toBeInTheDocument();
  });

  it("muestra vacíos reales y no genera documentos, imágenes ni movimientos", async () => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "/trazabilidad" ? { expedienteId: id, actuaciones: [] }
        : sufijo === "/foliacion" ? [] : recurso(id, sufijo));
    });
    montar();
    expect(await screen.findByText("Sin actuaciones registradas.")).toBeInTheDocument();
    expect(await screen.findByText("Sin documentos foliados.")).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("muestra bandeja vacía sin confundirla con carga o fallo", async () => {
    instalar(async () => respuesta({ elementos: [], contadores, siguienteCursor: null, tieneMas: false }));
    montar("/expedientes");
    expect(await screen.findByText("No hay expedientes con los filtros aplicados.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Siguiente" })).toBeDisabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it.each(["", "/trazabilidad", "/foliacion", "/sla-status"])("rechaza respuesta inválida en recurso %s", async sufijoInvalido => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === sufijoInvalido ? {} : recurso(id, sufijo));
    });
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("respuesta inválida");
  });

  it("rechaza detalle y trazabilidad que devuelven otro UUID", async () => {
    instalar(async url => {
      const { sufijo } = endpoint(url);
      return respuesta(recurso(B, sufijo));
    });
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("respuesta inválida");
    expect(screen.queryByText("CUT-B")).not.toBeInTheDocument();
  });

  it.each([400, 401, 403, 404])("conserva error RFC 7807 %s en detalle", async status => {
    instalar(async () => { throw new ApiHttpError({
      type: "about:blank", title: "Error", status, detail: "Detalle del servidor",
      instance: "/expedientes", code: "TEST", category: "Business", correlationId: C, retryable: false,
    }); });
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(String(status));
    expect(screen.getByRole("alert")).toHaveTextContent("Detalle del servidor");
    expect(screen.queryByText("Documento A")).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Acciones del expediente" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Clasificación CCD" })).not.toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Versiones documentales" })).not.toBeInTheDocument();
  });

  it.each(["/trazabilidad", "/foliacion", "/sla-status"])("muestra fallo aislado en %s sin fabricar datos", async recursoError => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      if (sufijo === recursoError) throw new Error("Error de red");
      return respuesta(recurso(id, sufijo));
    });
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de red");
    expect(screen.getByText("CUT-A")).toBeInTheDocument();
  });

  it("muestra red en bandeja y no usa fixtures como alternativa", async () => {
    instalar(async () => { throw new Error("Error de red"); });
    montar("/expedientes");
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de red");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("rechaza la envoltura inválida de bandeja", async () => {
    instalar(async () => respuesta([]));
    montar("/expedientes");
    expect(await screen.findByRole("alert")).toHaveTextContent("respuesta inválida");
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("identifica un fallo de transporte normalizado por apiClient", async () => {
    instalar(async () => { throw new ApiHttpError({
      type: "about:blank", title: "Network Error", status: 500, detail: "Network Error",
      instance: "/expedientes", code: "ERR_HTTP_500", category: "System", correlationId: C, retryable: true,
    }); });
    montar("/expedientes");
    expect(await screen.findByRole("alert")).toHaveTextContent("Error de red");
  });

  it.each([400, 401, 403, 404].flatMap(status =>
    ["/trazabilidad", "/foliacion", "/sla-status"].map(sufijo => ({ status, sufijo }))))
  ("conserva $status en $sufijo sin ocultar el detalle válido", async ({ status, sufijo }) => {
    instalar(async url => {
      const recursoActual = endpoint(url);
      if (recursoActual.sufijo === sufijo) throw new ApiHttpError({
        type: "about:blank", title: "Error", status, detail: "Detalle del servidor",
        instance: sufijo, code: "TEST", category: "Business", correlationId: C, retryable: false,
      });
      return respuesta(recurso(recursoActual.id, recursoActual.sufijo));
    });
    montar();
    expect(await screen.findByRole("alert")).toHaveTextContent(String(status));
    expect(screen.getByText("CUT-A")).toBeInTheDocument();
  });

  function tupaPayload(id: string) {
    return { tupa: {
      registroVersionId: id === A ? C : B,
      codigoExterno: id === A ? "TUPA-2026-001" : null,
      codigo: id === A ? "TUPA-2026-001" : null,
      denominacion: id === A ? "Certificado de estudios" : "Constancia de matrícula",
      requisitos: id === A ? ["Solicitud", "Comprobante de pago"] : null,
      monto: id === A ? "15.00" : null,
      fuente: "TUPA-SUIZA-2026", pagina: 12, revision: 3,
      version: id === A ? "V1" : null, estadoValidacion: "APROBADO",
      vinculadoEn: "2026-10-01T10:00:00.000Z",
    } };
  }

  it("presenta el contexto TUPA vinculado como lectura sin recalcular ni inventar datos", async () => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "/tupa" ? tupaPayload(id) : recurso(id, sufijo));
    });
    montar("/expedientes/" + A);
    const seccion = await screen.findByRole("region", { name: "Contexto TUPA" });
    expect(within(seccion).getByText("Certificado de estudios")).toBeInTheDocument();
    expect(within(seccion).getByText("TUPA-2026-001")).toBeInTheDocument();
    expect(within(seccion).getByText("15.00")).toBeInTheDocument();
    expect(within(seccion).getByText("Solicitud")).toBeInTheDocument();
    expect(within(seccion).getByText("Comprobante de pago")).toBeInTheDocument();
    expect(within(seccion).getByText("TUPA-SUIZA-2026")).toBeInTheDocument();
    expect(within(seccion).getByText("APROBADO")).toBeInTheDocument();
    expect(within(seccion).getByText("V1")).toBeInTheDocument();
    expect(within(seccion).getByText("12")).toBeInTheDocument();
    expect(within(seccion).getByText("3")).toBeInTheDocument();
    const vinculado = within(seccion).getByText("Vinculado en").nextElementSibling!;
    expect(vinculado.querySelector("time")).toHaveAttribute("datetime", "2026-10-01T10:00:00.000Z");
    expect(within(seccion).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("no inventa código cuando el vínculo TUPA no lo publica", async () => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "/tupa" ? tupaPayload(id) : recurso(id, sufijo));
    });
    montar("/expedientes/" + B);
    const seccion = await screen.findByRole("region", { name: "Contexto TUPA" });
    expect(within(seccion).getByText("Constancia de matrícula")).toBeInTheDocument();
    expect(within(seccion).getByText("Código").nextElementSibling).toHaveTextContent("No disponible");
    expect(within(seccion).queryByText("TUPA-2026-001")).not.toBeInTheDocument();
  });

  it("muestra estado neutral cuando el expediente no tiene procedimiento TUPA vinculado", async () => {
    instalar(async url => {
      const { id, sufijo } = endpoint(url);
      return respuesta(sufijo === "/tupa" ? { tupa: null } : recurso(id, sufijo));
    });
    montar();
    const seccion = await screen.findByRole("region", { name: "Contexto TUPA" });
    expect(await within(seccion).findByText("Expediente sin procedimiento TUPA vinculado")).toBeInTheDocument();
    expect(within(seccion).queryByRole("alert")).not.toBeInTheDocument();
    expect(within(seccion).queryByText(/No disponible/)).not.toBeInTheDocument();
  });
});
