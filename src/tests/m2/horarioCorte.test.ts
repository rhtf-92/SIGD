import { describe, expect, it } from "vitest";

import { calculateHorarioCorte } from "../../hooks/useHorarioCorte";

describe("horarioCorte", () => {
  it("mantiene el mismo día antes de las 16:30", () => {
    const result = calculateHorarioCorte(new Date("2026-09-08T16:29:00-05:00"));

    expect(result.isAfterCutoff).toBe(false);
    expect(result.requiresProjection).toBe(false);
    expect(result.legalDate).toBe("2026-09-08");
  });

  it("activa corte a las 16:30", () => {
    const result = calculateHorarioCorte(new Date("2026-09-08T16:30:00-05:00"));

    expect(result.isAfterCutoff).toBe(true);
    expect(result.requiresProjection).toBe(true);
    expect(result.legalTimestamp).toBe("2026-09-09T08:00:00-05:00");
  });

  it("activa corte después de las 16:30", () => {
    const result = calculateHorarioCorte(new Date("2026-09-08T16:31:00-05:00"));

    expect(result.isAfterCutoff).toBe(true);
    expect(result.requiresProjection).toBe(true);
  });

  it("proyecta al siguiente día hábil si es día inhábil", () => {
    const result = calculateHorarioCorte(
      new Date("2026-07-29T10:00:00-05:00"),
      ["2026-07-29"],
    );

    expect(result.isNonBusinessDay).toBe(true);
    expect(result.requiresProjection).toBe(true);
    expect(result.legalDate).toBe("2026-07-30");
    expect(result.legalTimestamp).toBe("2026-07-30T08:00:00-05:00");
  });

  it("proyecta a las 08:00 del primer día hábil siguiente", () => {
    const result = calculateHorarioCorte(new Date("2026-07-28T18:00:00-05:00"));

    expect(result.legalTimestamp).toBe("2026-07-29T08:00:00-05:00");
  });
});
