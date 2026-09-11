import type { ReactNode } from "react";
import { act, renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it, vi } from "vitest";

import { conexo, diferida, expediente } from "../test/expedientesFixtures";
import type { ResultadoDerivacion, ServicioExpedienteActions } from "../types/expedienteActions";
import { useExpedienteActions } from "./useExpedienteActions";

function preparar() {
  const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  const claves = [["detalle-prueba", expediente.id], ["bandeja-prueba", "origen"], ["bandeja-prueba", "destino"], ["contadores-prueba", "unidad"]];
  const ajena = ["administracion-prueba"];
  [...claves, ajena].forEach((queryKey) => cliente.setQueryData(queryKey, { dato: "antes" }));
  function Wrapper({ children }: { children: ReactNode }) { return <QueryClientProvider client={cliente}>{children}</QueryClientProvider>; }
  return { cliente, claves, ajena, wrapper: Wrapper };
}

describe("useExpedienteActions", () => {
  it("bloquea doble envío y solo notifica/actualiza queries afectadas después de la respuesta", async () => {
    const { cliente, claves, ajena, wrapper } = preparar();
    const respuesta = diferida<ResultadoDerivacion>();
    const derivar = vi.fn(() => respuesta.promesa);
    const notificar = vi.fn();
    const obtenerClavesAfectadas = vi.fn(() => claves);
    const invalidar = vi.spyOn(cliente, "invalidateQueries");
    const { result } = renderHook(() => useExpedienteActions({ servicio: { derivar }, obtenerClavesAfectadas, notificar }), { wrapper });
    const entrada = { expediente, unidadDestinoId: "destino", proveido: "Revisar solicitud" };
    let envio: Promise<boolean> = Promise.resolve(false);
    await act(async () => { envio = result.current.derivacion.ejecutar(entrada); });
    await waitFor(() => expect(result.current.derivacion.pending).toBe(true));
    expect(notificar).not.toHaveBeenCalled();
    expect(invalidar).not.toHaveBeenCalled();
    await act(async () => { expect(await result.current.derivacion.ejecutar(entrada)).toBe(false); });
    expect(derivar).toHaveBeenCalledOnce();
    await act(async () => { respuesta.resolver({ derivacionId: "derivacion-prueba", nuevoEstado: "ESTADO_PRUEBA" }); expect(await envio).toBe(true); });
    await waitFor(() => expect(result.current.derivacion.estado).toBe("success"));
    expect(obtenerClavesAfectadas).toHaveBeenCalledWith([expediente.id]);
    expect(invalidar).toHaveBeenCalledTimes(claves.length);
    claves.forEach((queryKey) => {
      expect(invalidar).toHaveBeenCalledWith({ queryKey, exact: true }, { throwOnError: true });
      expect(cliente.getQueryState(queryKey)?.isInvalidated).toBe(true);
    });
    expect(cliente.getQueryState(ajena)?.isInvalidated).toBe(false);
    expect(notificar).toHaveBeenCalledOnce();
    expect(result.current.notificacion?.tipo).toBe("success");
    act(() => result.current.limpiarNotificacion());
    expect(result.current.notificacion).toBeNull();
    act(() => result.current.derivacion.restablecer());
    await waitFor(() => expect(result.current.derivacion.estado).toBe("idle"));
  });

  it("comparte el bloqueo entre instancias de hook y libera tras error", async () => {
    const { wrapper } = preparar();
    const pendiente = diferida<ResultadoDerivacion>();
    const derivar = vi.fn(() => pendiente.promesa);
    const opciones = { servicio: { derivar }, obtenerClavesAfectadas: () => [] };
    const { result } = renderHook(() => ({ uno: useExpedienteActions(opciones), dos: useExpedienteActions(opciones) }), { wrapper });
    const entrada = { expediente, unidadDestinoId: "destino", proveido: "Motivo" };
    let envio: Promise<boolean> = Promise.resolve(false);
    await act(async () => { envio = result.current.uno.derivacion.ejecutar(entrada); });
    await act(async () => { expect(await result.current.dos.derivacion.ejecutar(entrada)).toBe(false); });
    expect(derivar).toHaveBeenCalledOnce();
    await act(async () => { pendiente.rechazar(new Error("Detalle privado")); expect(await envio).toBe(false); });
    derivar.mockResolvedValueOnce({ derivacionId: "nueva", nuevoEstado: "ESTADO_PRUEBA" });
    await act(async () => { expect(await result.current.dos.derivacion.ejecutar(entrada)).toBe(true); });
    expect(derivar).toHaveBeenCalledTimes(2);
  });

  it.each([400, 401, 403, 409, 422, 500])("maneja RFC 7807 HTTP %i sin éxito ni invalidaciones falsas", async (status) => {
    const { cliente, wrapper } = preparar();
    const invalidar = vi.spyOn(cliente, "invalidateQueries");
    const problema = new AxiosError("DETALLE_INTERNO", undefined, undefined, undefined, { status, statusText: "Error", config: { headers: new AxiosHeaders() }, headers: {}, data: { type: "urn:prueba", status, detail: "DETALLE_INTERNO", invalid_params: [{ name: "motivo", reason: "DETALLE_INTERNO" }] } });
    const { result } = renderHook(() => useExpedienteActions({ servicio: { observar: async () => { throw problema; } }, obtenerClavesAfectadas: () => [] }), { wrapper });
    await act(async () => { expect(await result.current.observacion.ejecutar({ expediente, motivo: "Pliego" })).toBe(false); });
    await waitFor(() => expect(result.current.observacion.estado).toBe("error"));
    expect(result.current.observacion.error?.status).toBe(status);
    expect(result.current.notificacion?.tipo).toBe("error");
    expect(result.current.notificacion?.mensaje).not.toContain("DETALLE_INTERNO");
    expect(invalidar).not.toHaveBeenCalled();
  });

  it("refleja OBSERVADO/slaPaused y acumula invalidando principal y conexos", async () => {
    const { wrapper } = preparar();
    const claves = vi.fn(() => []);
    const acumular = vi.fn(async () => undefined);
    const servicio: ServicioExpedienteActions = { observar: async () => ({ estado: "OBSERVADO", slaPaused: true }), acumular };
    const { result } = renderHook(() => useExpedienteActions({ servicio, obtenerClavesAfectadas: claves }), { wrapper });
    await act(async () => { await result.current.observacion.ejecutar({ expediente, motivo: "Pliego" }); });
    await waitFor(() => expect(result.current.observacion.resultado).toEqual({ estado: "OBSERVADO", slaPaused: true }));
    const entrada = { principal: expediente, conexos: [conexo], motivo: "Asuntos conexos" };
    await act(async () => { expect(await result.current.acumulacion.ejecutar(entrada)).toBe(true); });
    expect(acumular).toHaveBeenCalledWith(entrada);
    expect(claves).toHaveBeenLastCalledWith([expediente.id, conexo.id]);
  });

  it("no simula éxito cuando falta el servicio y nunca invalida globalmente", async () => {
    const { cliente, wrapper } = preparar();
    const invalidar = vi.spyOn(cliente, "invalidateQueries");
    const { result } = renderHook(() => useExpedienteActions({ obtenerClavesAfectadas: () => [[]] }), { wrapper });
    expect(result.current.derivacion.disponible).toBe(false);
    expect(result.current.observacion.disponible).toBe(false);
    expect(result.current.acumulacion.disponible).toBe(false);
    await act(async () => { expect(await result.current.acumulacion.ejecutar({ principal: expediente, conexos: [conexo], motivo: "Motivo" })).toBe(false); });
    await waitFor(() => expect(result.current.acumulacion.error?.tipo).toBe("integracion"));
    expect(invalidar).not.toHaveBeenCalled();
  });

  it("distingue una escritura exitosa de un fallo posterior de revalidación", async () => {
    const { cliente, wrapper } = preparar();
    vi.spyOn(cliente, "invalidateQueries").mockRejectedValueOnce(new Error("Consulta fallida"));
    const derivar = vi.fn(async () => ({ derivacionId: "derivacion-prueba", nuevoEstado: "ESTADO_PRUEBA" }));
    const { result } = renderHook(() => useExpedienteActions({ servicio: { derivar }, obtenerClavesAfectadas: () => [["detalle-prueba"]] }), { wrapper });
    await act(async () => { expect(await result.current.derivacion.ejecutar({ expediente, unidadDestinoId: "destino", proveido: "Motivo" })).toBe(true); });
    await waitFor(() => expect(result.current.notificacion?.tipo).toBe("aviso"));
    expect(result.current.notificacion?.mensaje).toContain("sin repetir la operación");
    expect(derivar).toHaveBeenCalledOnce();
  });
});
