import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

describe('E2E-04 · Derivación a área inexistente', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('no deriva y responde 400/404 cuando el área destino no existe', async () => {
    const radicado = await obtenerAgente()
      .post('/api/expedientes')
      .send(payloadRadicacionValido());
    expect(radicado.status).toBe(201);

    const areaInexistente = randomUUID();
    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({ expediente_id: radicado.body.expediente_id, area_destino_id: areaInexistente });

    expect([400, 404]).toContain(respuesta.status);
    expect(respuesta.body.code).toBeDefined();

    const movimientos = await obtenerPool().query(
      'SELECT id FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1',
      [radicado.body.expediente_id],
    );
    expect(movimientos.rowCount).toBe(0);
  });
});