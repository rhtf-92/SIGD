import { describe, it, expect } from 'vitest';
import type { Response } from 'express';
import { BusSse, parsearCanales, CANALES_SSE, HEARTBEAT_SEGUNDOS } from '../../../../src/modules/corelink/sseStream.service.js';

class RespuestaFalsa {
  public readonly tramas: string[] = [];
  public writableEnded = false;

  write(trama: string): boolean {
    this.tramas.push(trama);
    return true;
  }

  end(): void {
    this.writableEnded = true;
  }
}

function suscribir(bus: BusSse, canales?: string): RespuestaFalsa {
  const res = new RespuestaFalsa();
  bus.suscribir(res as unknown as Response, parsearCanales(canales));
  return res;
}

describe('BusSse · canales, replay y heartbeat', () => {
  it('expande la lista de canales canónicos por omisión', () => {
    expect(parsearCanales(undefined)).toEqual(CANALES_SSE);
    expect(parsearCanales('')).toEqual(CANALES_SSE);
    expect(parsearCanales('casilla,sla')).toEqual(['casilla', 'sla']);
    expect(parsearCanales('CASILLA')).toEqual(['casilla']);
    expect(parsearCanales('inexistente')).toEqual(CANALES_SSE);
  });

  it('entrega el evento solo a los suscriptores del canal', () => {
    const bus = new BusSse();
    const casilla = suscribir(bus, 'casilla');
    const expedientes = suscribir(bus, 'expedientes');

    bus.emitirEvento('casilla_notificacion', { id: 1 });

    expect(casilla.tramas.join('')).toContain('event: casilla_notificacion');
    expect(casilla.tramas.join('')).toContain('id: 1');
    expect(expedientes.tramas).toHaveLength(0);
  });

  it('reproduce tras Last-Event-ID únicamente lo emitido después de ese id', () => {
    const bus = new BusSse();
    bus.emitirEvento('sla_alerta', { nivel: 'AMARILLO' });
    bus.emitirEvento('sla_alerta', { nivel: 'ROJO' });

    const reconectado = new RespuestaFalsa();
    const reproducidos = bus.replayDesde(1, reconectado as unknown as Response, new Set(['sla']));

    expect(reproducidos).toEqual([2]);
    const trama = reconectado.tramas.join('');
    expect(trama).toContain('id: 2');
    expect(trama).toContain('ROJO');
    expect(trama).not.toContain('AMARILLO');
  });

  it('respeta el canal en el replay y descarta lo que no le corresponde', () => {
    const bus = new BusSse();
    bus.emitirEvento('casilla_notificacion', { id: 10 });
    bus.emitirEvento('expediente_transicion', { id: 20 });

    const reconectado = new RespuestaFalsa();
    const reproducidos = bus.replayDesde(0, reconectado as unknown as Response, new Set(['expedientes']));

    expect(reproducidos).toEqual([2]);
    expect(reconectado.tramas.join('')).not.toContain('id: 10');
  });

  it('emite un único heartbeat por suscriptor y no acumula por conexión', () => {
    const bus = new BusSse();
    const a = suscribir(bus, 'casilla');
    const b = suscribir(bus, 'expedientes');
    const c = suscribir(bus, 'sla');

    bus.emitirHeartbeat();

    for (const res of [a, b, c]) {
      expect(res.tramas).toHaveLength(1);
      expect(res.tramas[0]).toMatch(/^:heartbeat /);
    }
    expect(HEARTBEAT_SEGUNDOS).toBe(15);
  });

  it('deja de escribir en respuestas cerradas y limpia suscriptores', () => {
    const bus = new BusSse();
    const res = suscribir(bus, 'casilla');
    expect(bus.cantidadSuscriptores()).toBe(1);

    (res as unknown as { writableEnded: boolean }).writableEnded = true;
    bus.emitirHeartbeat();
    expect(res.tramas).toHaveLength(0);

    bus.cerrarTodos();
    expect(bus.cantidadSuscriptores()).toBe(0);
    expect(res.writableEnded).toBe(true);
  });

  it('acota el buffer de replay', () => {
    const bus = new BusSse(3);
    for (let i = 0; i < 10; i += 1) {
      bus.emitirEvento('sla_alerta', { i });
    }

    const res = new RespuestaFalsa();
    const reproducidos = bus.replayDesde(0, res as unknown as Response, new Set(['sla']));

    expect(reproducidos).toEqual([8, 9, 10]);
  });
});
