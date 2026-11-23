import { describe, expect, it } from "vitest";
import type { Resumen } from "../../../../src/pages/expedientes/rutadoc/rutadoc.dto";
import { calcularConteosSla, generarCsvExpedientes, resolverEstadoSla } from "../../../../src/pages/expedientes/rutadoc/rutadoc.summary";

const expediente = (idExpediente: string): Resumen => ({
  idExpediente, cut: `CUT-${idExpediente}`, asunto: "", fechaRadicacion: "2026-11-22",
  estadoActual: "REGISTRADO", areaActualId: null,
});

describe("resumen local de RutaDoc", () => {
  it("cuenta los estados SLA existentes y no asigna estado a datos faltantes", () => {
    const elementos = ["a", "b", "c", "d"].map(expediente);
    expect(calcularConteosSla(elementos, new Map([["a", "VERDE"], ["b", "AMARILLO"], ["c", "ROJO"]])))
      .toEqual({ TOTAL: 4, VERDE: 1, AMARILLO: 1, ROJO: 1 });
  });

  it("genera CSV UTF-8 con BOM, tildes y comillas escapadas", () => {
    const dato = { ...expediente("a"), cut: "CUT-1", asunto: 'Revisión, "urgente"', areaActualNombre: "Dirección" };
    expect(generarCsvExpedientes([dato])).toBe('\uFEFF"CUT","Asunto","Estado","Área actual","Radicación"\r\n"CUT-1","Revisión, ""urgente""","REGISTRADO","Dirección","2026-11-22"');
  });

  it("escapa comas, comillas dobles y saltos de línea según RFC-4180", () => {
    const dato = {
      ...expediente("a"), cut: "CUT-1", asunto: 'Solicitud, "urgente"\nSegunda línea',
      areaActualNombre: 'Subdirección, "Académica"\nSDA',
    };
    expect(generarCsvExpedientes([dato])).toBe(
      '\uFEFF"CUT","Asunto","Estado","Área actual","Radicación"\r\n' +
      '"CUT-1","Solicitud, ""urgente""\nSegunda línea","REGISTRADO","Subdirección, ""Académica""\nSDA","2026-11-22"',
    );
  });

  it.each(["ATENDIDO", "ARCHIVADO", "ANULADO"])("excluye el estado terminal %s del conteo SLA vencido y por vencer", estadoTerminal => {
    const terminales = ["ROJO", "AMARILLO", "ROJO"].map((estadoSla, indice) => ({
      ...expediente(`terminal-${indice}`), estadoActual: estadoTerminal as Resumen["estadoActual"],
      fechaLimite: "2020-01-01",
      estadoSla,
    }));
    const estados = new Map(terminales.map(({ idExpediente, estadoSla }) => [
      idExpediente, estadoSla as "ROJO" | "AMARILLO",
    ]));
    expect(calcularConteosSla(terminales, estados)).toEqual({ TOTAL: 3, VERDE: 0, AMARILLO: 0, ROJO: 0 });
    expect(terminales.every(({ estadoActual, estadoSla }) =>
      resolverEstadoSla(estadoActual, { fechaLimite: "2020-01-01", estado: estadoSla as "ROJO" | "AMARILLO" }) === null,
    )).toBe(true);
  });

  it.each([null, "", "fecha-inválida"])("ignora de forma segura una fecha límite no válida (%s)", fechaLimite => {
    expect(() => resolverEstadoSla("EN_REVISION", { fechaLimite, estado: "ROJO" })).not.toThrow();
    expect(resolverEstadoSla("EN_REVISION", { fechaLimite, estado: "ROJO" })).toBeNull();
  });

  it("mantiene encabezados y BOM con lista vacía", () => {
    expect(generarCsvExpedientes([])).toBe('\uFEFF"CUT","Asunto","Estado","Área actual","Radicación"');
    expect(calcularConteosSla([], new Map())).toEqual({ TOTAL: 0, VERDE: 0, AMARILLO: 0, ROJO: 0 });
  });
});
