import { describe, expect, it } from "vitest";

import { TRAMITES_TUPA_MOCK } from "../../mocks/tramitesTupaMock";

describe("catálogo TUPA del asistente de trámites", () => {
  it("incluye los 48 procedimientos del TUPA 2026 y el trámite libre", () => {
    const procedimientosTupa = TRAMITES_TUPA_MOCK.filter(
      (tramite) => tramite.esTupa,
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
});