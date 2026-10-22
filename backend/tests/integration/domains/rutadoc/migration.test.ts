import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Client } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ESTADOS_RUTADOC, EVENTOS_RUTADOC, TRANSICIONES_RUTADOC } from '../../../../src/domains/rutadoc/rutadoc.fsm.js';

let contenedor: StartedPostgreSqlContainer;
let cliente: Client;

function expedienteUuid(id: number): string {
  return `00000000-0000-4000-8000-${String(id).padStart(12, '0')}`;
}

async function asegurarExpediente(id: number): Promise<void> {
  await cliente.query(`
    INSERT INTO sigd_tra.expediente (expediente_id, codigo_expediente, fecha_radicacion)
    VALUES ($1::uuid, $2, '2026-01-01T00:00:00Z')
    ON CONFLICT (expediente_id) DO NOTHING
  `, [expedienteUuid(id), `EXP-2026-${String(id).padStart(6, '0')}`]);
}

async function insertar(expediente: number, fecha: string, clave?: string): Promise<{ particion: string; secuencia: string; fecha_hora: Date }> {
  await asegurarExpediente(expediente);
  const resultado = await cliente.query<{ particion: string; secuencia: string; fecha_hora: Date }>(
    `INSERT INTO sigd_rut.movimiento_tramite
       (id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo,
        usuario_operador_id, fecha_hora, clave_idempotencia)
     VALUES ($1, $2, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7, $3, $4)
     RETURNING tableoid::regclass::text AS particion, secuencia, fecha_hora`,
    [randomUUID(), expedienteUuid(expediente), fecha, clave ?? null],
  );
  return resultado.rows[0];
}

describe('Migración RutaDoc en PostgreSQL 18 aislado', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('sigd_rutadoc_prueba')
      .start();
    cliente = new Client({ connectionString: contenedor.getConnectionUri() });
    await cliente.connect();
    await cliente.query(`CREATE SCHEMA sigd_tra;
      CREATE TABLE sigd_tra.expediente (
        expediente_id UUID PRIMARY KEY,
        codigo_expediente VARCHAR(20) NOT NULL UNIQUE,
        fecha_radicacion TIMESTAMPTZ NOT NULL,
        fecha_limite TIMESTAMPTZ,
        area_destino_id UUID,
        estado VARCHAR(30) NOT NULL DEFAULT 'REGISTRADO'
      )`);
  });

  afterAll(async () => {
    await cliente?.end();
    await contenedor?.stop();
  });

  it('instala la migración y permite repetirla sin duplicar catálogos', async () => {
    const sql = readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8');
    await cliente.query(sql);
    await cliente.query(sql);
    const { rows } = await cliente.query<{ estados: string; eventos: string; transiciones: string }>(`
      SELECT (SELECT count(*) FROM sigd_rut.estado_tramite)::text AS estados,
             (SELECT count(*) FROM sigd_rut.accion_tramite)::text AS eventos,
             (SELECT count(*) FROM sigd_rut.transicion_estado_tramite)::text AS transiciones`);
    expect(rows[0]).toEqual({ estados: '10', eventos: '9', transiciones: '13' });
  });

  it('coincide con los catálogos y la matriz de la FSM, con ARCHIVADO terminal', async () => {
    const estados = await cliente.query<{ codigo: string; es_terminal: boolean }>(
      'SELECT codigo, es_terminal FROM sigd_rut.estado_tramite ORDER BY codigo');
    expect(estados.rows.map((fila) => fila.codigo).sort()).toEqual([...ESTADOS_RUTADOC].sort());
    expect(estados.rows.filter((fila) => fila.es_terminal).map((fila) => fila.codigo)).toEqual(['ARCHIVADO']);
    const eventos = await cliente.query<{ codigo: string }>('SELECT codigo FROM sigd_rut.accion_tramite ORDER BY codigo');
    expect(eventos.rows.map((fila) => fila.codigo).sort()).toEqual([...EVENTOS_RUTADOC].sort());
    const transiciones = await cliente.query<{ estado_anterior: string; evento: string; estado_nuevo: string }>(
      'SELECT estado_anterior, evento, estado_nuevo FROM sigd_rut.transicion_estado_tramite');
    const reales = transiciones.rows.map(({ estado_anterior, evento, estado_nuevo }) =>
      `${estado_anterior}|${evento}|${estado_nuevo}`).sort();
    const esperadas = Object.entries(TRANSICIONES_RUTADOC).flatMap(([origen, eventosOrigen]) =>
      Object.entries(eventosOrigen).map(([evento, destino]) => `${origen}|${evento}|${destino}`)).sort();
    expect(reales).toEqual(esperadas);
    await expect(cliente.query(`INSERT INTO sigd_rut.transicion_estado_tramite
      (estado_anterior, evento, estado_nuevo)
      VALUES ('ARCHIVADO', 'RECEPCION', 'RECEPCIONADO')`))
      .rejects.toMatchObject({ code: '23514' });
  });

  it('dirige 2026, 2027 y años externos a las tres particiones previstas', async () => {
    expect((await insertar(101, '2026-06-01T12:00:00.000Z')).particion).toBe('sigd_rut.movimiento_tramite_2026');
    expect((await insertar(102, '2027-06-01T12:00:00.000Z')).particion).toBe('sigd_rut.movimiento_tramite_2027');
    expect((await insertar(103, '2025-06-01T12:00:00.000Z')).particion).toBe('sigd_rut.movimiento_tramite_default');
    expect((await insertar(104, '2028-06-01T12:00:00.000Z')).particion).toBe('sigd_rut.movimiento_tramite_default');
  });

  it('respeta los extremos exclusivos y conserva milisegundos', async () => {
    const ultimo = await insertar(105, '2026-12-31T23:59:59.999Z');
    const primero = await insertar(105, '2027-01-01T00:00:00.000Z');
    expect(ultimo.particion).toBe('sigd_rut.movimiento_tramite_2026');
    expect(primero.particion).toBe('sigd_rut.movimiento_tramite_2027');
    expect(ultimo.fecha_hora.toISOString()).toBe('2026-12-31T23:59:59.999Z');
    expect(primero.fecha_hora.toISOString()).toBe('2027-01-01T00:00:00.000Z');
    expect([ultimo.secuencia, primero.secuencia]).toEqual(['1', '2']);
  });

  it('rechaza estados, eventos y transiciones inexistentes mediante FK locales', async () => {
    await asegurarExpediente(200);
    for (const [anterior, evento, nuevo] of [
      ['INEXISTENTE', 'RECEPCION', 'RECEPCIONADO'],
      ['REGISTRADO', 'INEXISTENTE', 'RECEPCIONADO'],
      ['REGISTRADO', 'RECEPCION', 'INEXISTENTE'],
      ['REGISTRADO', 'RECEPCION', 'ARCHIVADO'],
    ]) {
      await expect(cliente.query(
        `INSERT INTO sigd_rut.movimiento_tramite
          (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id, fecha_hora)
         VALUES ($4::uuid, $1, $2, $3, 7, '2026-07-01T00:00:00Z')`,
        [anterior, evento, nuevo, expedienteUuid(200)],
      )).rejects.toMatchObject({ code: '23503' });
    }
  });

  it('mantiene identidad e idempotencia únicas entre años', async () => {
    await asegurarExpediente(300);
    const id = randomUUID();
    await cliente.query(`INSERT INTO sigd_rut.movimiento_tramite
      (id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, fecha_hora, clave_idempotencia)
      VALUES ($1, $2::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7,
              '2026-09-01T00:00:00Z', 'orden-300')`, [id, expedienteUuid(300)]);
    await expect(cliente.query(`INSERT INTO sigd_rut.movimiento_tramite
      (id_movimiento, expediente_id, estado_anterior, evento, estado_nuevo,
       usuario_operador_id, fecha_hora)
      VALUES ($1, $2::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7,
              '2027-09-01T00:00:00Z')`, [id, expedienteUuid(300)])).rejects.toMatchObject({ code: '23505' });
    await expect(insertar(300, '2027-09-01T00:00:00Z', 'orden-300'))
      .rejects.toMatchObject({ code: '23505' });
  });

  it('instala índices y FKs UUID restrictivas a TramiCore', async () => {
    const indices = await cliente.query<{ indexname: string; indexdef: string }>(
      `SELECT indexname, indexdef FROM pg_indexes
       WHERE schemaname = 'sigd_rut' AND tablename = 'movimiento_tramite'`);
    for (const nombre of ['ix_movimiento_expediente_fecha', 'ix_movimiento_fecha_id',
      'ix_movimiento_estado_fecha', 'ix_movimiento_expediente_secuencia']) {
      expect(indices.rows.find((fila) => fila.indexname === nombre)?.indexdef).toContain('USING btree');
    }
    const externas = await cliente.query<{ total: string }>(`
      SELECT count(*)::text AS total FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      JOIN pg_class r ON r.oid = c.confrelid
      JOIN pg_namespace rn ON rn.oid = r.relnamespace
      WHERE c.contype = 'f' AND n.nspname = 'sigd_rut' AND rn.nspname <> 'sigd_rut'`);
    expect(Number(externas.rows[0].total)).toBeGreaterThanOrEqual(6);
    const tipos = await cliente.query<{ cantidad: string }>(`
      SELECT count(*)::text AS cantidad
        FROM pg_attribute a
        JOIN pg_class t ON t.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = t.relnamespace
       WHERE n.nspname = 'sigd_rut'
         AND t.relname IN ('movimiento_secuencia', 'movimiento_identidad',
           'movimiento_tramite', 'movimiento_compensatorio',
           'solicitud_compensacion_folios', 'estado_actual_expediente')
         AND a.attname = 'expediente_id'
         AND format_type(a.atttypid, a.atttypmod) = 'uuid'
         AND NOT a.attisdropped`);
    expect(Number(tipos.rows[0].cantidad)).toBe(6);
  });

  it('mantiene proyección del último estado y la reconstruye sin duplicar al repetir DDL', async () => {
    const antes = await cliente.query<{ secuencia: string; estado_nuevo: string }>(`
      SELECT secuencia::text, estado_nuevo FROM sigd_rut.estado_actual_expediente
      WHERE expediente_id = $1::uuid`, [expedienteUuid(105)]);
    expect(antes.rows).toEqual([{ secuencia: '2', estado_nuevo: 'RECEPCIONADO' }]);
    await cliente.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', 7)`,
    [expedienteUuid(105)]);
    const sql = readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8');
    await cliente.query(sql);
    const despues = await cliente.query<{ secuencia: string; estado_nuevo: string }>(`
      SELECT secuencia::text, estado_nuevo FROM sigd_rut.estado_actual_expediente
      WHERE expediente_id = $1::uuid`, [expedienteUuid(105)]);
    expect(despues.rows).toEqual([{ secuencia: '3', estado_nuevo: 'EN_CALIFICACION' }]);
    const indices = await cliente.query<{ indexname: string }>(`
      SELECT indexname FROM pg_indexes WHERE schemaname = 'sigd_rut'
        AND tablename = 'estado_actual_expediente'`);
    expect(indices.rows.map((fila) => fila.indexname)).toEqual(expect.arrayContaining([
      'ix_estado_actual_estado_expediente', 'ix_estado_actual_area_estado',
      'ix_estado_actual_expediente_conteo',
    ]));
  });

  it('reconstruye seis contadores exactos y los actualiza atómicamente al cambiar de pestaña', async () => {
    const leer = async () => (await cliente.query<{ pestana: string; cantidad: string }>(
      'SELECT pestana, cantidad::text FROM sigd_rut.contador_pestana_local ORDER BY pestana')).rows;
    const antes = await leer();
    expect(antes).toHaveLength(6);
    await insertar(777, '2026-09-25T09:00:00.123Z');
    await cliente.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ($1::uuid, 'RECEPCIONADO', 'INICIAR_CALIFICACION', 'EN_CALIFICACION', 7),
             ($1::uuid, 'EN_CALIFICACION', 'DERIVACION', 'DERIVADO', 7)`,
    [expedienteUuid(777)]);
    const despues = await leer();
    const porPestana = Object.fromEntries(despues.map((fila) => [fila.pestana, Number(fila.cantidad)]));
    const conteoReal = await cliente.query<{ pestana: string; cantidad: number }>(`
      SELECT sigd_rut.pestana_de_estado(estado_nuevo) pestana, count(*)::integer cantidad
        FROM sigd_rut.estado_actual_expediente GROUP BY 1`);
    for (const fila of conteoReal.rows) expect(porPestana[fila.pestana]).toBe(fila.cantidad);
    expect(porPestana.DERIVADOS).toBe(
      Number(antes.find((fila) => fila.pestana === 'DERIVADOS')?.cantidad) + 1);
    const sql = readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8');
    await cliente.query(sql);
    expect(await leer()).toEqual(despues);
    await expect(cliente.query(`UPDATE sigd_rut.contador_pestana_local
      SET cantidad = -1 WHERE pestana = 'DERIVADOS'`)).rejects.toMatchObject({ code: '23514' });
  });

  it('revierte contadores con la transacción y evita pérdida bajo escrituras concurrentes', async () => {
    const contar = async () => Number((await cliente.query<{ cantidad: string }>(`
      SELECT cantidad::text FROM sigd_rut.contador_pestana_local
      WHERE pestana = 'PENDIENTES'`)).rows[0].cantidad);
    const inicial = await contar();
    await cliente.query('BEGIN');
    await insertar(778, '2026-09-25T09:00:00.123Z');
    expect(await contar()).toBe(inicial + 1);
    await cliente.query('ROLLBACK');
    expect(await contar()).toBe(inicial);
    const a = new Client({ connectionString: contenedor.getConnectionUri() });
    const b = new Client({ connectionString: contenedor.getConnectionUri() });
    await Promise.all([a.connect(), b.connect()]);
    try {
      await Promise.all([a, b].map((conexion, indice) => conexion.query(`
        INSERT INTO sigd_rut.movimiento_tramite
          (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
        VALUES ($1::uuid, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', 7)`,
      [expedienteUuid(779 + indice)])));
      expect(await contar()).toBe(inicial + 2);
    } finally {
      await Promise.all([a.end(), b.end()]);
    }
  });
});
