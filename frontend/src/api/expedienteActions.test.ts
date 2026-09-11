import { describe, expect, it, vi } from "vitest";
import { expediente } from "../test/expedientesFixtures";
import { crearServicioExpedienteActions } from "./expedienteActions";
import { apiClient } from "./client";

vi.mock("./client", () => ({ apiClient: { post: vi.fn(), defaults: { baseURL: "https://sigd.example/api" } } }));

describe("servicio de acciones y frontera de contratos pendientes", () => {
  it("no habilita operaciones ni hace peticiones sin DTO verificados", () => {
    expect(crearServicioExpedienteActions()).toEqual({});
    expect(apiClient.post).not.toHaveBeenCalled();
  });
  it("respeta el payload del adaptador y la ruta canónica de derivación", async () => {
    // Contrato sintético de prueba; NO es el DTO de producción pendiente.
    const payloadPrueba = { campoDeContratoEnPrueba: "valor de prueba" };
    const adaptar = vi.fn(() => payloadPrueba);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { derivacionId: "derivacion-prueba", nuevoEstado: "ESTADO_DE_PRUEBA" } });
    const servicio = crearServicioExpedienteActions({ derivacion: { construirPayload: adaptar } });
    const entrada = { expediente: { ...expediente, id: "id/prueba" }, unidadDestinoId: "destino", proveido: "Motivo" };
    await expect(servicio.derivar?.(entrada)).resolves.toEqual({ derivacionId: "derivacion-prueba", nuevoEstado: "ESTADO_DE_PRUEBA" });
    expect(adaptar).toHaveBeenCalledWith(entrada);
    expect(apiClient.post).toHaveBeenCalledWith("https://sigd.example/api/v1/expedientes/id%2Fprueba/movimientos/derivar", payloadPrueba);
  });
  it("comprueba OBSERVADO y slaPaused sin calcular SLA en frontend", async () => {
    const payloadPrueba = { campoDeContratoEnPrueba: "pliego" };
    const servicio = crearServicioExpedienteActions({ observacion: { construirPayload: () => payloadPrueba } });
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { estado: "OBSERVADO", slaPaused: true } });
    await expect(servicio.observar?.({ expediente, motivo: "Pliego" })).resolves.toEqual({ estado: "OBSERVADO", slaPaused: true });
    expect(apiClient.post).toHaveBeenCalledWith(`https://sigd.example/api/v1/expedientes/${expediente.id}/movimientos/observar`, payloadPrueba);
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data: { estado: "OBSERVADO", slaPaused: false } });
    await expect(servicio.observar?.({ expediente, motivo: "Pliego" })).rejects.toMatchObject({ tipo: "respuesta" });
  });
  it.each([null, {}, { derivacionId: "", nuevoEstado: "X" }, { derivacionId: "id", nuevoEstado: "" }])("rechaza respuestas de derivación no confirmadas: %s", async (data) => {
    vi.mocked(apiClient.post).mockResolvedValueOnce({ data });
    const servicio = crearServicioExpedienteActions({ derivacion: { construirPayload: () => ({}) } });
    await expect(servicio.derivar?.({ expediente, unidadDestinoId: "destino", proveido: "Motivo" })).rejects.toMatchObject({ tipo: "respuesta" });
  });
  it("permite un adaptador de acumulación sin inventar una ruta", async () => {
    const acumular = vi.fn(async () => undefined);
    const servicio = crearServicioExpedienteActions({ acumulacion: acumular });
    const entrada = { principal: expediente, conexos: [], motivo: "Solo prueba de transporte desacoplado" };
    await servicio.acumular?.(entrada);
    expect(acumular).toHaveBeenCalledWith(entrada);
    expect(apiClient.post).not.toHaveBeenCalled();
  });
});
