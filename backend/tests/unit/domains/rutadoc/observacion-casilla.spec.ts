import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { errorMiddleware } from '../../../../src/middleware/error-middleware.js';
import { crearRouterDerivaciones } from '../../../../src/domains/rutadoc/derivaciones.controller.js';

const idExpediente = '11111111-1111-4111-8111-111111111111';
const idPersona = '22222222-2222-4222-8222-222222222222';
const idUsuario = '33333333-3333-4333-8333-333333333333';

function crearApp(destinatarios = [{ usuario_id: idUsuario, asunto: 'Solicitud sintética' }], estado = 'EN_CALIFICACION') {
  const consultas: Array<{ sql: string; valores?: unknown[] }> = [];
  const query = vi.fn(async (sql: string, valores?: unknown[]) => {
    consultas.push({ sql, valores });
    if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return { rows: [], rowCount: 0 };
    if (sql.includes('SELECT estado FROM sigd_tra.expediente')) return { rows: [{ estado }], rowCount: 1 };
    if (sql.includes('UPDATE sigd_tra.expediente')) return { rows: [{
      expediente_id: idExpediente, codigo_expediente: 'EXP-2026-000001', solicitante_id: idPersona,
    }], rowCount: 1 };
    if (sql.includes('JOIN sigd_auth.cuenta_usuario')) return { rows: destinatarios, rowCount: destinatarios.length };
    if (sql.includes('INSERT INTO sigd_audit.evento_outbox')) return { rows: [{ id_evento: 'evento-prueba' }], rowCount: 1 };
    throw new Error('Consulta inesperada en el caso de observación.');
  });
  const pool = { connect: async () => ({ query, release: vi.fn() }) } as unknown as Pool;
  const app = express();
  app.use(express.json());
  app.use(crearRouterDerivaciones(pool));
  app.use(errorMiddleware);
  return { app, consultas };
}

describe('Observación de expediente y Outbox de Casilla', () => {
  it('registra la observación y el evento Casilla en la misma transacción para el titular', async () => {
    const { app, consultas } = crearApp();
    const respuesta = await request(app).post(`/${idExpediente}/observar`).send({ motivo: 'Adjuntar el formulario requerido.' });
    expect(respuesta.status).toBe(200);
    const evento = consultas.find(({ sql }) => sql.includes('INSERT INTO sigd_audit.evento_outbox'));
    expect(evento?.valores?.[2]).toBe('expediente_observado');
    expect(JSON.parse(String(evento?.valores?.[3]))).toEqual({
      usuario_id: idUsuario,
      expediente_id: idExpediente,
      cut: 'EXP-2026-000001',
      asunto: 'Solicitud sintética',
      tipo_acto: 'Observación de expediente',
      cuerpo: { contenido: 'Adjuntar el formulario requerido.' },
    });
    expect(consultas.at(-1)?.sql).toBe('COMMIT');
  });

  it('revierte la observación si no hay exactamente una cuenta titular activa', async () => {
    const { app, consultas } = crearApp([]);
    const respuesta = await request(app).post(`/${idExpediente}/observar`).send({ motivo: 'Motivo sintético.' });
    expect(respuesta.status).toBe(409);
    expect(consultas.some(({ sql }) => sql.includes('INSERT INTO sigd_audit.evento_outbox'))).toBe(false);
    expect(consultas.at(-1)?.sql).toBe('ROLLBACK');
  });

  it('rechaza REGISTRADO sin cambiar estado ni emitir una notificación', async () => {
    const { app, consultas } = crearApp(undefined, 'REGISTRADO');
    const respuesta = await request(app).post(`/${idExpediente}/observar`).send({ motivo: 'Motivo sintético.' });
    expect(respuesta.status).toBe(422);
    expect(consultas.some(({ sql }) => sql.includes('UPDATE sigd_tra.expediente'))).toBe(false);
    expect(consultas.some(({ sql }) => sql.includes('INSERT INTO sigd_audit.evento_outbox'))).toBe(false);
    expect(consultas.at(-1)?.sql).toBe('ROLLBACK');
  });
});
