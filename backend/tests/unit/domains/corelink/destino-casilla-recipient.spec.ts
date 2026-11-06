import type { Pool } from 'pg';
import { describe, expect, it, vi } from 'vitest';
import { DestinoCasilla } from '../../../../src/audit/despachador-notificaciones.js';

const USER = '11111111-1111-4111-8111-111111111111';

function pool(found = true) {
  const query = vi.fn(async (sql: string) => {
    if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_auth.notificacion_casilla')) return { rows: found ? [{ usuario_id: USER }] : [], rowCount: found ? 1 : 0 };
    return { rows: [], rowCount: 0 };
  });
  return { query } as unknown as Pool;
}

const evento = {
  id_evento: 'evento-1',
  correlation_id: 'correlation-1',
  agregado: 'casilla',
  tipo_evento: 'casilla_notificacion',
  payload: { correo_destinatario: 'persona@example.test', asunto: 'Aviso', cuerpo: { text: 'Privado' } },
  intentos: 0,
};

describe('destino Outbox de Casilla', () => {
  it('persiste el usuario dueño resuelto desde el correo destinatario', async () => {
    const db = pool();
    await new DestinoCasilla(db).despachar(evento);
    const insert = vi.mocked(db.query).mock.calls.find(([sql]) => String(sql).includes('INSERT INTO sigd_auth.notificacion_casilla'));
    expect(String(insert?.[0])).toContain('SELECT c.id_usuario');
    expect(String(insert?.[0])).toContain('lower(c.correo) = lower($1)');
    expect(insert?.[1]?.[0]).toBe('persona@example.test');
  });

  it('falla explícitamente cuando el correo no tiene una cuenta para asignar titularidad', async () => {
    await expect(new DestinoCasilla(pool(false)).despachar(evento)).rejects.toThrow(/destinatario/i);
  });
});
