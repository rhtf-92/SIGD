import { describe, expect, it } from "vitest";

import { TRAMITES_TUPA_MOCK } from "../../mocks/tramitesTupaMock";
import {
  SERVICIOS_PRODUCTIVOS_PLANOS,
  TOTAL_SERVICIOS_PRODUCTIVOS,
} from "../../data/tupaSuiza2026";

describe("catálogo TUPA del asistente de trámites", () => {
  it("incluye los 48 procedimientos académicos del TUPA 2026 y el trámite libre", () => {
    const procedimientosTupa = TRAMITES_TUPA_MOCK.filter(
      (tramite) => tramite.esTupa && !tramite.id.includes("PP-"),
    );

    expect(procedimientosTupa).toHaveLength(48);
    expect(procedimientosTupa.map((tramite) => tramite.codigo)).toEqual(
      Array.from({ length: 48 }, (_, index) =>
        String(index + 1).padStart(2, "0"),
      ),
    );
    expect(TRAMITES_TUPA_MOCK.at(-1)?.id).toBe("LIBRE");
  });

  it("conserva el plazo, las tasas variables y las tarifas detalladas", () => {
    expect(TRAMITES_TUPA_MOCK[1]?.tiempoMaximo).toBe("Cronograma");
    expect(TRAMITES_TUPA_MOCK[1]?.derechoPago).toContain("S/. 25.00");
    expect(TRAMITES_TUPA_MOCK[46]?.descripcion).toContain(
      "Curación pequeña: S/. 10.00",
    );
    expect(TRAMITES_TUPA_MOCK[47]?.descripcion).toContain(
      "Alquiler Sala de Licenciamiento: S/. 300.00 / día",
    );
  });

  it("incorpora los servicios productivos del docente (IESTP Suiza 2026)", () => {
    expect(TOTAL_SERVICIOS_PRODUCTIVOS).toBe(33);
    expect(SERVICIOS_PRODUCTIVOS_PLANOS).toHaveLength(33);

    const productivos = TRAMITES_TUPA_MOCK.filter((tramite) =>
      tramite.id.includes("PP-"),
    );
    expect(productivos).toHaveLength(33);
    expect(productivos.map((tramite) => tramite.codigo)).toEqual(
      Array.from(
        { length: 33 },
        (_, index) => `PP-${String(index + 1).padStart(2, "0")}`,
      ),
    );

    const practicas = productivos.find((t) => t.codigo === "PP-01");
    expect(practicas?.nombre).toContain("Prácticas Iniciales");
    expect(practicas?.derechoPago).toContain("35.00");

    const empadre = productivos.find((t) => t.codigo === "PP-33");
    expect(empadre?.nombre).toContain("Empadre");

    // El trámite libre sigue siendo el último del catálogo unificado
    expect(TRAMITES_TUPA_MOCK.at(-1)?.id).toBe("LIBRE");
    expect(TRAMITES_TUPA_MOCK).toHaveLength(48 + 33 + 1);
  });
});
