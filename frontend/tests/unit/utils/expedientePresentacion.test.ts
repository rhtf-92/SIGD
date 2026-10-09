/**
 * Suite de regresión — Transformaciones de presentación de expedientes.
 * Integrante: Carlos Alexis Perea Saldaña (F_PEREA).
 *
 * Cubre comportamientos puros (sin backend) de `src/utils/expedientePresentacion.ts`
 * que hasta ahora no tenían cobertura directa:
 *   1. Etiquetado legible de dominios/áreas internas con fallback tolerante.
 *   2. Formateo de fechas y fecha-hora canónicas en zona horaria America/Lima.
 *   3. Cómputo relativo de plazo (vencido / restante / borde / inválido).
 *
 * NOTA: estos casos se entregan creados pero NO ejecutados en este entorno
 * (no existe frontend/node_modules y el brief prohíbe instalar paquetes).
 */
import { describe, it, expect } from "vitest";

import {
  etiquetaExpediente,
  fechaExpediente,
  plazoExpediente,
} from "../../../src/utils/expedientePresentacion";

describe("expedientePresentacion — regresión de etiquetas, fechas y plazos", () => {
  describe("etiquetaExpediente", () => {
    it("traduce códigos de dominio catalogados a etiquetas institucionales", () => {
      expect(etiquetaExpediente("IESTP_SUIZA")).toBe("IESTP Suiza");
      expect(etiquetaExpediente("TITULACION_PROFESIONAL")).toBe(
        "Titulación Profesional",
      );
      expect(etiquetaExpediente("MESA_DE_PARTES_VIRTUAL")).toBe(
        "Mesa de Partes Virtual",
      );
      expect(etiquetaExpediente("MUY_URGENTE")).toBe("Muy urgente");
    });

    it("aporta un fallback legible (capitaliza y separa guiones bajos) para códigos desconocidos", () => {
      expect(etiquetaExpediente("AREA_DESCONOCIDA")).toBe("Area desconocida");
      expect(etiquetaExpediente("nueva_area")).toBe("Nueva area");
    });
  });

  describe("fechaExpediente", () => {
    it("formatea solo la fecha legal en formato dd/mm/yyyy (America/Lima)", () => {
      expect(fechaExpediente("2026-09-05T11:42:15-05:00")).toBe("05/09/2026");
    });

    it("incluye hora y minuto en modo fecha-hora con ciclo horario 24h", () => {
      expect(fechaExpediente("2026-09-05T11:42:15-05:00", true)).toBe(
        "05/09/2026, 11:42",
      );
    });

    it("degrada a un mensaje seguro ante fechas no parseables", () => {
      expect(fechaExpediente("fecha-invalida")).toBe("Fecha no disponible");
    });
  });

  describe("plazoExpediente", () => {
    const ahora = new Date("2026-09-05T00:00:00-05:00").getTime();

    it("reporta días restantes cuando el plazo aún no vence", () => {
      expect(plazoExpediente("2026-09-08T00:00:00-05:00", ahora)).toBe(
        "3 días restantes",
      );
    });

    it("usa el singular cuando resta exactamente un día", () => {
      expect(plazoExpediente("2026-09-06T00:00:00-05:00", ahora)).toBe(
        "1 día restante",
      );
    });

    it("indica 'Vence ahora' cuando el límite coincide con el instante evaluado", () => {
      expect(plazoExpediente("2026-09-05T00:00:00-05:00", ahora)).toBe(
        "Vence ahora",
      );
    });

    it("reporta vencimiento en singular y plural según los días transcurridos", () => {
      expect(plazoExpediente("2026-09-04T00:00:00-05:00", ahora)).toBe(
        "Vencido hace 1 día",
      );
      expect(plazoExpediente("2026-09-03T00:00:00-05:00", ahora)).toBe(
        "Vencido hace 2 días",
      );
    });

    it("degrada a un mensaje seguro ante un límite inválido", () => {
      expect(plazoExpediente("limite-invalido", ahora)).toBe(
        "Plazo no disponible",
      );
    });
  });
});
