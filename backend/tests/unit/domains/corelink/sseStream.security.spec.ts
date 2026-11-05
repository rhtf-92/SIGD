import type { Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { BusSse } from '../../../../src/modules/corelink/sseStream.service.js';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

function response() {
  return { writableEnded: false, write: vi.fn() } as unknown as Response;
}

describe('aislamiento de destinatarios en SSE', () => {
  it('entrega eventos solo al usuario destinatario', () => {
    const bus = new BusSse();
    const streamA = response();
    const streamB = response();
    bus.suscribir(streamA, ['casilla'], USER_A);
    bus.suscribir(streamB, ['casilla'], USER_B);

    bus.emitirEvento('casilla_notificacion', { usuario_id: USER_B, asunto: 'privado' });

    expect(streamA.write).not.toHaveBeenCalled();
    expect(streamB.write).toHaveBeenCalledOnce();
  });

  it('filtra replay por usuario destinatario y canal', () => {
    const bus = new BusSse();
    bus.emitirEvento('casilla_notificacion', { usuario_id: USER_A, id: 'a' });
    bus.emitirEvento('casilla_notificacion', { usuario_id: USER_B, id: 'b' });
    bus.emitirEvento('expediente_transicion', { destinatario_usuario_id: USER_A, id: 'c' });
    const stream = response();

    const replayed = bus.replayDesde(0, stream, new Set(['casilla']), USER_A);

    expect(replayed).toHaveLength(1);
    expect(stream.write).toHaveBeenCalledOnce();
    expect(String(vi.mocked(stream.write).mock.calls[0]?.[0])).toContain('"id":"a"');
  });

  it('descarta eventos desconocidos o sin destinatario', () => {
    const bus = new BusSse();
    const stream = response();
    bus.suscribir(stream, ['casilla', 'expedientes', 'sla'], USER_A);

    bus.emitirEvento('evento_desconocido', { usuario_id: USER_A });
    bus.emitirEvento('casilla_notificacion', { asunto: 'sin destinatario' });

    expect(stream.write).not.toHaveBeenCalled();
    expect(bus.replayDesde(0, stream, new Set(['casilla']), USER_A)).toEqual([]);
  });

  it('reconoce eventos de expediente y SLA solo con destinatario explícito', () => {
    const bus = new BusSse();
    const streamA = response();
    const streamB = response();
    bus.suscribir(streamA, ['expedientes', 'sla'], USER_A);
    bus.suscribir(streamB, ['expedientes', 'sla'], USER_B);

    bus.emitirEvento('ExpedienteDerivado', { destinatario_usuario_id: USER_B, id_expediente: 'exp-1' });
    bus.emitirEvento('sla_alerta', { destinatario_usuario_id: USER_A, id_expediente: 'exp-2' });

    expect(streamA.write).toHaveBeenCalledOnce();
    expect(String(vi.mocked(streamA.write).mock.calls[0]?.[0])).toContain('sla_alerta');
    expect(streamB.write).toHaveBeenCalledOnce();
    expect(String(vi.mocked(streamB.write).mock.calls[0]?.[0])).toContain('ExpedienteDerivado');
  });
});
