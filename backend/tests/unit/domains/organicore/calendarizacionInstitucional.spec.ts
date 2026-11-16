import { describe, expect, it } from 'vitest';
import {
  calendarizacionInstitucional2026,
  listarPorAnio,
  listarPorRango,
  listarTodas,
  obtenerContextoTupa,
  obtenerPorNumero,
} from '../../../../src/domains/organicore/calendarizacion.service.js';

describe('Calendarización Institucional 2026', () => {
  it('contiene exactamente 23 actividades oficiales en orden, con numeración única y consecutiva', () => {
    const actividades = listarTodas();
    expect(actividades).toHaveLength(23);
    expect(actividades.map(({ numero }) => numero)).toEqual(
      Array.from({ length: 23 }, (_, indice) => indice + 1),
    );
    expect(actividades.every(({ anio }) => anio === 2026)).toBe(true);
    expect(actividades.every(({ fuente, seccionFuente }) =>
      fuente === 'Calendarización Institucional 2026' && seccionFuente === '7.2',
    )).toBe(true);
  });

  it('conserva nombres y fechas documentales de las actividades representativas y de un solo día', () => {
    expect(listarTodas().map(({ fechaInicio, fechaFin }) => [fechaInicio, fechaFin])).toEqual([
      ['2026-03-03', '2026-03-31'],
      ['2026-03-16', '2026-04-30'],
      ['2026-04-06', '2026-04-30'],
      ['2026-05-04', '2026-05-29'],
      ['2026-04-06', '2026-04-06'],
      ['2026-05-15', '2026-05-15'],
      ['2026-04-06', '2026-08-05'],
      ['2026-08-07', '2026-08-07'],
      ['2026-08-10', '2026-08-31'],
      ['2026-08-10', '2026-08-12'],
      ['2026-08-14', '2026-08-14'],
      ['2026-08-17', '2026-09-11'],
      ['2026-09-14', '2026-10-09'],
      ['2026-08-17', '2026-08-17'],
      ['2026-09-30', '2026-09-30'],
      ['2026-09-16', '2026-09-18'],
      ['2026-08-17', '2026-12-11'],
      ['2026-12-18', '2026-12-18'],
      ['2026-12-18', '2026-12-31'],
      ['2026-12-21', '2026-12-22'],
      ['2026-12-28', '2026-12-28'],
      ['2026-12-28', '2026-12-28'],
      ['2026-12-28', '2026-12-30'],
    ]);
    expect(listarTodas().map(({ nombre }) => nombre)).toEqual([
      'Reincorporación, Traslados Internos y Externos',
      'Matrícula del III - V ciclo',
      'Matrícula del I ciclo (ingresantes)',
      'Matrícula Extemporánea 2026-I con 10% de recargo',
      'Inicio de Clases Semestre Académico 2026-I (I-III-V)',
      'Entrega de Registros de Matrícula 2026-I (físico y virtual)',
      'Evaluación Extraordinaria 2026-I',
      'Término del Semestre Académico 2026-I (I-III-V)',
      'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
      'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-I',
      'Entrega de Actas de Evaluación 2026-I',
      'Matrícula Semestre Académico 2026-II',
      'Matrícula Extemporánea 2026-II con 10% de recargo',
      'Inicio de Clases Semestre Académico 2026-II (II-IV-VI)',
      'Entrega de Registros de Matrícula 2026-II (físico y virtual)',
      'Semana Técnica',
      'Evaluación Extraordinaria 2026-II',
      'Término del Semestre Académico 2026-II',
      'Sustentación de Trabajo de Aplicación Profesional y/o Examen de Suficiencia Profesional',
      'Ingreso de notas finales en el Sistema Registra - MINEDU 2026-II',
      'Entrega de Actas de Evaluación 2026-II',
      'Clausura del Año Académico 2026',
      'Registro de Egresados en el Sistema Conecta - MINEDU.',
    ]);
    expect(obtenerPorNumero(1)).toMatchObject({
      nombre: 'Reincorporación, Traslados Internos y Externos',
      fechaInicio: '2026-03-03',
      fechaFin: '2026-03-31',
    });
    expect(obtenerPorNumero(16)).toMatchObject({
      nombre: 'Semana Técnica',
      fechaInicio: '2026-09-16',
      fechaFin: '2026-09-18',
    });
    expect(obtenerPorNumero(5)?.fechaInicio).toBe(obtenerPorNumero(5)?.fechaFin);
    expect(obtenerPorNumero(6)?.fechaInicio).toBe(obtenerPorNumero(6)?.fechaFin);
    expect(obtenerPorNumero(10)?.fechaInicio).not.toBe(obtenerPorNumero(10)?.fechaFin);
    expect(obtenerPorNumero(23)?.nombre).toBe('Registro de Egresados en el Sistema Conecta - MINEDU.');
    for (const item of listarTodas()) {
      if (item.fechaInicio === item.fechaFin) {
        expect(item.fechaInicio).toBe(item.fechaFin);
      }
    }
  });

  it('filtra por año y devuelve un arreglo vacío para años sin actividades', () => {
    expect(listarPorAnio(2026)).toHaveLength(23);
    expect(listarPorAnio(2027)).toEqual([]);
    expect(() => listarPorAnio(2026.5)).toThrow(RangeError);
  });

  it('busca por número y devuelve null cuando no existe', () => {
    expect(obtenerPorNumero(1)?.numero).toBe(1);
    expect(obtenerPorNumero(24)).toBeNull();
    expect(obtenerPorNumero(0)).toBeNull();
  });

  it('encuentra intervalos superpuestos e incluye las fechas límite', () => {
    expect(listarPorRango('2026-03-31', '2026-03-31').map(({ numero }) => numero)).toContain(1);
    expect(listarPorRango('2026-09-18', '2026-09-18').map(({ numero }) => numero)).toContain(16);
    expect(listarPorRango('2026-04-06', '2026-04-06').map(({ numero }) => numero)).toEqual(
      expect.arrayContaining([3, 5, 7]),
    );
    expect(listarPorRango('2025-01-01', '2025-12-31')).toEqual([]);
  });

  it.each([
    ['', '2026-01-01'],
    ['2026-2-01', '2026-02-28'],
    ['2026-02-30', '2026-03-01'],
    ['0000-01-01', '0000-12-31'],
  ])('rechaza rangos con fecha inicial inválida (%s)', (inicio, fin) => {
    expect(() => listarPorRango(inicio, fin)).toThrow(RangeError);
  });

  it('rechaza una fecha final inválida y un rango invertido', () => {
    expect(() => listarPorRango('2026-01-01', '2026-13-01')).toThrow(RangeError);
    expect(() => listarPorRango('2026-12-31', '2026-01-01')).toThrow(RangeError);
  });

  it('provee solo contexto TUPA informativo para traslados verificados', () => {
    const esperado = {
      tipo: 'INFORMATIVO',
      actividad: 'Reincorporación, Traslados Internos y Externos',
      fechaInicio: '2026-03-03',
      fechaFin: '2026-03-31',
    };
    expect(obtenerContextoTupa('p5-fila-20')).toEqual(esperado);
    expect(obtenerContextoTupa('p5-fila-21')).toEqual(esperado);
    expect(obtenerContextoTupa('p5-fila-22')).toBeNull();
    expect(obtenerContextoTupa('')).toBeNull();
  });

  it('expone resultados y catálogo congelados sin campos de SLA ni feriados', () => {
    const actividades = listarTodas();
    const primera = actividades[0];
    expect(Object.isFrozen(calendarizacionInstitucional2026)).toBe(true);
    expect(Object.isFrozen(actividades)).toBe(true);
    expect(Object.isFrozen(primera)).toBe(true);
    expect(Reflect.set(primera, 'nombre', 'alterado')).toBe(false);
    expect(Reflect.set(actividades, '0', primera)).toBe(false);
    expect(actividades[0].nombre).toBe('Reincorporación, Traslados Internos y Externos');
    for (const item of actividades) {
      expect(item).not.toHaveProperty('afectaSla');
      expect(item).not.toHaveProperty('esInhabil');
      expect(item).not.toHaveProperty('feriado');
      expect(item).not.toHaveProperty('diaNoLaborable');
    }
  });

  it('es una consulta pura sin dependencias de servicios externos', () => {
    const antes = listarTodas();
    listarPorAnio(2026);
    listarPorRango('2026-03-03', '2026-03-31');
    obtenerPorNumero(23);
    obtenerContextoTupa('p5-fila-20');
    expect(listarTodas()).toEqual(antes);
  });
});
