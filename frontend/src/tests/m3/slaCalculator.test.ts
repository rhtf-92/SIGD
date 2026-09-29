import { describe, it, expect } from "vitest";
import {
  isBusinessDay,
  countBusinessDays,
  addBusinessDays,
  calculateSlaStatus,
  type CalendarioLaboral,
} from "../../utils/slaCalculator";
import {
  calendarioLaboral2026,
  feriadoExcepcional,
} from "../../test/calendarioLaboralFixtures";

/**
 * El calendario se inyecta como parámetro: ya no hay feriados escritos en el
 * código (T-BE-OC-13). Estas pruebas fijan la MISMA semántica que antesaba
 * cuando la lista estaba hardcodeada, para demostrar que el cálculo de días
 * hábiles no cambió: sólo cambió la fuente de los feriados.
 */
const CALENDARIO = calendarioLaboral2026();

describe("Suite de Pruebas Unitarias de SLA y Días Hábiles LPAG Ley 27444 (ENT-M03-02)", () => {
  describe("isBusinessDay - Detección de Fines de Semana y Feriados", () => {
    it("identifica sábados y domingos como días NO laborables", () => {
      // 2026-06-06 es Sábado, 2026-06-07 es Domingo (además Batalla de Arica)
      const sabado = new Date(2026, 5, 6);
      const domingo = new Date(2026, 5, 7);

      expect(isBusinessDay(sabado, CALENDARIO)).toBe(false);
      expect(isBusinessDay(domingo, CALENDARIO)).toBe(false);
    });

    it("identifica días de semana ordinarios como días laborables", () => {
      // 2026-06-10 es Miércoles laborable
      const miercoles = new Date(2026, 5, 10);
      expect(isBusinessDay(miercoles, CALENDARIO)).toBe(true);
    });

    it("excluye feriados nacionales oficiales peruanos (D. Leg. N° 713)", () => {
      // 2026-05-01 es Viernes (Día del Trabajo)
      const diaTrabajo = new Date(2026, 4, 1);
      // 2026-07-28 es Martes (Fiestas Patrias)
      const fiestasPatrias = new Date(2026, 6, 28);
      // 2026-12-25 es Viernes (Navidad)
      const navidad = new Date(2026, 11, 25);

      expect(isBusinessDay(diaTrabajo, CALENDARIO)).toBe(false);
      expect(isBusinessDay(fiestasPatrias, CALENDARIO)).toBe(false);
      expect(isBusinessDay(navidad, CALENDARIO)).toBe(false);
    });

    it("excluye feriados regionales emblemáticos de Ucayali", () => {
      // 2026-06-24 es Miércoles (Fiesta Patronal de San Juan Bautista en Ucayali)
      const sanJuan = new Date(2026, 5, 24);
      // 2026-10-13 es Martes (Aniversario de Coronel Portillo / Pucallpa)
      const aniversarioPucallpa = new Date(2026, 9, 13);

      expect(isBusinessDay(sanJuan, CALENDARIO)).toBe(false);
      expect(isBusinessDay(aniversarioPucallpa, CALENDARIO)).toBe(false);
    });
  });

  describe("countBusinessDays - Conteo de Días Hábiles", () => {
    it("retorna 0 si la fecha inicio y fin son el mismo día", () => {
      const fecha = new Date(2026, 5, 1);
      expect(countBusinessDays(fecha, fecha, CALENDARIO)).toBe(0);
    });

    it("cuenta exactamente 5 días hábiles de lunes a viernes en una semana sin feriados", () => {
      // Lunes 2026-06-08 a Lunes 2026-06-15 (5 días hábiles transcurridos: Mar, Mié, Jue, Vie, Lun)
      const lunes1 = new Date(2026, 5, 8);
      const lunes2 = new Date(2026, 5, 15);
      expect(countBusinessDays(lunes1, lunes2, CALENDARIO)).toBe(5);
    });

    it("descuenta el feriado de San Juan (24 de junio) durante esa semana", () => {
      // Lunes 2026-06-22 a Lunes 2026-06-29:
      // Días evaluados: Mar 23 (hábil), Mié 24 (San Juan feriado), Jue 25 (hábil), Vie 26 (hábil), Lun 29 (San Pedro feriado)
      // Días hábiles = 3
      const lunes22 = new Date(2026, 5, 22);
      const lunes29 = new Date(2026, 5, 29);
      expect(countBusinessDays(lunes22, lunes29, CALENDARIO)).toBe(3);
    });
  });

  describe("addBusinessDays - Proyección de Vencimiento Legal", () => {
    it("proyecta correctamente 30 días hábiles omitiendo fines de semana y feriados", () => {
      const inicio = new Date(2026, 0, 5); // Lunes 5 de Enero 2026
      const vencimiento = addBusinessDays(inicio, 30, CALENDARIO);

      // Verificamos que vencimiento sea posterior y que el conteo de días hábiles sea exactamente 30
      expect(vencimiento.getTime()).toBeGreaterThan(inicio.getTime());
      expect(countBusinessDays(inicio, vencimiento, CALENDARIO)).toBe(30);
    });
  });

  describe("calculateSlaStatus - Semáforo de 4 Estados Cromáticos", () => {
    it("estado NORMAL: expediente con 5 días hábiles transcurridos (quedan 25)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 5, CALENDARIO);

      const sla = calculateSlaStatus(inicio, hoy, 30, CALENDARIO);
      expect(sla.estado).toBe("NORMAL");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(5);
      expect(sla.diasHabilesRestantes).toBe(25);
      expect(sla.mensajeExplicativo).toContain("En plazo ordinario");
    });

    it("estado ALERTA: expediente con 20 días hábiles transcurridos (quedan 10)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 20, CALENDARIO);

      const sla = calculateSlaStatus(inicio, hoy, 30, CALENDARIO);
      expect(sla.estado).toBe("ALERTA");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(20);
      expect(sla.diasHabilesRestantes).toBe(10);
      expect(sla.mensajeExplicativo).toContain("Atención preventiva");
    });

    it("estado CRITICO: expediente con 28 días hábiles transcurridos (quedan 2)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 28, CALENDARIO);

      const sla = calculateSlaStatus(inicio, hoy, 30, CALENDARIO);
      expect(sla.estado).toBe("CRITICO");
      expect(sla.estaVencido).toBe(false);
      expect(sla.diasHabilesConsumidos).toBe(28);
      expect(sla.diasHabilesRestantes).toBe(2);
      expect(sla.mensajeExplicativo).toContain("Vencimiento inminente");
    });

    it("estado VENCIDO: expediente con 33 días hábiles transcurridos (excedido por 3)", () => {
      const inicio = new Date(2026, 5, 1);
      const hoy = addBusinessDays(inicio, 33, CALENDARIO);

      const sla = calculateSlaStatus(inicio, hoy, 30, CALENDARIO);
      expect(sla.estado).toBe("VENCIDO");
      expect(sla.estaVencido).toBe(true);
      expect(sla.diasHabilesConsumidos).toBe(33);
      expect(sla.diasHabilesRestantes).toBe(-3);
      expect(sla.mensajeExplicativo).toContain("Vencido hace 3 día(s) hábil(es)");
    });
  });

  // -------------------------------------------------------------------------
  // T-BE-OC-14: un feriado excepcional registrado en el backend debe alterar
  // el semáforo. Antes esto era imposible de expresar sin editar el código.
  // -------------------------------------------------------------------------
  describe("Feriado excepcional del calendario oficial (T-BE-OC-14)", () => {
    it("sin el feriado, el día es hábil y cuenta para el plazo", () => {
      // 2026-11-18 es miércoles
      const dia = new Date(2026, 10, 18);
      expect(isBusinessDay(dia, CALENDARIO)).toBe(true);
    });

    it("al registrar el feriado excepcional, el día deja de computar", () => {
      const conFeriado = calendarioLaboral2026([
        feriadoExcepcional("2026-11-18", "Feriado excepcional institucional"),
      ]);
      const dia = new Date(2026, 10, 18);

      expect(isBusinessDay(dia, conFeriado)).toBe(false);
    });

    it("retrasa la fecha de vencimiento del SLA del expediente", () => {
      const inicio = new Date(2026, 10, 16); // Lunes 16 de noviembre
      const referencia = new Date(2026, 10, 20); // Viernes 20 de noviembre

      const sinFeriado = calculateSlaStatus(inicio, referencia, 30, CALENDARIO);
      const conFeriado = calculateSlaStatus(
        inicio,
        referencia,
        30,
        calendarioLaboral2026([
          feriadoExcepcional("2026-11-18", "Feriado excepcional institucional"),
        ]),
      );

      // Lun 17, Mié 18, Jue 19, Vie 20 = 4 días hábiles sin feriado.
      expect(sinFeriado.diasHabilesConsumidos).toBe(4);
      expect(sinFeriado.diasHabilesRestantes).toBe(26);
      expect(sinFeriado.fechaVencimientoCalculada).toBe("2026-12-31");

      // Al declararse el 18 no laborable sólo quedan 3 días hábiles consumidos.
      expect(conFeriado.diasHabilesConsumidos).toBe(3);
      expect(conFeriado.diasHabilesRestantes).toBe(27);
      // El vencimiento se desplaza un día hábil porque el 18 no avanza el contador.
      expect(conFeriado.fechaVencimientoCalculada).toBe("2027-01-01");
    });

    it("un día habilitado por resolución recupera un fin de semana como hábil", () => {
      // 2026-11-21 es sábado; el backend lo registra con es_laborable = TRUE.
      const sabado = new Date(2026, 10, 21);
      expect(isBusinessDay(sabado, CALENDARIO)).toBe(false);

      const conHabilitacion = calendarioLaboral2026([
        {
          ...feriadoExcepcional("2026-11-21", "Sábado laborable por resolución"),
          es_laborable: true,
          tipo_feriado: null,
          base_legal: "Resolución Directoral N° 001-2026",
        },
      ]);

      expect(isBusinessDay(sabado, conHabilitacion)).toBe(true);
    });

    it("la habilitación prevalece sobre un feriado registrado el mismo día", () => {
      // Precedencia idéntica a sigd_org.es_dia_no_laborable del backend:
      // la habilitación expresa gana sobre el feriado.
      const ambiguo: CalendarioLaboral = {
        noLaborables: new Set(["2026-11-18"]),
        laborablesExcepcionales: new Set(["2026-11-18"]),
      };
      expect(isBusinessDay(new Date(2026, 10, 18), ambiguo)).toBe(true);
    });

    it("un calendario vacío equivale a lunes a viernes, sin feriados conocidos", () => {
      const vacio: CalendarioLaboral = {
        noLaborables: new Set(),
        laborablesExcepcionales: new Set(),
      };
      // 2026-01-01 es jueves: con calendario vacío sí computa.
      expect(isBusinessDay(new Date(2026, 0, 1), vacio)).toBe(true);
      // Pero el fin de semana sigue sin computar.
      expect(isBusinessDay(new Date(2026, 0, 3), vacio)).toBe(false);
    });
  });
});
