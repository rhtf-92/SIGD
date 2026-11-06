import { describe, expect, it } from "vitest";
import { compararTramites } from "./tupaComparator";
import type { TupaTramite } from "./tupaApi";

function hacerTramite(codigo: string, plazo: string): TupaTramite {
  return {
    tramite_version_id: codigo,
    codigo,
    denominacion: `Trámite ${codigo}`,
    rubro: "Rubro",
    descripcion: null,
    derecho_monto: 10,
    derecho_porcentaje_uit: 1,
    derecho_texto: null,
    cuenta_pago: null,
    plazo_texto: plazo,
    plazo_dias_habiles: null,
    calificacion: "Evaluación",
    silencio_administrativo: "No aplica",
    unidad_recibe: null,
    autoridad_resuelve: "Dirección",
    recursos: null,
    base_legal: null,
    observaciones: null,
    requisitos: [],
  };
}

describe("compararTramites", () => {
  it("identifica trámites agregados, retirados y campos modificados", () => {
    const diferencias = compararTramites(
      [hacerTramite("A", "5 días"), hacerTramite("B", "10 días")],
      [hacerTramite("A", "8 días"), hacerTramite("C", "15 días")],
    );

    expect(diferencias.map(({ tipo, codigo }) => [tipo, codigo])).toEqual([
      ["Modificado", "A"],
      ["Nuevo", "C"],
      ["Retirado", "B"],
    ]);
    expect(diferencias[0].cambios).toContainEqual({
      campo: "Plazo",
      antes: "5 días",
      despues: "8 días",
    });
  });
});
