import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { obtenerCuellosBotella, obtenerKpisMensualesDesdeVista, obtenerResumen,
  obtenerTendencias } from '../../../../src/modules/reportes/reportes.service.js';
import { horasHabilesEntre } from '../../../../src/modules/reportes/kpi.service.js';
import { calcularSla } from '../../../../src/domains/rutadoc/sla.service.js';

let contenedor: StartedPostgreSqlContainer;
let pool: Pool;
const fecha = '2026-09-24T10:00:00.000Z';
let ids: string[];

async function crearExpediente(areaId: string, codigo: string, radicacion = fecha): Promise<string> {
  const persona = await pool.query<{ id_persona: string }>(
    "INSERT INTO sigd_auth.persona (tipo, id_documento) VALUES ('NATURAL', $1) RETURNING id_persona",
    [`R${randomUUID().replaceAll('-', '').slice(0, 18)}`],
  );
  const id = randomUUID();
  await pool.query(`INSERT INTO sigd_tra.expediente
    (expediente_id, codigo_expediente, numero, tipo_documental_id, solicitante_id,
     area_destino_id, fecha_radicacion)
    VALUES ($1::uuid, NULL, $2, $3::uuid, $4::uuid, $5::uuid, $6::timestamptz)`,
  [id, codigo, randomUUID(), persona.rows[0].id_persona, areaId, radicacion]);
  return id;
}

describe('Reporte de tendencias con identidad UUID en PostgreSQL 18 temporal', () => {
  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine').withDatabase('sigd_reportes_uuid_test').start();
    pool = new Pool({ connectionString: contenedor.getConnectionUri() });
    for (const nombre of ['01_sigd_audit.sql', '02_sigd_auth.sql', '03_sigd_org.sql',
      '04_sigd_doc.sql', '05_sigd_tra.sql']) {
      await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones', nombre), 'utf8'));
    }
    // Proyección de lectura efímera; el baseline productivo aún no existe.
    await pool.query(`CREATE SCHEMA sigd_rut;
      CREATE TABLE sigd_rut.estado_actual_expediente (
        expediente_id UUID PRIMARY KEY REFERENCES sigd_tra.expediente(expediente_id),
        estado_nuevo TEXT NOT NULL, area_actual_id TEXT, fecha_hora TIMESTAMPTZ);
      CREATE TABLE sigd_rut.movimiento_tramite (
        expediente_id UUID NOT NULL REFERENCES sigd_tra.expediente(expediente_id),
        secuencia BIGINT NOT NULL, estado_nuevo TEXT NOT NULL, fecha_hora TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (expediente_id, secuencia));`);
    await pool.query(`CREATE TABLE sigd_rut.movimiento_compensatorio
      (LIKE sigd_rut.movimiento_tramite INCLUDING ALL)`);
    const areas = await pool.query<{ area_id: string }>(`INSERT INTO sigd_org.area (codigo, nombre, path)
      VALUES ('REP-A', 'Área A', 'rep_a'), ('REP-B', 'Área B', 'rep_b') RETURNING area_id`);
    ids = await Promise.all([
      crearExpediente(areas.rows[0].area_id, 'REPA-1'),
      crearExpediente(areas.rows[0].area_id, 'REPA-2'),
      crearExpediente(areas.rows[1].area_id, 'REPB-1'),
      crearExpediente(areas.rows[1].area_id, 'REPB-2'),
    ]);
    await crearExpediente(areas.rows[0].area_id, 'REPA-ANTIGUO', '2026-01-01T10:00:00.000Z');
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, secuencia, estado_nuevo, fecha_hora)
      VALUES ($1::uuid, 1, 'REGISTRADO', $4::timestamptz),
             ($1::uuid, 2, 'RESUELTO', $5::timestamptz),
             ($2::uuid, 1, 'ARCHIVADO', $6::timestamptz),
             ($3::uuid, 1, 'OBSERVADO', $4::timestamptz)`,
    [...ids.slice(0, 3), fecha, '2026-10-01T10:00:00.000Z', '2026-09-25T10:00:00.000Z']);
    await pool.query(`INSERT INTO sigd_rut.estado_actual_expediente
      (expediente_id, estado_nuevo, fecha_hora)
      VALUES ($1::uuid, 'RESUELTO', $4::timestamptz),
             ($2::uuid, 'ARCHIVADO', $4::timestamptz),
             ($3::uuid, 'OBSERVADO', $4::timestamptz)`, [...ids.slice(0, 3), fecha]);
    await pool.query(`INSERT INTO sigd_tra.asiento_registro
      (expediente_id, fecha_ingreso, asunto)
      VALUES ($1::uuid, $2::timestamptz, 'Ingreso original'),
             ($1::uuid, $3::timestamptz, 'Segundo asiento')`,
    [ids[0], fecha, '2026-09-25T10:00:00.000Z']);
    await pool.query(`CREATE MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual AS
      SELECT date_trunc('month', e.fecha_radicacion)::date AS periodo,
             COALESCE(e.area_destino_id::text, 'SIN_AREA') AS unidad_organica_id,
             COUNT(*)::bigint AS n_radicados,
             COUNT(*) FILTER (WHERE a.estado_nuevo = 'RESUELTO')::bigint AS n_atendidos,
             COUNT(*) FILTER (WHERE a.estado_nuevo = 'ARCHIVADO')::bigint AS n_archivados,
             COUNT(*) FILTER (WHERE a.estado_nuevo IN ('RESUELTO', 'ARCHIVADO'))::bigint AS n_resueltos,
             COUNT(*) FILTER (WHERE a.estado_nuevo NOT IN ('RESUELTO', 'ARCHIVADO')
                               OR a.estado_nuevo IS NULL)::bigint AS n_en_tramite,
             COUNT(*) FILTER (WHERE a.estado_nuevo = 'OBSERVADO')::bigint AS n_observados,
             COUNT(*) FILTER (WHERE a.estado_nuevo = 'RESUELTO')::bigint AS n_resueltos_dentro_plazo,
             10::numeric AS horas_habiles_suma
        FROM sigd_tra.expediente e
        LEFT JOIN sigd_rut.estado_actual_expediente a ON a.expediente_id = e.expediente_id
       GROUP BY 1, 2`);
  });

  afterAll(async () => {
    await pool?.end();
    await contenedor?.stop();
  });

  it('cuenta una vez cada UUID de dos unidades aunque haya varios movimientos', async () => {
    const resultado = await obtenerTendencias(pool, {
      desde: '2026-09-01', hasta: '2026-09-30', granularidad: 'MENSUAL', limite: 24,
    });
    expect(resultado).toEqual({
      periodo: { desde: '2026-09-01', hasta: '2026-09-30' },
      granularidad: 'MENSUAL',
      serie: [{ periodo: '2026-09-01', etiqueta: '2026-09-01', mes: 9,
        radicados: 4, atendidos: 2, observados: 1, vtep: 50 }],
    });
  });

  it('conserva el expediente sin movimiento y devuelve serie vacía sin datos', async () => {
    const vacio = await obtenerTendencias(pool, {
      desde: '2026-10-01', hasta: '2026-10-31', granularidad: 'MENSUAL', limite: 24,
    });
    expect(vacio.serie).toEqual([]);
    const diario = await obtenerTendencias(pool, {
      desde: '2026-09-24', hasta: '2026-09-24', granularidad: 'DIARIA', limite: 24,
    });
    expect(diario.serie[0].radicados).toBe(4);
  });

  it('mantiene los filtros como parámetros SQL', async () => {
    await expect(obtenerTendencias(pool, {
      desde: "2026-09-01' OR true --", hasta: '2026-09-30', granularidad: 'MENSUAL', limite: 24,
    })).rejects.toThrow();
    expect((await pool.query('SELECT COUNT(*)::int AS n FROM sigd_tra.expediente')).rows[0].n).toBe(5);
  });

  it('consolida dos unidades sin promediar porcentajes y separa calendario de horas hábiles', async () => {
    const mensual = await obtenerKpisMensualesDesdeVista(pool, '2026-09-01', '2026-09-30');
    expect(mensual).toEqual([{ periodo: '2026-09-01', radicados: 4,
      vtep: 50, tro: 50, teo: 50, tpr_horas_calendario: 96 }]);
    const intervalo = await pool.query<{ horas: number }>(`SELECT
      (EXTRACT(EPOCH FROM (TIMESTAMPTZ '2026-10-01 10:00:00+00' -
                           TIMESTAMPTZ '2026-09-24 10:00:00+00')) / 3600)::float8 AS horas`);
    expect(intervalo.rows[0].horas).toBe(168);
    expect(horasHabilesEntre(new Date(fecha), new Date('2026-10-01T10:00:00.000Z'))).toBe(120);
    const resumen = await obtenerResumen(pool, { desde: '2026-09-01', hasta: '2026-09-30' });
    expect(resumen.totalRadicados).toBe(4);
    expect(resumen.totalResueltos).toBe(2);
    expect(resumen.tprHorasHabiles.valor).toBe(72);
    expect(resumen.tprHorasHabiles.valor).not.toBe(mensual[0].tpr_horas_calendario);
  });

  it('conserva NULL sin cierres y aplica filtro UUID de área', async () => {
    const area = await pool.query<{ area_destino_id: string }>(
      'SELECT area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [ids[0]]);
    const resumen = await obtenerResumen(pool, { desde: '2026-09-01', hasta: '2026-09-30',
      areaId: area.rows[0].area_destino_id });
    expect(resumen.totalRadicados).toBe(2);
    expect(resumen.totalResueltos).toBe(2);
    expect(resumen.tprHorasHabiles.valor).toBe(72);
    const otraArea = await pool.query<{ area_destino_id: string }>(
      'SELECT area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [ids[2]]);
    const sinCierre = await obtenerResumen(pool, { desde: '2026-09-01', hasta: '2026-09-30',
      areaId: otraArea.rows[0].area_destino_id });
    expect(sinCierre.totalRadicados).toBe(2);
    expect(sinCierre.totalResueltos).toBe(0);
    expect(sinCierre.tprHorasHabiles.valor).toBeNull();
    const enero = await obtenerKpisMensualesDesdeVista(pool, '2026-01-01', '2026-01-31');
    expect(enero).toEqual([{ periodo: '2026-01-01', radicados: 1,
      vtep: 0, tro: null, teo: 0, tpr_horas_calendario: null }]);
  });

  it('agrupa cuellos por área y estado sin duplicar movimientos ni perder expedientes sin movimiento', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
    try {
      const cuellos = await obtenerCuellosBotella(pool, {
        desde: '2026-01-01', hasta: '2026-09-30', limite: 20,
      });
      expect(cuellos.cuelloBotella.reduce((n, fila) => n + fila.expedientes, 0)).toBe(3);
      const registrados = cuellos.cuelloBotella.filter((fila) => fila.estado === 'REGISTRADO');
      expect(registrados.reduce((n, fila) => n + fila.expedientes, 0)).toBe(2);
      expect(registrados.reduce((n, fila) => n + fila.vencido, 0)).toBe(1);
      expect(registrados.find((fila) => fila.vencido === 1)?.nivelAlerta).toBe('ALTO');
      expect(cuellos.cuelloBotella.map((fila) => Object.keys(fila).sort())).toEqual(
        cuellos.cuelloBotella.map(() => ['area', 'areaId', 'diasMaximo', 'diasPromedio',
          'estado', 'expedientes', 'horasPromedio', 'nivelAlerta', 'proporcion', 'vencido'].sort()));
    } finally {
      vi.useRealTimers();
    }
  });

  it('recalcula tasas desde numeradores de unidades desiguales y ordena varios períodos', async () => {
    const area = await pool.query<{ area_destino_id: string }>(
      'SELECT area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [ids[2]]);
    await crearExpediente(area.rows[0].area_destino_id, 'REPB-3');
    await pool.query('REFRESH MATERIALIZED VIEW sigd_tra.mv_kpis_mgd_mensual');
    const meses = await obtenerKpisMensualesDesdeVista(pool, '2026-01-01', '2026-09-30');
    expect(meses.map((fila) => [fila.periodo, fila.radicados, fila.vtep])).toEqual([
      ['2026-01-01', 1, 0], ['2026-09-01', 5, 40],
    ]);
    expect(meses[1].tpr_horas_calendario).toBe(96);
  });

  it('traduce AMARILLO del motor SLA a alerta media sin umbral propio', async () => {
    const area = await pool.query<{ area_destino_id: string }>(
      'SELECT area_destino_id FROM sigd_tra.expediente WHERE expediente_id = $1::uuid', [ids[2]]);
    await crearExpediente(area.rows[0].area_destino_id, 'REPB-ALERTA', '2026-09-01T10:00:00.000Z');
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-11T12:00:00.000Z'));
    try {
      expect(calcularSla({ fechaInicio: '2026-09-01', fechaActual: '2026-10-11' }).estado)
        .toBe('AMARILLO');
      const cuellos = await obtenerCuellosBotella(pool, {
        desde: '2026-09-01', hasta: '2026-09-01', limite: 20,
      });
      expect(cuellos.cuelloBotella).toMatchObject([
        { estado: 'REGISTRADO', expedientes: 1, vencido: 0, nivelAlerta: 'MEDIO' },
      ]);
    } finally {
      vi.useRealTimers();
    }
  });
});
