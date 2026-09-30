import { describe, it, expect } from 'vitest';
import * as rutaCanonica from '../../../../src/workers/outbox.worker.js';
import * as implementacion from '../../../../src/audit/outbox-worker.js';
import * as shimSse from '../../../../src/domains/corelink/sseStream.service.js';
import * as implementacionSse from '../../../../src/modules/corelink/sseStream.service.js';

/**
 * Los modulos de `src/workers/` y `src/domains/corelink/` son las rutas que el
 * plan maestro declara como entregables (§7.4.6). En este repositorio la
 * implementacion vive en `src/audit/` y `src/modules/`, y esos modulos solo
 * reexportan su superficie publica.
 *
 * Estos casos fijan ese contrato: si una reexportacion deja de exponer un simbolo
 * o empieza a exponer una copia divergente, la suite lo detecta antes de que un
 * consumidor importe la ruta documentada y reciba `undefined` en produccion.
 */

describe('Rutas canonicas del plan · reexportaciones', () => {
  it('la ruta canonica del outbox reexporta la misma clase que la implementacion', () => {
    expect(rutaCanonica.OutboxWorker).toBe(implementacion.OutboxWorker);
  });

  it('expone la superficie publica completa del OutboxWorker', () => {
    expect(typeof rutaCanonica.OutboxWorker).toBe('function');
    const prototipo = rutaCanonica.OutboxWorker.prototype as unknown as Record<string, unknown>;
    for (const metodo of ['iniciar', 'detener', 'ciclo'] as const) {
      expect(typeof prototipo[metodo]).toBe('function');
    }
  });

  it('la ruta canonica del bus SSE reexporta los mismos simbolos que la implementacion', () => {
    expect(shimSse.BusSse).toBe(implementacionSse.BusSse);
    expect(shimSse.CANALES_SSE).toBe(implementacionSse.CANALES_SSE);
    expect(shimSse.HEARTBEAT_SEGUNDOS).toBe(implementacionSse.HEARTBEAT_SEGUNDOS);
    expect(shimSse.parsearCanales).toBe(implementacionSse.parsearCanales);
  });

  it('no duplica la logica: ambas rutas comparten el mismo estado interno', () => {
    const bus = new shimSse.BusSse(2);
    bus.emitirEvento('sla_alerta', { i: 1 });
    bus.emitirEvento('sla_alerta', { i: 2 });
    bus.emitirEvento('sla_alerta', { i: 3 });

    const reproducidos = bus.replayDesde(0, escrituraComoResponse(), new Set(['sla']));
    expect(reproducidos).toEqual([2, 3]);
  });
});

function escrituraComoResponse(): import('express').Response {
  const tramas: string[] = [];
  return {
    writableEnded: false,
    write(trama: string) {
      tramas.push(trama);
      return true;
    },
    end() {
      return this;
    },
  } as unknown as import('express').Response;
}
