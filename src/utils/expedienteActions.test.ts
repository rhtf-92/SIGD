import { AxiosError, AxiosHeaders } from "axios";
import { describe, expect, it } from "vitest";
import { conexo, expediente, unidades } from "../test/expedientesFixtures";
import { ErrorAccionExpediente } from "../types/expedienteActions";
import { adaptarErrorAccion, normalizarMotivo, validarAcumulacion, validarDerivacion } from "./expedienteActions";

export function errorProblema(status: number, data: unknown = { type: "urn:problema:prueba", title: "DETALLE_INTERNO", status, detail: "DETALLE_INTERNO", invalid_params: [{ name: "proveido", reason: "DETALLE_INTERNO" }] }) {
  return new AxiosError("DETALLE_INTERNO", undefined, undefined, undefined, { status, data, statusText: "Error", headers: {}, config: { headers: new AxiosHeaders() } });
}

describe("validaciones de acciones", () => {
  it("normaliza espacios conservando párrafos y contenido significativo", () => {
    expect(normalizarMotivo("  Revisar   el expediente.\r\n\r\n  Adjuntar\t informe.  ")).toBe("Revisar el expediente.\n\nAdjuntar informe.");
    expect(normalizarMotivo(" \n\t ")).toBe("");
  });
  it("exige destino vigente, distinto al origen y proveído", () => {
    expect(validarDerivacion("", " ", expediente, unidades)).toEqual({ unidadDestinoId: "Seleccione una unidad de destino válida.", proveido: "El proveído motivado es obligatorio." });
    expect(validarDerivacion("origen-prueba", "Motivo", expediente, unidades).unidadDestinoId).toContain("distinto");
    expect(validarDerivacion("inactiva-prueba", "Motivo", expediente, unidades).unidadDestinoId).toContain("válida");
    expect(validarDerivacion("destino-prueba", "Motivo", expediente, unidades)).toEqual({ unidadDestinoId: "", proveido: "" });
  });
  it("rechaza autoacumulación, duplicados y justificación vacía", () => {
    expect(validarAcumulacion(expediente, [], " ")).toEqual({ conexos: "Seleccione al menos un expediente conexo.", motivo: "La justificación de acumulación es obligatoria." });
    expect(validarAcumulacion(expediente, [expediente], "Motivo").conexos).toContain("consigo mismo");
    expect(validarAcumulacion(expediente, [conexo, conexo], "Motivo").conexos).toContain("duplicados");
    expect(validarAcumulacion(expediente, [conexo], "Motivo")).toEqual({ conexos: "", motivo: "" });
  });
});

describe("RFC 7807", () => {
  it.each([400, 401, 403, 404, 409, 422, 500])("presenta mensaje seguro para HTTP %i", (status) => {
    const error = adaptarErrorAccion(errorProblema(status));
    expect(error).toMatchObject({ tipo: "http", status });
    expect(error.message).not.toContain("DETALLE_INTERNO");
  });
  it("maneja red, datos no RFC y errores de integración", () => {
    expect(adaptarErrorAccion(new Error("DETALLE_INTERNO")).tipo).toBe("red");
    expect(adaptarErrorAccion(new AxiosError("DETALLE_INTERNO")).tipo).toBe("red");
    expect(adaptarErrorAccion(errorProblema(500, "<html>Error privado</html>")).status).toBe(500);
    expect(adaptarErrorAccion(errorProblema(0, { status: 422 })).status).toBe(422);
    expect(adaptarErrorAccion(errorProblema(0, null)).status).toBe(0);
    const propio = new ErrorAccionExpediente("Integración pendiente", "integracion");
    expect(adaptarErrorAccion(propio)).toBe(propio);
  });
});
