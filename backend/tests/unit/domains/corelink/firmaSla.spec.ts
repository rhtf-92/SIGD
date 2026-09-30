import { describe, it, expect } from 'vitest';
import {
  calcularPrioridad,
  diasHabilesRestantes,
  TIPOS_RESOLUCION,
} from '../../../../src/modules/firma/firma.routes.js';

const HOY = new Date('2026-09-30T15:00:00.000Z');

function desdeDias(fechaISO: string, dias: number): Date {
  const fecha = new Date(fechaISO);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha;
}

describe('Cola de firma · SLA de 30 días hábiles (TUO Ley 27444 Art. 143)', () => {
  it('resta el plazo completo cuando el vencimiento es el mismo día', () => {
    expect(diasHabilesRestantes(new Date('2026-09-30T23:59:00.000Z'), HOY)).toBe(30);
  });

  it('no cuenta sábados ni domingos como días hábiles transcurridos', () => {
    // 2026-10-03 es sábado: desde el 2026-09-30 sólo transcurre jueves y viernes.
    expect(diasHabilesRestantes(desdeDias('2026-09-30T00:00:00.000Z', 3), HOY)).toBe(28);
  });

  it('llega a cero al vencer el plazo y nunca retorna negativo', () => {
    expect(diasHabilesRestantes(desdeDias('2026-09-30T00:00:00.000Z', 60), HOY)).toBe(0);
  });

  it('clasifica la prioridad según los umbrales del contrato', () => {
    expect(calcularPrioridad(2)).toBe('CRITICA');
    expect(calcularPrioridad(3)).toBe('CRITICA');
    expect(calcularPrioridad(4)).toBe('ALTA');
    expect(calcularPrioridad(7)).toBe('ALTA');
    expect(calcularPrioridad(8)).toBe('MEDIA');
    expect(calcularPrioridad(15)).toBe('MEDIA');
    expect(calcularPrioridad(16)).toBe('BAJA');
    expect(calcularPrioridad(30)).toBe('BAJA');
  });

  it('expone los tres tipos de resolución institucional', () => {
    expect([...TIPOS_RESOLUCION]).toEqual([
      'DIRECTORAL_TITULACION',
      'DIRECTORAL_CONVALIDACION',
      'DIRECTORAL_ADMINISTRATIVA',
    ]);
  });
});
