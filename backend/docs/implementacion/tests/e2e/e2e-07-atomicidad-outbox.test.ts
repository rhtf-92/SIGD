import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { correlationIdFijo } from '../helpers/payloads.helper.js';

describe('E2E-07 · Atomicidad expediente + evento outbox', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('registra el evento en la misma transacción con estado PENDIENTE', async () => {
    const correlation = correlationIdFijo();
    const respuesta = await obtenerAgente()
      .post('/api/expedientes')
      .set('x-correlation-id', correlation)
      .send({
        numero: `EXP-ATM-${Date.now()}`,
        dni_solicitante: '12345678',
        numero_documento: 'DOC-ATM-1',
        folios: 5,
        tipo_documental_id: '550e8400-e29b-41d4-a716-446655440001',
        solicitante_id: '550e8400-e29b-41d4-a716-446655440002',
        area_destino_id: '550e8400-e29b-41d4-a716-446655440003',
      });

    expect(respuesta.status).toBe(201);

    const pool = obtenerPool();
    const evento = await pool.query(
      `SELECT id_evento, estado, tipo_evento, payload
         FROM sigd_audit.evento_outbox
        WHERE agregado = 'expediente'
        ORDER BY creado_en DESC
        LIMIT 1`,
    );

    expect(evento.rowCount).toBe(1);
    expect(evento.rows[0].estado).toBe('PENDIENTE');
    expect(evento.rows[0].tipo_evento).toBe('TramiteRegistrado');
    expect(evento.rows[0].payload.correlation_id).toBe(correlation);
    expect(evento.rows[0].payload.expediente_id).toBe(respuesta.body.expediente_id);
  });

  it('rollback completo: falla la inserción del outbox y no persiste ni expediente', async () => {
    const pool = obtenerPool();
    const numeroUnico = `EXP-ROLLBACK-${Date.now()}`;

    await pool.query(
      `ALTER TABLE sigd_audit.evento_outbox
         DROP COLUMN payload`,
    );

    try {
      const countAntesExp = (
        await pool.query('SELECT count(*)::int AS total FROM sigd_tra.expediente')
      ).rows[0].total;
      const countAntesOut = (
        await pool.query("SELECT count(*)::int AS total FROM sigd_audit.evento_outbox WHERE agregado = 'expediente'")
      ).rows[0].total;

      const respuesta = await obtenerAgente()
        .post('/api/expedientes')
        .set('x-correlation-id', correlationIdFijo())
        .send({
          numero: numeroUnico,
          dni_solicitante: '12345678',
          numero_documento: 'DOC-ROLLBACK-1',
          folios: 3,
          tipo_documental_id: '550e8400-e29b-41d4-a716-446655440001',
          solicitante_id: '550e8400-e29b-41d4-a716-446655440002',
          area_destino_id: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(respuesta.status).toBeGreaterThanOrEqual(400);

      const countDespuesExp = (
        await pool.query('SELECT count(*)::int AS total FROM sigd_tra.expediente')
      ).rows[0].total;
      const countDespuesOut = (
        await pool.query("SELECT count(*)::int AS total FROM sigd_audit.evento_outbox WHERE agregado = 'expediente'")
      ).rows[0].total;

      expect(countDespuesExp).toBe(countAntesExp);
      expect(countDespuesOut).toBe(countAntesOut);
    } finally {
      await pool.query(
        `ALTER TABLE sigd_audit.evento_outbox
           ADD COLUMN payload JSONB NOT NULL DEFAULT '{}'::jsonb`,
      );
    }
  });
});
