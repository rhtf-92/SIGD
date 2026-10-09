/**
 * Suite de regresión — Cálculo de días hábiles (LPAG N° 27444).
 * Integrante: Carlos Alexis Perea Saldaña (F_PEREA).
 *
 * Objetivo: cubrir `src/utils/diasHabiles.ts` (esDiaHabil, diasHabilesEntre,
 * clasificarPermanencia), aislado de UI, sin backend.
 *
 * Casos que probamos:
 *   1. Lunes–viernes hábiles; sábado y domingo no hábiles.
 *   2. Feriados fijos (Navidad 25/12, Fiestas Patrias 28/07 y 29/07) marcados como no hábiles.
 *   3. Feriados extra en formato YYYY-MM-DD son respetados (configurables).
 *   4. Conteo incremental: fin <= inicio → 0; rango fin exclusivo sobre fecha límite; cuenta solo hábiles.
 *   5. Clasificación semáforo: EN_PLAZO, POR_VENCER, VENCIDA; caso slaDias<=0 → EN_PLAZO.
 *
 * NOTA: entregada creada; NO ejecutada (sin node_modules en frontend).
 */
import { describe, it, expect } from "vitest";

import {
  esDiaHabil,
  diasHabilesEntre,
  clasificarPermanencia,
} from "../../../src/utils/diasHabiles";

describe("diasHabiles — regresión normativa LPAG 27444", () => {
  describe("esDiaHabil", () => {
    it("Lunes–Viernes son hábiles; Sábado y Domingo no hábiles", () => {
      expect(esDiaHabil(new Date("2026-09-07T12:00:00"))) // Lun
        .toBe(true);
      expect(esDiaHabil(new Date("2026-09-08T12:00:00"))) // Mar
        .toBe(true);
      expect(esDiaHabil(new Date("2026-09-09T12:00:00"))) // Mié
        .toBe(true);
      expect(esDiaHabil(new Date("2026-09-10T12:00:00"))) // Jue
        .toBe(true);
      expect(esDiaHabil(new Date("2026-09-11T12:00:00"))) // Vie
        .toBe(true);
      expect(esDiaHabil(new Date("2026-09-12T12:00:00"))) // Sáb
        .toBe(false);
      expect(esDiaHabil(new Date("2026-09-13T12:00:00"))) // Dom
        .toBe(false);
    });

    it("feriados fijos: Navidad y Fiestas Patrias no son hábiles", () => {
      expect(esDiaHabil(new Date("2026-12-25T12:00:00"))).toBe(false);
      expect(esDiaHabil(new Date("2026-07-28T12:00:00"))).toBe(false);
      expect(esDiaHabil(new Date("2026-07-29T12:00:00"))).toBe(false);
    });

    it("feriados extra (YYYY-MM-DD) son respetados", () => {
      const fecha = new Date("2026-10-13T12:00:00"); // ejemplo emblemático
      expect(esDiaHabil(fecha, ["2026-10-13"])).toBe(false);
      expect(esDiaHabil(fecha, [])).toBe(true);
    });
  });

  describe("diasHabilesEntre", () => {
    it("devuelve 0 si inicio inválido o fin < inicio", () => {
      expect(diasHabilesEntre(undefined)).toBe(0);
      expect(diasHabilesEntre("2026-09-10", "2026-09-09")).toBe(0);
      expect(diasHabilesEntre("fecha-invalida", "2026-09-09")).toBe(0);
    });

    it("cuenta solo días hábiles entre fecha de inicio y fin (fin exclusivo)", () => {
      // Lun 2026-09-07 → Lun 2026-09-14: transcurridos 5 hábiles (Mar–Vie + Lun siguiente no cuenta si límite es 14 y cursor < limite)
      expect(
        diasHabilesEntre("2026-09-07T08:00:00-05:00", "2026-09-14T08:00:00-05:00"),
      ).toBe(5);
    });

    it("cuenta correctamente en un rango contiguo (lunes a viernes)", () => {
      expect(diasHabilesEntre("2026-09-07", "2026-09-12")).toBe(5); // Lun→Mar→Mié→Jue→Vie = 5
    });

    it("no cuenta sábado/domingo dentro del intervalo", () => {
      expect(diasHabilesEntre("2026-09-11", "2026-09-14")).toBe(1); // Viernes → siguiente hábil es Lunes; rango hasta 14 incluye Sáb/Dom
    });
  });

  describe("clasificarPermanencia", () => {
    it("clasifica correctamente: EN_PLAZO (<60%), POR_VENCER (>=60% y <=100%), VENCIDA (>100%)", () => {
      expect(clasificarPermanencia(0, 10)).toBe("EN_PLAZO");
      expect(clasificarPermanencia(5, 10)).toBe("EN_PLAZO"); // 0.5
      expect(clasificarPermanencia(6, 10)).toBe("POR_VENCER"); // 0.6
      expect(clasificarPermanencia(10, 10)).toBe("POR_VENCER"); // 1.0
      expect(clasificarPermanencia(11, 10)).toBe("VENCIDA"); // >1.0
    });

    it("slaDias <= 0 retorna EN_PLAZO", () => {
      expect(clasificarPermanencia(100, 0)).toBe("EN_PLAZO");
      expect(clasificarPermanencia(100, -5)).toBe("EN_PLAZO");
    });
  });
});
