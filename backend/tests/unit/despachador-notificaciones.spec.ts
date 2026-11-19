import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { DestinoCasilla } from '../../src/audit/despachador-notificaciones.js';
import type { EventoPendiente } from '../../src/audit/outbox-worker.js';

const usuario = '22222222-2222-4222-8222-222222222222';
const expediente = '33333333-3333-4333-8333-333333333333';
const documento = '44444444-4444-4444-8444-444444444444';
const idEvento = '55555555-5555-4555-8555-555555555555';

function evento(payload: Record<string, unknown> = {}): EventoPendiente {
  return {
    id_evento: idEvento,
    correlation_id: '66666666-6666-4666-8666-666666666666',
    agregado: 'Expediente',
    tipo_evento: 'casilla_notificacion',
    payload: {
      usuario_id: usuario,
      expediente_id: expediente,
      cut: 'EXP-2026-TEST01',
      asunto: 'Notificación sintética de prueba',
      ...payload,
    },
    intentos: 0,
  };
}

function destino(opciones: { existente?: { usuario_id: string; cut: string }; titular?: boolean; adjunto?: boolean } = {}) {
  const query = vi.fn(async (sql: string, _valores?: unknown[]) => {
    if (sql.includes('to_regclass')) return { rows: [{ existe: 'sigd_auth.notificacion_casilla' }], rowCount: 1 };
    if (sql.includes('SELECT usuario_id, cut')) return { rows: opciones.existente ? [opciones.existente] : [], rowCount: opciones.existente ? 1 : 0 };
    if (sql.includes('JOIN sigd_auth.cuenta_usuario')) return { rows: [{ existe: opciones.titular ?? true }], rowCount: 1 };
    if (sql.includes('FROM sigd_doc.documento_adjunto')) return { rows: [{ existe: opciones.adjunto ?? true }], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_audit.bitacora_auditoria')) return { rows: [], rowCount: 1 };
    if (sql.includes('INSERT INTO sigd_auth.notificacion_casilla')) return { rows: [], rowCount: 1 };
    throw new Error('Consulta inesperada del destino Casilla.');
  });
  return { destino: new DestinoCasilla({ query } as unknown as Pool), query };
}

describe('Destino Outbox de Casilla', () => {
  it('vincula la notificación al titular, CUT y adjunto existente sin exponer la clave S3', async () => {
    const { destino: casilla, query } = destino();
    await casilla.despachar(evento({ documento_id: documento, tipo_acto: 'Observación' }));

    const escritura = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_auth.notificacion_casilla'));
    expect(escritura?.[0]).toContain('usuario_id, correo_destinatario, cut, asunto');
    expect(escritura?.[0]).toContain("'NO_LEIDO'");
    expect(escritura?.[1]).toEqual([
      usuario, null, 'EXP-2026-TEST01', 'Notificación sintética de prueba', 'Observación', null,
      JSON.stringify({ ...evento().payload, documento_id: documento, tipo_acto: 'Observación' }),
      idEvento, `/api/v1/storage/documentos/${documento}/download`,
    ]);
    expect(escritura?.[0]).not.toContain('s3_key');
  });

  it('rechaza la entrega cuando el evento no identifica al usuario, expediente, CUT y asunto', async () => {
    const { destino: casilla, query } = destino();
    await expect(casilla.despachar(evento({ usuario_id: undefined }))).rejects.toThrow('no contiene destinatario');
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.anything());
  });

  it('rechaza destinatarios que no son titulares activos del expediente', async () => {
    const { destino: casilla, query } = destino({ titular: false });
    await expect(casilla.despachar(evento())).rejects.toThrow('no es el titular activo');
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.anything());
  });

  it('no vincula un adjunto que no pertenece al CUT notificado', async () => {
    const { destino: casilla, query } = destino({ adjunto: false });
    await expect(casilla.despachar(evento({ documento_id: documento }))).rejects.toThrow('no pertenece al expediente');
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.anything());
  });

  it('trata el reintento del mismo evento como idempotente', async () => {
    const { destino: casilla, query } = destino({ existente: { usuario_id: usuario, cut: 'EXP-2026-TEST01' } });
    await casilla.despachar(evento());
    expect(query).toHaveBeenCalledTimes(2);
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO'), expect.anything());
  });

  it('rechaza si la referencia del evento ya pertenece a otro destinatario o CUT', async () => {
    const { destino: casilla, query } = destino({ existente: { usuario_id: usuario, cut: 'EXP-2026-OTRO' } });
    await expect(casilla.despachar(evento())).rejects.toThrow('ya está asociada a otra notificación');
    expect(query).toHaveBeenCalledTimes(2);
  });
  it('omite la entrega en Casilla y registra en auditoría cuando el solicitante no tiene cuenta digital (usuario_id === null)', async () => {
    const { destino: casilla, query } = destino();
    await casilla.despachar(evento({ usuario_id: null }));
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('INSERT INTO sigd_auth.notificacion_casilla'), expect.anything());
    const llamadaAuditoria = query.mock.calls.find(([sql]) => sql.includes('INSERT INTO sigd_audit.bitacora_auditoria'));
    expect(llamadaAuditoria).toBeDefined();
    expect(llamadaAuditoria![0]).toContain('OMISION_CASILLA_NO_HABILITADA');
  });
});

describe('Casilla no disponible: fallo seguro', () => {
  it('no confirma la entrega y permite volver a comprobar disponibilidad', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [{ existe: null }] }).mockResolvedValueOnce({ rows: [{ existe: 'sigd_auth.notificacion_casilla' }] });
    const casilla = new DestinoCasilla({ query } as unknown as Pool);
    await expect(casilla.despachar(evento())).rejects.toThrow('Casilla no disponible');
    expect(await casilla.disponible()).toBe(true);
    expect(query).toHaveBeenCalledTimes(2);
  });
});
