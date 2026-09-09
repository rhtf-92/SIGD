import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido, correlationIdFijo } from '../helpers/payloads.helper.js';

describe('E2E-06 · Captura automática de contexto en la bitácora', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('registra usuario_id, ip_origen y correlation_id sin pasarlos en el código de negocio', async () => {
    const pool = obtenerPool();
    const cuenta = await pool.query(
      'INSERT INTO sigd_auth.cuenta_usuario DEFAULT VALUES RETURNING id_usuario',
    );
    const usuarioId = cuenta.rows[0].id_usuario;
    const correlation = correlationIdFijo();

    const respuesta = await obtenerAgente()
      .post('/api/expedientes')
      .set('x-correlation-id', correlation)
      .set('x-usuario-id', usuarioId)
      .send(payloadRadicacionValido());

    expect(respuesta.status).toBe(201);

    const auditoria = await pool.query(
      `SELECT correlation_id, usuario_id, ip_origen, user_agent
         FROM sigd_audit.bitacora_auditoria
        WHERE esquema = 'sigd_tra' AND tabla = 'expediente'`,
    );

    expect(auditoria.rowCount).toBe(1);
    const fila = auditoria.rows[0];
    expect(fila.correlation_id).toBe(correlation);
    expect(fila.usuario_id).toBe(usuarioId);
    expect(fila.ip_origen).toBeTruthy();
  });
});