import { describe, expect, it } from "vitest";

import { PROCEDIMIENTOS_TUPA_2026 } from "../../data/tupaUcayali2026";
import { TRAMITES_TUPA_MOCK } from "../../mocks/tramitesTupaMock";

describe("catálogo TUPA del asistente de trámites", () => {
  it("incluye los conceptos del TUPA de Ucayali agrupados por sección y el trámite libre", () => {
    const procedimientosTupa = TRAMITES_TUPA_MOCK.filter(
      (tramite) => tramite.esTupa,
    );

    expect(procedimientosTupa).toHaveLength(77);
    expect(PROCEDIMIENTOS_TUPA_2026).toHaveLength(77);
    expect(
      PROCEDIMIENTOS_TUPA_2026.filter(
        (concepto) => concepto.seccion === "Servicios academicos",
      ),
    ).toHaveLength(44);
    expect(
      PROCEDIMIENTOS_TUPA_2026.filter(
        (concepto) => concepto.seccion === "Servicios productivos",
      ),
    ).toHaveLength(15);
    expect(
      PROCEDIMIENTOS_TUPA_2026.filter(
        (concepto) => concepto.seccion === "Venta de bienes",
      ),
    ).toHaveLength(18);
    expect(new Set(PROCEDIMIENTOS_TUPA_2026.map(({ codigo }) => codigo)).size).toBe(77);
    expect(TRAMITES_TUPA_MOCK.at(-1)?.id).toBe("LIBRE");
  });

  it("conserva los importes, los requisitos y las tarifas tal como aparecen en la fuente", () => {
    expect(PROCEDIMIENTOS_TUPA_2026[0]?.derechoPago).toContain("S/. 4.00");
    expect(PROCEDIMIENTOS_TUPA_2026[0]?.requisitos).toContain(
      "Comprobante de pago",
    );
    expect(PROCEDIMIENTOS_TUPA_2026.find(({ codigo }) => codigo === "ACA-39")?.derechoPago).toContain(
      "S/. 10.50",
    );
    expect(PROCEDIMIENTOS_TUPA_2026.find(({ codigo }) => codigo === "PRO-10")?.derechoPago).toBe(
      "S/. 400.00",
    );
    expect(PROCEDIMIENTOS_TUPA_2026.find(({ codigo }) => codigo === "BIE-11")?.detalleTarifas).toContain(
      "Pichones hembras: S/. 30.00",
    );
    expect(PROCEDIMIENTOS_TUPA_2026.find(({ codigo }) => codigo === "BIE-16")?.detalleTarifas).toContain(
      "Reproductor: S/. 25.00",
    );
  });
});