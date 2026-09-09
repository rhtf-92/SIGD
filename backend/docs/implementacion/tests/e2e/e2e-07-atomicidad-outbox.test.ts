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
        id_tipo_documental: '550e8400-e29b-41d4-a716-446655440001',
        id_solicitante: '550e8400-e29b-41d4-a716-446655440002',
        id_area_destino: '550e8400-e29b-41d4-a716-446655440003',
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
    expect(evento.rows[0].payload.id_expediente).toBe(respuesta.body.id_expediente);
  });

  it('rollback completo sin alterar el esquema: falla inducida con trigger temporal y no persiste expediente, outbox ni bitácora', async () => {
    const pool = obtenerPool();
    const numeroUnico = `EXP-ROLLBACK-${Date.now()}`;

    await pool.query(
      `CREATE OR REPLACE FUNCTION sigd_audit.e2e07_falla_inducida()
       RETURNS TRIGGER AS $$
       BEGIN
         RAISE EXCEPTION 'falla inducida E2E-07: el evento no debe persistir'
           USING ERRCODE = 'P0001';
       END;
       $$ LANGUAGE plpgsql`,
    );
    await pool.query(
      `DROP TRIGGER IF EXISTS e2e07_trg_falla ON sigd_audit.evento_outbox`,
    );
    await pool.query(
      `CREATE TRIGGER e2e07_trg_falla
       BEFORE INSERT ON sigd_audit.evento_outbox
       FOR EACH ROW EXECUTE FUNCTION sigd_audit.e2e07_falla_inducida()`,
    );

    try {
      const countAntesExp = (
        await pool.query('SELECT count(*)::int AS total FROM sigd_tra.expediente')
      ).rows[0].total;
      const countAntesOut = (
        await pool.query("SELECT count(*)::int AS total FROM sigd_audit.evento_outbox WHERE agregado = 'expediente'")
      ).rows[0].total;
      const countAntesBit = (
        await pool.query(
          "SELECT count(*)::int AS total FROM sigd_audit.bitacora_auditoria WHERE esquema = 'sigd_tra' AND tabla = 'expediente'",
        )
      ).rows[0].total;

      const respuesta = await obtenerAgente()
        .post('/api/expedientes')
        .set('x-correlation-id', correlationIdFijo())
        .send({
          numero: numeroUnico,
          dni_solicitante: '12345678',
          numero_documento: 'DOC-ROLLBACK-1',
          folios: 3,
          id_tipo_documental: '550e8400-e29b-41d4-a716-446655440001',
          id_solicitante: '550e8400-e29b-41d4-a716-446655440002',
          id_area_destino: '550e8400-e29b-41d4-a716-446655440003',
        });

      expect(respuesta.status).toBeGreaterThanOrEqual(400);

      const countDespuesExp = (
        await pool.query('SELECT count(*)::int AS total FROM sigd_tra.expediente')
      ).rows[0].total;
      const countDespuesOut = (
        await pool.query("SELECT count(*)::int AS total FROM sigd_audit.evento_outbox WHERE agregado = 'expediente'")
      ).rows[0].total;
      const countDespuesBit = (
        await pool.query(
          "SELECT count(*)::int AS total FROM sigd_audit.bitacora_auditoria WHERE esquema = 'sigd_tra' AND tabla = 'expediente'",
        )
      ).rows[0].total;

      expect(countDespuesExp).toBe(countAntesExp);
      expect(countDespuesOut).toBe(countAntesOut);
      expect(countDespuesBit).toBe(countAntesBit);
    } finally {
      await pool.query(`DROP TRIGGER IF EXISTS e2e07_trg_falla ON sigd_audit.evento_outbox`);
      await pool.query(`DROP FUNCTION IF EXISTS sigd_audit.e2e07_falla_inducida()`);
    }
  });
});