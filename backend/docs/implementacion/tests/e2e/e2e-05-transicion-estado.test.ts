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
      'INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, true) RETURNING id_area',
      ['Jefatura'],
    );
    const areaId = area.rows[0].id_area;

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());
    expect(radicado.status).toBe(201);

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({ id_expediente: radicado.body.id_expediente, id_area_destino: areaId });

    expect(respuesta.status).toBe(200);
    expect(respuesta.body.ok).toBe(true);

    const movimiento = await pool.query(
      'SELECT id_movimiento FROM sigd_rut.movimiento_tramite WHERE id_expediente = $1 AND id_area_destino = $2',
      [radicado.body.id_expediente, areaId],
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
      'INSERT INTO sigd_org.area (nombre, vigente) VALUES ($1, false) RETURNING id_area',
      ['Área inactiva'],
    );

    const radicado = await obtenerAgente().post('/api/expedientes').send(payloadRadicacionValido());

    const respuesta = await obtenerAgente()
      .post('/api/expedientes/derivar')
      .send({ id_expediente: radicado.body.id_expediente, id_area_destino: area.rows[0].id_area });

    expect([400, 404]).toContain(respuesta.status);
  });
});