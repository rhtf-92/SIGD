import { describe, expect, it } from 'vitest';
import { calcularSla } from '../../../../src/domains/rutadoc/sla.service.js';

const ISO = (date: Date) => date.toISOString().slice(0, 10);
function fechaTrasHabiles(inicio: string, cantidad: number, feriados = new Set<string>()): string {
  let cursor = Date.parse(`${inicio}T00:00:00.000Z`);
  let contados = 0;
  while (contados < cantidad) {
    cursor += 86_400_000;
    const fecha = ISO(new Date(cursor));
    const dia = new Date(cursor).getUTCDay();
    if (dia !== 0 && dia !== 6 && !feriados.has(fecha)) contados++;
  }
  return ISO(new Date(cursor));
}

describe('calcularSla: calendario civil UTC, sin feriados implícitos', () => {
  it('01 inicia un lunes normal y no cuenta la fecha inicial', () => {
    expect(calcularSla({ fechaInicio: '2026-09-28', fechaActual: '2026-09-29' }).diasHabilesTranscurridos).toBe(1);
  });
  it('02 excluye el fin de semana tras el viernes', () => {
    expect(calcularSla({ fechaInicio: '2026-09-25', fechaActual: '2026-09-28' }).diasHabilesTranscurridos).toBe(1);
  });
  it('03 no cuenta sábado', () => {
    expect(calcularSla({ fechaInicio: '2026-09-25', fechaActual: '2026-09-26' }).diasHabilesTranscurridos).toBe(0);
  });
  it('04 no cuenta domingo', () => {
    expect(calcularSla({ fechaInicio: '2026-09-25', fechaActual: '2026-09-27' }).diasHabilesTranscurridos).toBe(0);
  });
  it('05 excluye feriado entre semana configurado', () => {
    expect(calcularSla({ fechaInicio: '2026-09-28', fechaActual: '2026-09-30', diasNoLaborables: new Set(['2026-09-29']) }).diasHabilesTranscurridos).toBe(1);
  });
  it('06 excluye feriados consecutivos', () => {
    expect(calcularSla({ fechaInicio: '2026-09-28', fechaActual: '2026-10-01', diasNoLaborables: new Set(['2026-09-29', '2026-09-30']) }).diasHabilesTranscurridos).toBe(1);
  });
  it('07 día regional cuenta como no laborable solo si el calendario lo configura', () => {
    const fechaInicio = '2026-06-23';
    expect(calcularSla({ fechaInicio, fechaActual: '2026-06-25', diasNoLaborables: new Set(['2026-06-24']) }).diasHabilesTranscurridos).toBe(1);
  });
  it('08 un inicio durante feriado no se cuenta como día hábil', () => {
    expect(calcularSla({ fechaInicio: '2026-09-29', fechaActual: '2026-09-30', diasNoLaborables: new Set(['2026-09-29']) }).diasHabilesTranscurridos).toBe(1);
  });
  it('09 atraviesa el 24 de junio solo con marca del calendario', () => {
    expect(calcularSla({ fechaInicio: '2026-06-23', fechaActual: '2026-06-24' }).diasHabilesTranscurridos).toBe(1);
    expect(calcularSla({ fechaInicio: '2026-06-23', fechaActual: '2026-06-24', diasNoLaborables: new Set(['2026-06-24']) }).diasHabilesTranscurridos).toBe(0);
  });
  it('10 atraviesa el 13 de octubre si el calendario lo declara no laborable', () => {
    expect(calcularSla({ fechaInicio: '2026-10-12', fechaActual: '2026-10-13', diasNoLaborables: new Set(['2026-10-13']) }).diasHabilesTranscurridos).toBe(0);
  });
  it('11 maneja febrero de 28 días', () => {
    expect(calcularSla({ fechaInicio: '2025-02-27', fechaActual: '2025-03-03' }).diasHabilesTranscurridos).toBe(2);
  });
  it('12 maneja febrero bisiesto de 29 días', () => {
    expect(calcularSla({ fechaInicio: '2024-02-28', fechaActual: '2024-03-01' }).diasHabilesTranscurridos).toBe(2);
  });
  it('13 maneja meses de 30 días', () => {
    expect(calcularSla({ fechaInicio: '2026-04-29', fechaActual: '2026-05-01' }).diasHabilesTranscurridos).toBe(2);
  });
  it('14 maneja meses de 31 días', () => {
    expect(calcularSla({ fechaInicio: '2026-01-30', fechaActual: '2026-02-02' }).diasHabilesTranscurridos).toBe(1);
  });
  it('15 cruza el cambio de año', () => {
    expect(calcularSla({ fechaInicio: '2025-12-31', fechaActual: '2026-01-02' }).diasHabilesTranscurridos).toBe(2);
  });
  it('16 devuelve VERDE antes del umbral configurable amarillo', () => {
    const actual = fechaTrasHabiles('2026-01-05', 23);
    expect(calcularSla({ fechaInicio: '2026-01-05', fechaActual: actual }).estado).toBe('VERDE');
  });
  it('17 devuelve AMARILLO desde el 80% temporal documentado', () => {
    const actual = fechaTrasHabiles('2026-01-05', 24);
    expect(calcularSla({ fechaInicio: '2026-01-05', fechaActual: actual }).estado).toBe('AMARILLO');
  });
  it('18 a los 29 días hábiles no es ROJO', () => {
    const fechaActual = fechaTrasHabiles('2026-01-05', 29);
    const resultado = calcularSla({ fechaInicio: '2026-01-05', fechaActual });
    expect(resultado.diasHabilesTranscurridos).toBe(29);
    expect(resultado.estado).toBe('AMARILLO');
  });
  it('19 exactamente 30 días hábiles no es ROJO y no quedan días', () => {
    const fechaActual = fechaTrasHabiles('2026-01-05', 30);
    const resultado = calcularSla({ fechaInicio: '2026-01-05', fechaActual });
    expect(resultado.diasHabilesTranscurridos).toBe(30);
    expect(resultado.diasHabilesRestantes).toBe(0);
    expect(resultado.estado).toBe('AMARILLO');
  });
  it('20 exactamente 31 días hábiles es ROJO', () => {
    const fechaActual = fechaTrasHabiles('2026-01-05', 31);
    expect(calcularSla({ fechaInicio: '2026-01-05', fechaActual }).estado).toBe('ROJO');
  });
  it('21 más de 31 días permanece ROJO y conserva porcentaje mayor a 100', () => {
    const fechaActual = fechaTrasHabiles('2026-01-05', 35);
    const resultado = calcularSla({ fechaInicio: '2026-01-05', fechaActual });
    expect(resultado.estado).toBe('ROJO');
    expect(resultado.porcentaje).toBeGreaterThan(100);
  });
  it('22 fecha límite es el día hábil 30 y omite feriados configurados', () => {
    const feriados = new Set(['2026-01-06', '2026-01-07']);
    const resultado = calcularSla({ fechaInicio: '2026-01-05', fechaActual: '2026-01-05', diasNoLaborables: feriados });
    expect(resultado.fechaLimite).toBe(fechaTrasHabiles('2026-01-05', 30, feriados));
    expect(resultado.diasHabilesRestantes).toBe(30);
  });
  it('23 rechaza fechas no civiles y fechas de cálculo anteriores al inicio', () => {
    expect(() => calcularSla({ fechaInicio: '2026-02-30', fechaActual: '2026-03-01' })).toThrow(RangeError);
    expect(() => calcularSla({ fechaInicio: '2026-03-02', fechaActual: '2026-03-01' })).toThrow(RangeError);
  });
});
