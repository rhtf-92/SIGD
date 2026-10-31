import { randomUUID } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ejecutarMigraciones } from '../../../../src/db/migrate.js';
import { RepositorioPostgresRutaDoc } from '../../../../src/domains/rutadoc/rutadoc.repository.js';
import { RepositorioMgdAnalytics } from '../../../../src/domains/corelink/mgdAnalytics.repository.js';

// Nunca utiliza DATABASE_URL ni TEST_DATABASE_URL: sólo el contenedor creado aquí.
describe('Pipeline real 01..07 y contrato UUID', () => {
  let contenedor: StartedPostgreSqlContainer;
  let pool: Pool;
  const expediente = randomUUID();

  beforeAll(async () => {
    contenedor = await new PostgreSqlContainer('postgres:18-alpine').start();
    pool = new Pool({ connectionString: contenedor.getConnectionUri() });
  });
  afterAll(async () => {
    await pool?.end();
    await contenedor?.stop();
  });

  it('permite revertir todo el DDL, incluida la migración 06', async () => {
    const cliente = await pool.connect();
    try {
      await cliente.query('BEGIN');
      const directorio = path.resolve('migraciones');
      for (const archivo of readdirSync(directorio).filter(n => n.endsWith('.sql')).sort()) {
        await cliente.query(readFileSync(path.join(directorio, archivo), 'utf8'));
      }
      await cliente.query('ROLLBACK');
      expect((await cliente.query("SELECT to_regclass('sigd_rut.movimiento_tramite') AS tabla")).rows[0].tabla)
        .toBeNull();
    } finally {
      await cliente.query('ROLLBACK');
      cliente.release();
    }
  });

  it('instala siete migraciones, conserva checksums y no reinserta semillas ficticias', async () => {
    expect(await ejecutarMigraciones(pool)).toHaveLength(7);
    expect(await ejecutarMigraciones(pool)).toEqual([]);
    expect((await pool.query('SELECT count(*)::int AS total FROM sigd_auth.notificacion_casilla'))
      .rows[0].total).toBe(0);
  });

  it('lee expedientes y folios de 05, conserva secuencias y refresca los reportes activos', async () => {
    const persona = randomUUID();
    await pool.query(`INSERT INTO sigd_auth.persona (id_persona, tipo, id_documento)
      VALUES ($1, 'NATURAL', 'FIXTURE-UUID')`, [persona]);
    await pool.query(`INSERT INTO sigd_tra.expediente
      (expediente_id, numero, tipo_documental_id, solicitante_id, fecha_radicacion)
      VALUES ($1, 'FIXTURE-UUID', $2, $3, '2026-10-26T13:00:00Z')`,
    [expediente, randomUUID(), persona]);
    await pool.query(`INSERT INTO sigd_tra.tramite (expediente_id, asunto)
      VALUES ($1, 'Expediente de prueba aislada')`, [expediente]);
    await pool.query(`INSERT INTO sigd_tra.expediente_documento_folio
      (expediente_id, id_documento, folio_inicio, folio_fin) VALUES ($1, $2, 1, 3)`,
    [expediente, randomUUID()]);
    await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
      (expediente_id, estado_anterior, evento, estado_nuevo, usuario_operador_id)
      VALUES ($1, 'REGISTRADO', 'RECEPCION', 'RECEPCIONADO', $2)`, [expediente, randomUUID()]);
    const detalle = await new RepositorioPostgresRutaDoc(pool).obtener(expediente);
    expect(detalle).toMatchObject({ idExpediente: expediente, solicitanteId: persona, asunto: 'Expediente de prueba aislada',
      estadoActual: 'RECEPCIONADO', resumenDocumentos: { cantidadDocumentos: 1, totalFolios: 3 } });
    const repo = new RepositorioPostgresRutaDoc(pool);
    const pagina = await repo.listar({ pestana: 'PENDIENTES', limite: 20 }, ['RECEPCIONADO'], null);
    expect(pagina.elementos[0].idExpediente).toBe(expediente);
    expect((await pool.query('SELECT ultima_secuencia::text AS valor FROM sigd_rut.movimiento_secuencia'))
      .rows[0].valor).toBe('1');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_kpis_mgd_mensual');
    await pool.query('REFRESH MATERIALIZED VIEW CONCURRENTLY sigd_tra.mv_tiempos_retencion_area');
    const reportes = new RepositorioMgdAnalytics(pool);
    expect((await reportes.obtenerContadores(null))[0].contadores.nRadicados).toBe(1);
    expect(await reportes.obtenerRetencion(null)).toHaveLength(1);
  });
});
