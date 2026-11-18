import { describe, expect, it } from "vitest";

import { PROCEDIMIENTOS_TUPA_2026 } from "../../data/tupaSuiza2026";
import { TRAMITES_TUPA_MOCK } from "../../mocks/tramitesTupaMock";

describe("catálogo TUPA del asistente de trámites", () => {
  const procedimientosTupa = TRAMITES_TUPA_MOCK.filter(
    (tramite) => tramite.esTupa,
  );

  it("incluye los 75 conceptos Suiza 2026 con identificadores técnicos únicos", () => {
    const codigos = PROCEDIMIENTOS_TUPA_2026.map(
      (procedimiento) => procedimiento.codigo,
    );

    expect(PROCEDIMIENTOS_TUPA_2026).toHaveLength(75);
    expect(codigos.every((codigo) => /^SUZ26-\d{3}$/.test(codigo))).toBe(true);
    expect(new Set(codigos).size).toBe(75);
    expect(codigos[0]).toBe("SUZ26-001");
    expect(codigos.at(-1)).toBe("SUZ26-075");
    expect(procedimientosTupa).toHaveLength(PROCEDIMIENTOS_TUPA_2026.length);
    expect(TRAMITES_TUPA_MOCK.at(-1)?.id).toBe("LIBRE");
    expect(
      /pasco/i.test(JSON.stringify(PROCEDIMIENTOS_TUPA_2026)),
    ).toBe(false);
  });

  it("conserva conceptos, tarifas y variantes documentadas de Suiza", () => {
    const porCodigo = new Map(
      PROCEDIMIENTOS_TUPA_2026.map((procedimiento) => [
        procedimiento.codigo,
        procedimiento,
      ]),
    );

    expect(porCodigo.get("SUZ26-001")?.nombre).toBe("Prácticas Iniciales");
    expect(porCodigo.get("SUZ26-001")?.derechoPago).toContain("S/ 35.00");
    expect(porCodigo.get("SUZ26-010")?.detalleTarifas?.join(" ")).toContain(
      "Cambio de carrera (antes del I Simulacro): S/ 10.00",
    );
    expect(porCodigo.get("SUZ26-025")?.derechoPago).toContain("S/ 50.00");
    expect(porCodigo.get("SUZ26-025")?.derechoPago).toContain("S/ 55.00");
    expect(porCodigo.get("SUZ26-025")?.detalleTarifas?.join(" ")).toContain(
      "no se determina su relación o variante",
    );
    expect(porCodigo.get("SUZ26-034")?.nombre).toBe("Expedición de Título");
    expect(porCodigo.get("SUZ26-034")?.derechoPago).toContain("S/ 105.00");
    expect(porCodigo.get("SUZ26-066")?.derechoPago).toContain("S/ 412.00");
    expect(
      procedimientosTupa.some((tramite) =>
        /917\.50/.test(`${tramite.nombre} ${tramite.derechoPago ?? ""}`),
      ),
    ).toBe(false);
  });

  it("mantiene la compatibilidad de los identificadores derivados por el mock", () => {
    for (const tramite of procedimientosTupa) {
      expect(tramite.id).toBe(`TUPA-${tramite.codigo}`);
      expect(typeof tramite.codigo).toBe("string");
      expect(tramite.nombre.length).toBeGreaterThan(0);
      expect(typeof tramite.descripcion).toBe("string");
    }

    expect(TRAMITES_TUPA_MOCK.at(-1)).toMatchObject({
      id: "LIBRE",
      codigo: "LIBRE",
      esTupa: false,
    });
  });
});
