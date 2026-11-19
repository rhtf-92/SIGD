import { describe, expect, it } from 'vitest';
import { calcularHorarioCorte } from '../../../../src/domains/tramicore/horarioCorte.util.js';

describe('horario de corte legal de la radicacion', () => {
  it('inicia el computo en el instante real cuando la recepcion ocurre dentro del horario', () => {
    const envio = new Date('2026-11-06T15:08:17-05:00');

    const resultado = calcularHorarioCorte(envio);

    expect(resultado.requiereProyeccion).toBe(false);
    expect(resultado.radicacionLegal.toISOString()).toBe(envio.toISOString());
  });

  it('proyecta a las 08:00 del siguiente dia habil cuando supera el corte', () => {
    const envio = new Date('2026-11-06T16:31:00-05:00');

    const resultado = calcularHorarioCorte(envio);

    expect(resultado.requiereProyeccion).toBe(true);
    expect(resultado.fechaLegal).toBe('2026-11-09');
    expect(resultado.radicacionLegal.toISOString()).toBe('2026-11-09T13:00:00.000Z');
  });
});
