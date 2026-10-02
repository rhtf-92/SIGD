import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import { obtenerAgente, limpiarAmbiente, cerrarAmbiente } from '../helpers/app.helper.js';
import { obtenerPool } from '../helpers/database.helper.js';
import { payloadRadicacionValido } from '../helpers/payloads.helper.js';

describe('E2E-05 · Transición Mesa de Partes → Jefatura', () => {
  beforeAll(async () => {
    await limpiarAmbiente();
  });

  afterAll(async () => {
    await cerrarAmbiente();
  });

  it('deriva a un área vigente y registra el movimiento (200 OK)', async () => {
    const pool = obtenerPool();
    const area = await pool.query(
      'INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, true) RETURNING area_id',
      ['Jefatura'],
    );
    const areaId = area.rows[0].area_id;

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());
    expect(radicado.status).toBe(201);

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({ expediente_id: radicado.body.expediente_id, area_destino_id: areaId });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const movimiento = await pool.query(
      'SELECT id FROM sigd_rut.movimiento_tramite WHERE expediente_id = $1 AND area_destino_id = $2',
      [radicado.body.expediente_id, areaId],
    );
    expect(movimiento.rowCount).toBe(1);

    const auditado = await pool.query(
      'SELECT id_auditoria FROM sigd_audit.bitacora_auditoria WHERE esquema = $1 AND tabla = $2',
      ['sigd_rut', 'movimiento_tramite'],
    );
    expect(auditado.rowCount).toBe(1);
  });

  it('rechaza derivación a área no vigente', async () => {
    const pool = obtenerPool();
    const area = await pool.query(
      'INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, false) RETURNING area_id',
      ['Área inactiva'],
    );

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({ expediente_id: radicado.body.expediente_id, area_destino_id: area.rows[0].area_id });

    expect([400, 404]).toContain(respuesta.status);
  });
});