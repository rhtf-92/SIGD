import { describe, expect, it } from "vitest";
import type { Resumen } from "../../../../src/pages/expedientes/rutadoc/rutadoc.dto";
import { calcularConteosSla, generarCsvExpedientes } from "../../../../src/pages/expedientes/rutadoc/rutadoc.summary";

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

  it("mantiene encabezados y BOM con lista vacía", () => {
    expect(generarCsvExpedientes([])).toBe('\uFEFF"CUT","Asunto","Estado","Área actual","Radicación"');
    expect(calcularConteosSla([], new Map())).toEqual({ TOTAL: 0, VERDE: 0, AMARILLO: 0, ROJO: 0 });
  });
});
