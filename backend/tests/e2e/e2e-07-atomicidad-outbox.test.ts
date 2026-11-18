import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido, correlationIdFijo } from '../helpers/payloads.helper.js';

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
      .send(payloadRadicacionValido());

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
});