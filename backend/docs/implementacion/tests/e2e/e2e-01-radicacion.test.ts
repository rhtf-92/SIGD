import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

describe('E2E-01 · Radicación exitosa en Mesa de Partes', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('persiste el expediente y asigna correlation_id', async () => {
    const payload = payloadRadicacionValido();
    const respuesta = await obtenerAgente().post('/api/expedientes').send(payload);

    expect(respuesta.status).toBe(201);
    expect(respuesta.body.id_expediente).toBeDefined();
    expect(respuesta.body.correlation_id).toBeTruthy();
    expect(respuesta.headers['x-correlation-id']).toBeDefined();

    const persistido = await obtenerPool().query(
      'SELECT id_expediente FROM sigd_tra.expediente WHERE numero = $1',
      [payload.numero],
    );
    expect(persistido.rowCount).toBe(1);
    expect(persistido.rows[0].id_expediente).toBe(respuesta.body.id_expediente);
  });
});