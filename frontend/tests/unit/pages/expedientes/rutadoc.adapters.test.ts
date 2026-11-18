import { describe, expect, it } from "vitest";
import { adaptarTrazabilidad, validarRespuesta } from "../../../../src/pages/expedientes/rutadoc/rutadoc.adapters";
import { bandejaSchema, detalleSchema, foliacionSchema, slaSchema } from "../../../../src/pages/expedientes/rutadoc/rutadoc.dto";

const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const movimiento = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
function actuacion(secuencia: string) {
  return { movimientoId: movimiento, secuencia, fechaHora: "2026-10-01T10:00:00.000Z",
    estadoAnterior: "REGISTRADO", estadoNuevo: "RECEPCIONADO", evento: "RECEPCION",
    usuarioOperadorId: "9223372036854775807", areaAnteriorId: null, areaDestinoId: null,
    remitente: null, destinatario: null, proveido: null, datosAsociados: {},
    duracionMs: null, duracionMinutos: null, tipoActuacion: "NORMAL" };
}
describe("Adaptadores del contrato UUID de Geric", () => {
  it("conserva BIGINT y ordena sin pérdida sobre MAX_SAFE_INTEGER", () => {
    const dato = adaptarTrazabilidad({ expedienteId: id,
      actuaciones: [actuacion("9007199254740993"), { ...actuacion("9007199254740992"), movimientoId: id }] }, id);
    expect(dato.actuaciones.map(a => a.secuencia)).toEqual(["9007199254740992", "9007199254740993"]);
    expect(dato.actuaciones[0].usuarioOperadorId).toBe("9223372036854775807");
    expect(dato.actuaciones[1].movimientoId).toBe(movimiento);
  });
  it("rechaza identidad cruzada y conserva vacío legítimo", () => {
    expect(() => adaptarTrazabilidad({ expedienteId: movimiento, actuaciones: [] }, id)).toThrow("inválida");
    expect(adaptarTrazabilidad({ expedienteId: id, actuaciones: [] }, id).actuaciones).toEqual([]);
  });
  it.each(["abc", "0", "-1", "9223372036854775808"])("rechaza secuencia inválida %s sin lanzar BigInt", secuencia => {
    expect(() => adaptarTrazabilidad({ expedienteId: id, actuaciones: [actuacion(secuencia)] }, id)).toThrow("respuesta inválida");
  });
  it("rechaza arreglo legado, paginación incoherente y contadores ausentes", () => {
    expect(() => validarRespuesta(bandejaSchema, [])).toThrow("inválida");
    expect(() => validarRespuesta(bandejaSchema, { elementos: [], tieneMas: true, siguienteCursor: null })).toThrow("inválida");
  });
  it("rechaza folios y SLA inválidos sin inventar alternativas", () => {
    expect(() => validarRespuesta(foliacionSchema, [{ idDocumento: id, nombre: null, tipo: null,
      folioInicio: 4, folioFin: 2, cantidadFolios: 3, rango: "incorrecto", checksumSha256: null }])).toThrow("inválida");
    expect(() => validarRespuesta(slaSchema, { estado: "NORMAL" })).toThrow("inválida");
    expect(validarRespuesta(foliacionSchema, [])).toEqual([]);
  });
  it("detalle no exige identidad desde CUT ni datos TUPA inexistentes", () => {
    const detalle = { idExpediente: id, cut: "CUT-opaco", asunto: "", fechaRadicacion: "2026-10-01T10:00:00Z",
      estadoActual: "REGISTRADO", areaActualId: null, solicitanteId: null, resumenDocumentos: null,
      ultimoMovimiento: null, sla: null };
    expect(validarRespuesta(detalleSchema, detalle)).toEqual(detalle);
    expect(() => validarRespuesta(detalleSchema, { ...detalle, idExpediente: "123" })).toThrow("inválida");
  });
});
