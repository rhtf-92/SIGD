import { describe, expect, it } from 'vitest';
import { calcularSla } from '../../../../src/domains/rutadoc/sla.service.js';

describe('Microtarea 4.1 (TSK-DEV-04) — Suspensión Legal y Cómputo de SLA en RutaDoc (LPAG Arts. 136 y 142)', () => {
  it('01: Sin suspensión, computa días hábiles normalmente', () => {
    // Del 2026-10-01 (jueves) al 2026-10-08 (jueves) = 5 días hábiles (vie 2, lun 5, mar 6, mié 7, jue 8)
    const resultado = calcularSla({
      fechaInicio: '2026-10-01',
      fechaActual: '2026-10-08',
      diasHabilesLimite: 30,
    });

    expect(resultado.diasHabilesTranscurridos).toBe(5);
    expect(resultado.diasHabilesSuspendidos).toBe(0);
    expect(resultado.diasHabilesConsumidos).toBe(5);
    expect(resultado.diasHabilesRestantes).toBe(25);
    expect(resultado.estado).toBe('VERDE');
    expect(resultado.suspendidoActualmente).toBe(false);
  });

  it('02: Durante observación activa (Ronda 1), descuenta días y marca suspendidoActualmente = true', () => {
    // Trámite inicia 2026-10-01. Observado el 2026-10-05 (lunes). Fecha actual 2026-10-09 (viernes).
    // Días transcurridos: vie 2, lun 5, mar 6, mié 7, jue 8, vie 9 = 6 días hábiles.
    // Días en suspensión (del 05 al 09): lun 5, mar 6, mié 7, jue 8, vie 9 = 5 días hábiles suspendidos.
    // Días institucionales consumidos = 6 - 5 = 1 día.
    const resultado = calcularSla({
      fechaInicio: '2026-10-01',
      fechaActual: '2026-10-09',
      diasHabilesLimite: 30,
      intervalosSuspension: [
        {
          desde: '2026-10-05',
          hasta: '2026-10-09',
          ronda: 1,
          motivo: 'Observación formal de requisitos',
        },
      ],
    });

    expect(resultado.diasHabilesTranscurridos).toBe(6);
    expect(resultado.diasHabilesSuspendidos).toBe(5);
    expect(resultado.diasHabilesConsumidos).toBe(1);
    expect(resultado.diasHabilesRestantes).toBe(29);
    expect(resultado.estado).toBe('VERDE');
    expect(resultado.suspendidoActualmente).toBe(true);
  });

  it('03: Tras subsanación válida, reanuda el cómputo institucional conservando el tiempo suspendido', () => {
    // Trámite inicia 2026-10-01.
    // Observado del 2026-10-05 al 2026-10-09 (5 días hábiles de suspensión). Subsanado el 09.
    // Fecha actual 2026-10-16 (viernes).
    // Días transcurridos totales: vie 2, lun 5..vie 9 (5), lun 12..vie 16 (5) = 11 días hábiles.
    // Días suspendidos = 5.
    // Días institucionales consumidos = 11 - 5 = 6 días.
    const resultado = calcularSla({
      fechaInicio: '2026-10-01',
      fechaActual: '2026-10-16',
      diasHabilesLimite: 30,
      intervalosSuspension: [
        {
          desde: '2026-10-05',
          hasta: '2026-10-09',
          ronda: 1,
          motivo: 'Observación subsanada',
        },
      ],
    });

    expect(resultado.diasHabilesTranscurridos).toBe(11);
    expect(resultado.diasHabilesSuspendidos).toBe(5);
    expect(resultado.diasHabilesConsumidos).toBe(6);
    expect(resultado.diasHabilesRestantes).toBe(24);
    expect(resultado.estado).toBe('VERDE');
    expect(resultado.suspendidoActualmente).toBe(false);
  });

  it('04: Múltiples rondas (Ronda 1 y Ronda 2) acumulan la suspensión acumulativa', () => {
    // Trámite inicia 2026-10-01.
    // Ronda 1: del 2026-10-05 al 2026-10-07 (3 días hábiles).
    // Ronda 2: del 2026-10-13 al 2026-10-15 (3 días hábiles).
    // Fecha actual: 2026-10-20. Total transcurridos = 13 días hábiles.
    // Total suspendidos = 3 + 3 = 6 días hábiles.
    // Consumidos = 13 - 6 = 7 días hábiles.
    const resultado = calcularSla({
      fechaInicio: '2026-10-01',
      fechaActual: '2026-10-20',
      diasHabilesLimite: 30,
      intervalosSuspension: [
        { desde: '2026-10-05', hasta: '2026-10-07', ronda: 1 },
        { desde: '2026-10-13', hasta: '2026-10-15', ronda: 2 },
      ],
    });

    expect(resultado.diasHabilesTranscurridos).toBe(13);
    expect(resultado.diasHabilesSuspendidos).toBe(6);
    expect(resultado.diasHabilesConsumidos).toBe(7);
    expect(resultado.diasHabilesRestantes).toBe(23);
    expect(resultado.estado).toBe('VERDE');
  });

  it('05: Previene indebido semáforo ROJO gracias al descuento de días suspendidos', () => {
    // Plazo límite: 10 días hábiles.
    // Días transcurridos calendario: 15 días hábiles.
    // Sin suspensión, 15 > 10 daría ROJO.
    // Con 8 días de suspensión por observación, consumidos = 15 - 8 = 7 días hábiles <= 10.
    // Estado debe ser VERDE (7/10 = 70% < 80%).
    const resultado = calcularSla({
      fechaInicio: '2026-10-01',
      fechaActual: '2026-10-22', // 15 días hábiles
      diasHabilesLimite: 10,
      intervalosSuspension: [
        {
          desde: '2026-10-05',
          hasta: '2026-10-14', // lun 5..vie 9 (5) + lun 12..mié 14 (3) = 8 días hábiles
          ronda: 1,
        },
      ],
    });

    expect(resultado.diasHabilesTranscurridos).toBe(15);
    expect(resultado.diasHabilesSuspendidos).toBe(8);
    expect(resultado.diasHabilesConsumidos).toBe(7);
    expect(resultado.diasHabilesRestantes).toBe(3);
    expect(resultado.porcentaje).toBe(70);
    expect(resultado.estado).toBe('VERDE');
  });
});
