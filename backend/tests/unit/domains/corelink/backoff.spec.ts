import { describe, it, expect } from 'vitest';
import {
  backoffExponencialConJitter,
  esperarConJitter,
  retardoReintento,
} from '../../../../src/utils/backoff.util.js';

describe('Resiliencia · backoff exponencial con jitter (T-BE-CL-05)', () => {
  it('respeta el techo configurado en reintentos sucesivos', () => {
    for (let intento = 0; intento < 40; intento += 1) {
      const espera = backoffExponencialConJitter(1000, intento, 10_000);
      expect(espera).toBeGreaterThan(0);
      expect(espera).toBeLessThanOrEqual(10_000);
    }
  });

  it('crece de forma exponencial entre intentos', () => {
    const minimoIntento1 = 1000;
    const maximoIntento1 = 2000;
    const minimoIntento3 = 4000;
    const maximoIntento3 = 8000;

    for (let i = 0; i < 60; i += 1) {
      const primerRetry = backoffExponencialConJitter(1000, 1);
      const tercerRetry = backoffExponencialConJitter(1000, 3);
      expect(primerRetry).toBeGreaterThanOrEqual(minimoIntento1 / 2);
      expect(primerRetry).toBeLessThanOrEqual(maximoIntento1);
      expect(tercerRetry).toBeGreaterThanOrEqual(minimoIntento3 / 2);
      expect(tercerRetry).toBeLessThanOrEqual(maximoIntento3);
    }
  });

  it('descorrelaciona los reintentos: dos workers no emiten el mismo retardo', () => {
    const muestras = new Set<number>();
    for (let i = 0; i < 50; i += 1) {
      muestras.add(backoffExponencialConJitter(1000, 2));
    }
    expect(muestras.size).toBeGreaterThan(25);
  });

  it('nunca devuelve un retardo negativo ni cero', () => {
    expect(backoffExponencialConJitter(0, 5)).toBeGreaterThan(0);
    expect(backoffExponencialConJitter(-100, 5)).toBeGreaterThan(0);
    expect(backoffExponencialConJitter(1000, -3)).toBeGreaterThan(0);
    expect(retardoReintento()).toBeGreaterThan(0);
  });

  it('esperarConJitter no bloquea con valores nulos y respeta el aborto', async () => {
    const inicio = Date.now();
    await esperarConJitter(0);
    await esperarConJitter(-50);
    expect(Date.now() - inicio).toBeLessThan(50);

    const controlador = new AbortController();
    setTimeout(() => controlador.abort(), 10);
    const inicioAborto = Date.now();
    await esperarConJitter(5000, controlador.signal);
    expect(Date.now() - inicioAborto).toBeLessThan(2000);

    const yaAbortado = AbortSignal.abort();
    await esperarConJitter(5000, yaAbortado);
  });
});