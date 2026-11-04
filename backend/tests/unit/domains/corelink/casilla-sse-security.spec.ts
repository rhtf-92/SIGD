import type { Response } from 'express';
import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { DestinoCasilla, DestinoSse } from '../../../../src/audit/despachador-notificaciones.js';
import { BusSse, EVENTO_CASILLA } from '../../../../src/modules/corelink/sseStream.service.js';

const USUARIO_A = '11111111-1111-4111-8111-111111111111';
const USUARIO_B = '22222222-2222-4222-8222-222222222222';

function respuestaSse() {
  return { writableEnded: false, write: vi.fn() } as unknown as Response;
}

describe('aislamiento de eventos SSE de Casilla', () => {
  it('entrega y reproduce la notificación solo al propietario', () => {
    const bus = new BusSse();
    const respuestaA = respuestaSse();
    const respuestaB = respuestaSse();
    const respuestaReplayA = respuestaSse();
    const respuestaReplayB = respuestaSse();
    bus.suscribir(respuestaA, ['casilla'], USUARIO_A);
    bus.suscribir(respuestaB, ['casilla'], USUARIO_B);

    bus.emitirEvento(EVENTO_CASILLA, { usuario_id: USUARIO_A, asunto: 'Privada para A' });

    expect(respuestaA.write).toHaveBeenCalledTimes(1);
    expect(respuestaB.write).not.toHaveBeenCalled();
    expect(bus.replayDesde(0, respuestaReplayA, new Set(['casilla']), USUARIO_A)).toHaveLength(1);
    expect(bus.replayDesde(0, respuestaReplayB, new Set(['casilla']), USUARIO_B)).toHaveLength(0);
    expect(respuestaReplayA.write).toHaveBeenCalledTimes(1);
    expect(respuestaReplayB.write).not.toHaveBeenCalled();
  });

  it('descarta eventos sin propietario en lugar de difundirlos', () => {
    const bus = new BusSse();
    const respuestaA = respuestaSse();
    bus.suscribir(respuestaA, ['casilla'], USUARIO_A);

    bus.emitirEvento(EVENTO_CASILLA, { correo_destinatario: 'sin-cuenta@example.test', asunto: 'Sin propietario' });

    expect(respuestaA.write).not.toHaveBeenCalled();
    expect(bus.replayDesde(0, respuestaSse(), new Set(['casilla']), USUARIO_A)).toHaveLength(0);
  });

  it('resuelve el destinatario desde la cuenta activa antes de publicar el evento', async () => {
    const bus = new BusSse();
    const respuestaA = respuestaSse();
    const respuestaB = respuestaSse();
    bus.suscribir(respuestaA, ['casilla'], USUARIO_A);
    bus.suscribir(respuestaB, ['casilla'], USUARIO_B);
    const query = vi.fn(async () => ({ rows: [{ id_usuario: USUARIO_A }], rowCount: 1 }));
    const destino = new DestinoSse(bus, { query } as unknown as Pool);

    await destino.despachar({
      id_evento: 'event-1',
      correlation_id: 'correlation-1',
      agregado: 'notificacion',
      tipo_evento: EVENTO_CASILLA,
      payload: { correo_destinatario: 'a@example.test', asunto: 'Para A' },
      intentos: 0,
    });

    expect(query).toHaveBeenCalledOnce();
    expect(respuestaA.write).toHaveBeenCalledOnce();
    expect(respuestaB.write).not.toHaveBeenCalled();
    expect(String(vi.mocked(respuestaA.write).mock.calls[0]?.[0])).toContain(USUARIO_A);
  });

  it('persiste la notificación con usuario_id resuelto desde el correo de una cuenta activa', async () => {
    const query = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }], rowCount: 1 };
      if (sql.includes('FROM sigd_auth.cuenta_usuario')) return { rows: [{ id_usuario: USUARIO_B }], rowCount: 1 };
      return { rows: [], rowCount: 1 };
    });
    const destino = new DestinoCasilla({ query } as unknown as Pool);

    await destino.despachar({
      id_evento: 'event-2',
      correlation_id: 'correlation-2',
      agregado: 'notificacion',
      tipo_evento: EVENTO_CASILLA,
      payload: { correo_destinatario: 'b@example.test', asunto: 'Para B' },
      intentos: 0,
    });

    const insert = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO'));
    expect(String(insert?.[0])).toContain('(usuario_id, correo_destinatario');
    expect(insert?.[1]).toEqual([USUARIO_B, 'b@example.test', 'Para B', '{"correo_destinatario":"b@example.test","asunto":"Para B"}', 'correlation-2']);
  });

  it('no crea una notificación sin una cuenta activa asociada al correo', async () => {
    const query = vi.fn(async (sql: string, _params: unknown[] = []) => {
      if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }], rowCount: 1 };
      return { rows: [], rowCount: 0 };
    });
    const destino = new DestinoCasilla({ query } as unknown as Pool);

    await destino.despachar({
      id_evento: 'event-3',
      correlation_id: null,
      agregado: 'notificacion',
      tipo_evento: EVENTO_CASILLA,
      payload: { correo_destinatario: 'inexistente@example.test' },
      intentos: 0,
    });

    expect(query.mock.calls.some(([sql]) => sql.includes('INSERT INTO'))).toBe(false);
  });
});
