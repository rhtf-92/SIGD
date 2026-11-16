import "@testing-library/jest-dom/vitest";
import { act, renderHook, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/api/client";
import { TIMEOUT_AGENTE_MS, dispararProtocoloViaIframe, useRefirmaGateway } from "@/hooks/useRefirmaGateway";
import type { DocumentoOficial } from "@/types/firmaDigital";
const auth = vi.hoisted(() => ({ usuario: { id: "cuenta-sintetica", nombreCompleto: "Operador de prueba" } as { id: string; nombreCompleto: string } | null }));
vi.mock("@/api/client", () => ({ apiClient: { post: vi.fn(), get: vi.fn() } }));
vi.mock("@/stores/authStore", () => ({ useAuthStore: { getState: () => auth } }));
const DOCUMENTO: DocumentoOficial = {
  idDocumento: "cb0af3db-614e-4379-975f-5547a8018e5a", idTramite: "expediente",
  tipoActo: "RD", numeroCorrelativo: "Borrador de prueba", anio: 2026, asunto: "Prueba",
  urlPdfOriginal: "/documento", hashSha256: "a".repeat(64), estadoFirma: "PENDIENTE", fechaGeneracion: "2026-10-19",
};
const AUSENTE = { documentoId: DOCUMENTO.idDocumento, estado: null, resultado: null, integridadVerificada: false, validacionCriptografica: false };
const CONFIRMADO = { documentoId: DOCUMENTO.idDocumento, estado: "FIRMADO_DIGITALMENTE", resultado: { cvd: "CVD-2026-0123456789ABCDEF", urlFirmado: "https://storage.invalid/pdf-firmado", timestamp: "2026-10-19T12:00:00Z" }, integridadVerificada: true, validacionCriptografica: false };
const URI = "refirma://sign?arguments=[eyJwcnVlYmEiOnRydWV9]";
beforeEach(() => {
  vi.useFakeTimers(); vi.clearAllMocks();
  auth.usuario = { id: "cuenta-sintetica", nombreCompleto: "Operador de prueba" };
  vi.mocked(apiClient.get).mockReset().mockResolvedValue({ data: AUSENTE });
  vi.mocked(apiClient.post).mockReset().mockResolvedValue({ data: { uriProtocolar: URI, expiraEn: new Date(Date.now() + TIMEOUT_AGENTE_MS).toISOString() } });
});
afterEach(() => { cleanup(); vi.useRealTimers(); document.body.innerHTML = ""; });
async function iniciar(result: { current: ReturnType<typeof useRefirmaGateway> }) {
  await act(async () => { result.current.iniciarFirma(DOCUMENTO, "99000002"); });
}
describe("Pasarela de firma sin resultados simulados", () => {
  it("usa el documento y la identidad de sesion en el endpoint original", async () => {
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(apiClient.post).toHaveBeenCalledWith("/api/v1/firma/invocar-refirma", {
      documentoId: DOCUMENTO.idDocumento, firmante: { id: "cuenta-sintetica", nombre: "Operador de prueba", documento: "99000002" },
    }, expect.objectContaining({ signal: expect.any(AbortSignal) }));
    expect(document.querySelector("iframe")?.getAttribute("src")).toBe(URI);
  });
  it("no inventa PIN, TSA, CVD ni firma al transcurrir el tiempo", async () => {
    const completado = vi.fn(); const { result } = renderHook(() => useRefirmaGateway(completado)); await iniciar(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(15000); });
    expect(result.current.estado).toBe("CONECTANDO"); expect(result.current.resultado).toBeNull(); expect(completado).not.toHaveBeenCalled();
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMEOUT_AGENTE_MS); });
    expect(result.current.estado).toBe("TIMEOUT"); expect(result.current.resultado).toBeNull(); expect(completado).not.toHaveBeenCalled();
  });
  it("muestra el rechazo real sin invocar un protocolo alternativo", async () => {
    vi.mocked(apiClient.post).mockRejectedValue(new Error("Acceso denegado"));
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(result.current.estado).toBe("ERROR"); expect(result.current.mensajeError).toBe("Acceso denegado"); expect(document.querySelector("iframe")).toBeNull();
  });
  it("rechaza una respuesta sin URI del contrato original", async () => {
    vi.mocked(apiClient.post).mockResolvedValue({ data: { uriProtocolar: "https://ajeno.invalid" } });
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(result.current.estado).toBe("ERROR"); expect(document.querySelector("iframe")).toBeNull();
  });
  it("evita solicitudes simultaneas duplicadas", async () => {
    const { result } = renderHook(() => useRefirmaGateway());
    await act(async () => { result.current.iniciarFirma(DOCUMENTO, "99000002"); result.current.iniciarFirma(DOCUMENTO, "99000002"); });
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it("cancelar impide invocar el agente con una respuesta tardia", async () => {
    let resolver!: (value: unknown) => void;
    vi.mocked(apiClient.post).mockImplementation(() => new Promise(resolve => { resolver = resolve; }) as never);
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    act(() => result.current.cancelar());
    await act(async () => resolver({ data: { uriProtocolar: URI, expiraEn: new Date(Date.now() + TIMEOUT_AGENTE_MS).toISOString() } }));
    expect(result.current.estado).toBe("INACTIVO"); expect(document.querySelector("iframe")).toBeNull();
  });
  it("no solicita firma sin identidad autenticada", async () => {
    auth.usuario = null; const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(result.current.estado).toBe("ERROR"); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it("el iframe no navega la SPA y se retira", () => {
    const origen = window.location.href; dispararProtocoloViaIframe(URI);
    expect(window.location.href).toBe(origen); expect(document.querySelector("iframe")).not.toBeNull();
    act(() => vi.advanceTimersByTime(2500)); expect(document.querySelector("iframe")).toBeNull();
  });
  it("confirma una sola vez cuando el sondeo obtiene evidencia persistida y cotejada", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: AUSENTE }).mockResolvedValueOnce({ data: AUSENTE }).mockResolvedValue({ data: CONFIRMADO });
    const completado = vi.fn(); const { result } = renderHook(() => useRefirmaGateway(completado)); await iniciar(result);
    expect(result.current.estado).toBe("CONECTANDO");
    await act(async () => { await vi.advanceTimersByTimeAsync(2000); });
    expect(result.current.estado).toBe("COMPLETADO"); expect(result.current.resultado).toEqual(CONFIRMADO.resultado); expect(completado).toHaveBeenCalledOnce();
    const consultas = vi.mocked(apiClient.get).mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMEOUT_AGENTE_MS); });
    expect(apiClient.get).toHaveBeenCalledTimes(consultas); expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it("una evidencia existente evita invocar nuevamente al agente", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: CONFIRMADO });
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(result.current.estado).toBe("COMPLETADO"); expect(apiClient.post).not.toHaveBeenCalled(); expect(document.querySelector("iframe")).toBeNull();
  });
  it("al reabrir el documento recupera la evidencia sin memoria de la solicitud previa", async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: CONFIRMADO });
    const { result } = renderHook(() => useRefirmaGateway());
    await act(async () => { result.current.consultarEstado(DOCUMENTO); });
    expect(result.current.resultado).toEqual(CONFIRMADO.resultado); expect(result.current.estado).toBe("COMPLETADO"); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it("ausencia de registro al recuperar no inventa pendiente, rechazo ni vencimiento", async () => {
    const { result } = renderHook(() => useRefirmaGateway());
    await act(async () => { result.current.consultarEstado(DOCUMENTO); });
    expect(result.current.estado).toBe("INACTIVO"); expect(result.current.resultado).toBeNull(); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it("errores de consulta detienen el sondeo sin generar un resultado positivo", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: AUSENTE }).mockRejectedValueOnce(new Error("503 Storage no disponible"));
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    expect(result.current.estado).toBe("ERROR"); expect(result.current.resultado).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); }); expect(apiClient.get).toHaveBeenCalledTimes(2);
  });
  it.each([
    { ...CONFIRMADO, documentoId: "ajeno" },
    { ...CONFIRMADO, integridadVerificada: false },
    { ...CONFIRMADO, resultado: null },
    { ...CONFIRMADO, resultado: { ...CONFIRMADO.resultado, cvd: "inventado" } },
    { ...CONFIRMADO, resultado: { ...CONFIRMADO.resultado, timestamp: "invalido" } },
    { ...CONFIRMADO, resultado: { ...CONFIRMADO.resultado, urlFirmado: "javascript:alert(1)" } },
  ])("no acepta un resultado inconsistente %j", async respuesta => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: respuesta });
    const completado = vi.fn(); const { result } = renderHook(() => useRefirmaGateway(completado)); await iniciar(result);
    expect(result.current.estado).toBe("ERROR"); expect(completado).not.toHaveBeenCalled(); expect(apiClient.post).not.toHaveBeenCalled();
  });
  it("no solapa GET mientras una consulta de estado sigue en curso", async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: AUSENTE }).mockImplementationOnce(() => new Promise(() => {}) as never);
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(10000); });
    expect(apiClient.get).toHaveBeenCalledTimes(2); expect(result.current.estado).toBe("CONECTANDO");
  });
  it("tras vencer reintenta solo la lectura del resultado, sin otro POST", async () => {
    const { result } = renderHook(() => useRefirmaGateway()); await iniciar(result);
    await act(async () => { await vi.advanceTimersByTimeAsync(TIMEOUT_AGENTE_MS + 1); });
    expect(result.current.estado).toBe("TIMEOUT");
    vi.mocked(apiClient.get).mockResolvedValue({ data: CONFIRMADO });
    await act(async () => { result.current.reintentar(); });
    expect(result.current.estado).toBe("COMPLETADO"); expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it("desmontar aborta el sondeo y no notifica resultados tardios", async () => {
    let resolver!: (value: unknown) => void;
    vi.mocked(apiClient.get).mockResolvedValueOnce({ data: AUSENTE }).mockImplementationOnce(() => new Promise(resolve => { resolver = resolve; }) as never);
    const completado = vi.fn(); const { result, unmount } = renderHook(() => useRefirmaGateway(completado)); await iniciar(result);
    const signal = vi.mocked(apiClient.get).mock.calls[1][1]?.signal;
    unmount(); expect(signal?.aborted).toBe(true);
    await act(async () => { resolver({ data: CONFIRMADO }); }); expect(completado).not.toHaveBeenCalled();
  });

});
