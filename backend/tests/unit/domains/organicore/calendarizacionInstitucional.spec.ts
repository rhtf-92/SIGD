import { describe, expect, it } from 'vitest';
import {
  CALENDARIZACION_INSTITUCIONAL_2026,
  FUENTE_CALENDARIZACION_INSTITUCIONAL_2026,
  CalendarizacionInstitucionalService,
  validarCatalogoCalendarizacion,
} from '../../../../src/domains/organicore/calendarizacion.service.js';

const REFERENCIAS_TUPA_TRASLADO = ['p5-fila-20', 'p5-fila-21'] as const;

describe('Calendarización Institucional 2026 de solo lectura', () => {
  const servicio = new CalendarizacionInstitucionalService();

  it('conserva exactamente las 23 actividades de la sección 7.2', () => {
    expect(CALENDARIZACION_INSTITUCIONAL_2026).toHaveLength(23);
    expect(servicio.listar()).toHaveLength(23);
  });

  it('conserva numeración única, correlativa y datos obligatorios', () => {
    const numeros = CALENDARIZACION_INSTITUCIONAL_2026.map((actividad) => actividad.numero);

    expect(new Set(numeros).size).toBe(23);
    expect(numeros).toEqual(Array.from({ length: 23 }, (_, indice) => indice + 1));
    for (const actividad of CALENDARIZACION_INSTITUCIONAL_2026) {
      expect(actividad.actividad.trim()).not.toBe('');
      expect(actividad.responsables.trim()).not.toBe('');
    }
  });

  it('valida fechas civiles y que el inicio no sea posterior al fin', () => {
    expect(() => validarCatalogoCalendarizacion(CALENDARIZACION_INSTITUCIONAL_2026)).not.toThrow();
    for (const actividad of CALENDARIZACION_INSTITUCIONAL_2026) {
      expect(actividad.fechaInicio).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(actividad.fechaFin).toMatch(/^2026-\d{2}-\d{2}$/);
      expect(actividad.fechaInicio <= actividad.fechaFin).toBe(true);
    }
  });

  it('declara la fuente como extracción documental, no como original institucional', () => {
    expect(FUENTE_CALENDARIZACION_INSTITUCIONAL_2026).toMatchObject({
      tipoFuente: 'EXTRACCION_DOCUMENTAL',
      referenciaSeccion: '7.2',
      anio: 2026,
    });
  });

  it('no incorpora propiedades que conviertan la agenda en calendario SLA', () => {
    for (const actividad of CALENDARIZACION_INSTITUCIONAL_2026) {
      expect(actividad).not.toHaveProperty('esInhabil');
      expect(actividad).not.toHaveProperty('afectaSla');
      expect(actividad).not.toHaveProperty('feriado');
    }
  });

  it('filtra por año y por solapamiento inclusivo de rango', () => {
    expect(servicio.listar({ anio: 2025 })).toEqual([]);
    expect(servicio.listar({ anio: 2026 })).toHaveLength(23);

    const marzo = servicio.listar({ desde: '2026-03-01', hasta: '2026-03-31' });
    expect(marzo.map((actividad) => actividad.numero)).toEqual([1, 2]);

    const fechaPuntual = servicio.listar({ desde: '2026-09-17', hasta: '2026-09-17' });
    expect(fechaPuntual.map((actividad) => actividad.numero)).toEqual([13, 16, 17]);
  });

  it('consulta una actividad por su número original', () => {
    expect(servicio.obtenerPorNumero(16)?.actividad).toBe('Semana Técnica');
    expect(servicio.obtenerPorNumero(99)).toBeNull();
  });

  it.each(REFERENCIAS_TUPA_TRASLADO)(
    'relaciona %s explícitamente con la ventana informativa de traslados',
    (referenciaFila) => {
      expect(servicio.obtenerContextoTupa(referenciaFila)).toEqual({
        tipo: 'INFORMATIVO',
        fechaInicio: '2026-03-03',
        fechaFin: '2026-03-31',
        actividad: 'Reincorporación, Traslados Internos y Externos',
      });
    },
  );

  it('no asocia automáticamente otros procedimientos TUPA', () => {
    for (const referencia of ['p5-fila-18', 'p5-fila-19', 'p4-fila-05', 'p4-fila-06']) {
      expect(servicio.obtenerContextoTupa(referencia)).toBeNull();
    }
  });

  it('expone solo operaciones de lectura y devuelve objetos inmutables', () => {
    expect(Object.isFrozen(CALENDARIZACION_INSTITUCIONAL_2026)).toBe(true);
    expect(CALENDARIZACION_INSTITUCIONAL_2026.every(Object.isFrozen)).toBe(true);
    expect(Object.getOwnPropertyNames(CalendarizacionInstitucionalService.prototype).sort()).toEqual([
      'constructor',
      'listar',
      'obtenerContextoTupa',
      'obtenerPorNumero',
    ]);
  });

  it('rechaza un catálogo incompleto antes de exponerlo', () => {
    expect(() => validarCatalogoCalendarizacion(CALENDARIZACION_INSTITUCIONAL_2026.slice(0, 22)))
      .toThrow('23 actividades');
  });
});
