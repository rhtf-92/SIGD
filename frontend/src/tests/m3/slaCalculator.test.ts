import { describe, it, expect } from "vitest";
import {
  isBusinessDay,
  countBusinessDays,
  addBusinessDays,
  calculateSlaStatus,
} from "../../utils/slaCalculator";

describe("Suite de Pruebas Unitarias de SLA y Días Hábiles LPAG Ley 27444 (ENT-M03-02)", () => {
  describe("isBusinessDay - Detección de Fines de Semana y Feriados", () => {
    it("identifica sábados y domingos como días NO laborables", () => {
      // 2026-06-06 es Sábado, 2026-06-07 es Domingo (además Batalla de Arica)
      const sabado = new Date(2026, 5, 6);
      const domingo = new Date(2026, 5, 7);

      expect(isBusinessDay(sabado)).toBe(false);
      expect(isBusinessDay(domingo)).toBe(false);
    });

    it("identifica días de semana ordinarios como días laborables", () => {
      // 2026-06-10 es Miércoles laborable
      const miercoles = new Date(2026, 5, 10);
      expect(isBusinessDay(miercoles)).toBe(true);
    });

    it("excluye feriados nacionales oficiales peruanos (D. Leg. N° 713)", () => {
      // 2026-05-01 es Viernes (Día del Trabajo)
      const diaTrabajo = new Date(2026, 4, 1);
      // 2026-07-28 es Martes (Fiestas Patrias)
      const fiestasPatrias = new Date(2026, 6, 28);
      // 2026-12-25 es Viernes (Navidad)
      const navidad = new Date(2026, 11, 25);

      expect(isBusinessDay(diaTrabajo)).toBe(false);
      expect(isBusinessDay(fiestasPatrias)).toBe(false);
      expect(isBusinessDay(navidad)).toBe(false);
    });

    it("excluye feriados regionales emblemáticos de Ucayali", () => {
      // 2026-06-24 es Miércoles (Fiesta Patronal de San Juan Bautista en la Selva / Ucayali)
      const sanJuan = new Date(2026, 5, 24);
      // 2026-10-13 es Martes (Aniversario de Coronel Portillo / Pucallpa)
      const aniversarioPucallpa = new Date(2026, 9, 13);

      expect(isBusinessDay(sanJuan)).toBe(false);
      expect(isBusinessDay(aniversarioPucallpa)).toBe(false);
    });
  });

  describe("countBusinessDays - Conteo de Días Hábiles", () => {
    it("retorna 0 si la fecha inicio y fin son el mismo día", () => {
      const fecha = new Date(2026, 5, 1);
      expect(countBusinessDays(fecha, fecha)).toBe(0);
    });

    it("cuenta exactamente 5 días hábiles de lunes a viernes en una semana sin feriados", () => {
      // Lunes 2026-06-08 a Lunes 2026-06-15 (5 días hábiles transcurridos: Mar, Mié, Jue, Vie, Lun)
      const lunes1 = new Date(2026, 5, 8);
      const lunes2 = new Date(2026, 5, 15);
      expect(countBusinessDays(lunes1, lunes2)).toBe(5);
    });

    it("descuenta el feriado de San Juan (24 de junio) durante esa semana", () => {
      // Lunes 2026-06-22 a Lunes 2026-06-29:
      // Días evaluados: Mar 23 (hábil), Mié 24 (San Juan feriado), Jue 25 (hábil), Vie 26 (hábil), Lun 29 (San Pedro feriado)
      // Días hábiles = 3
      const lunes22 = new Date(2026, 5, 22);
      const lunes29 = new Date(2026, 5, 29);
      expect(countBusinessDays(lunes22, lunes29)).toBe(3);
    });
  });

  describe("addBusinessDays - Proyección de Vencimiento Legal", () => {
    it("proyecta correctamente 30 días hábiles omitiendo fines de semana y feriados", () => {
      const inicio = new Date(2026, 0, 5); // Lunes 5 de Enero 2026
      const vencimiento = addBusinessDays(inicio, 30);

      // Verificamos que vencimiento sea posterior y que el conteo de días hábiles sea exactamente 30
      expect(vencimiento.getTime()).toBeGreaterThan(inicio.getTime());
      expect(countBusinessDays(inicio, vencimiento)).toBe(30);
    });
  });

  describe("calculateSlaStatus - Semáforo de 4 Estados Cromáticos", () => {
    it("estado NORMAL: expediente con 5 días hábiles transcurridos (quedan 25)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 5);

      const sla = calculateSlaStatus(inicio, hoy, 30);
      expect(sla.estado).toBe("NORMAL");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(5);
      expect(sla.diasHabilesRestantes).toBe(25);
      expect(sla.mensajeExplicativo).toContain("En plazo ordinario");
    });

    it("estado ALERTA: expediente con 20 días hábiles transcurridos (quedan 10)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 20);

      const sla = calculateSlaStatus(inicio, hoy, 30);
      expect(sla.estado).toBe("ALERTA");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(20);
      expect(sla.diasHabilesRestantes).toBe(10);
      expect(sla.mensajeExplicativo).toContain("Atención preventiva");
    });

    it("estado CRITICO: expediente con 28 días hábiles transcurridos (quedan 2)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 28);

      const sla = calculateSlaStatus(inicio, hoy, 30);
      expect(sla.estado).toBe("CRITICO");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(28);
      expect(sla.diasHabilesRestantes).toBe(2);
      expect(sla.mensajeExplicativo).toContain("Vencimiento inminente");
    });

    it("estado VENCIDO: expediente con 33 días hábiles transcurridos (excedido por 3)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 33);

      const sla = calculateSlaStatus(inicio, hoy, 30);
      expect(sla.estado).toBe("VENCIDO");
      expect(sla.estaVencido).toBe(true);
      expect(sla.diasHabilesConsumidos).toBe(33);
      expect(sla.diasHabilesRestantes).toBe(-3);
      expect(sla.mensajeExplicativo).toContain("Vencido hace 3 día(s) hábil(es)");
    });
  });
});
