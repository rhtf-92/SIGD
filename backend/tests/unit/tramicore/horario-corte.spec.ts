import { describe, expect, it } from 'vitest';
import { calcularHorarioCorte } from '../../../src/domains/tramicore/horarioCorte.util.js';

describe('horarioCorte.util · Corte de Jornada Institucional (08:00:00 a 16:30:00)', () => {
  const feriados = ['2026-05-01', '2026-07-28', '2026-07-29', '2026-10-08'];

  it('1. Dentro de jornada: Miércoles 10:00:00 es válido y no diferido', () => {
    // 2026-03-04 es miércoles
    const fecha = new Date('2026-03-04T10:00:00-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-03-04');
    expect(res.dentroDeJornada).toBe(true);
    expect(res.diferido).toBe(false);
  });

  it('2. Límite exacto de corte: 16:30:00 se admite dentro de jornada', () => {
    const fecha = new Date('2026-03-04T16:30:00-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-03-04');
    expect(res.dentroDeJornada).toBe(true);
    expect(res.diferido).toBe(false);
  });

  it('3. Posterior al corte por 1 segundo: 16:30:01 se traslada al siguiente día hábil', () => {
    const fecha = new Date('2026-03-04T16:30:01-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-03-05');
    expect(res.dentroDeJornada).toBe(false);
    expect(res.diferido).toBe(true);
    expect(res.motivoDiferimiento).toBe('FUERA_HORARIO');
  });

  it('4. Fuera de jornada vespertino: 17:00:00 (Caso EXP-2026-000220) se traslada al siguiente día hábil', () => {
    const fecha = new Date('2026-03-04T17:00:00-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-03-05');
    expect(res.dentroDeJornada).toBe(false);
    expect(res.diferido).toBe(true);
    expect(res.motivoDiferimiento).toBe('FUERA_HORARIO');
  });

  it('5. Fin de semana: Sábado se traslada al lunes a las 08:00:00', () => {
    // 2026-03-07 es sábado
    const fecha = new Date('2026-03-07T11:00:00-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-03-09');
    expect(res.dentroDeJornada).toBe(false);
    expect(res.diferido).toBe(true);
    expect(res.motivoDiferimiento).toBe('FIN_DE_SEMANA');
  });

  it('6. Feriado: Viernes 2026-05-01 (Día del Trabajo) se traslada al lunes 2026-05-04', () => {
    const fecha = new Date('2026-05-01T10:00:00-05:00');
    const res = calcularHorarioCorte(fecha, feriados);
    expect(res.fechaLegal).toBe('2026-05-04');
    expect(res.dentroDeJornada).toBe(false);
    expect(res.diferido).toBe(true);
    expect(res.motivoDiferimiento).toBe('FERIADO');
  });
});
