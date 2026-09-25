import { readFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import type { Server } from 'node:http';
import path from 'node:path';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { construirApp } from '../../src/app.js';
import { codificarCursor } from '../../src/domains/rutadoc/rutadoc.cursor.js';
import { SQL_BANDEJA_LOCAL_RUTADOC, SQL_CONTADORES_LOCALES_RUTADOC, SQL_CONTADORES_RUTADOC, SQL_CONTADORES_SIN_TERMINO_RUTADOC,
  SQL_LISTAR_RUTADOC } from '../../src/domains/rutadoc/rutadoc.repository.js';
import { ESTADOS_POR_PESTANA } from '../../src/domains/rutadoc/rutadoc.types.js';
import type { ActorRutaDoc } from '../../src/domains/rutadoc/rutadoc.types.js';

const AREA = 'da7aa251-a027-47f3-8bfd-4cc94df486d1';
const actor: ActorRutaDoc = { id: '7', roles: ['SUPER_ADMIN'], puedeVerExpediente: () => true };

function estadisticas(valores: number[]) {
  const ordenados = [...valores].sort((a, b) => a - b);
  return { minimo: ordenados[0], mediana: (ordenados[9] + ordenados[10]) / 2,
    p95: ordenados[18], maximo: ordenados[19] };
}

function resumirPlan(nodo: unknown): unknown[] {
  if (!nodo || typeof nodo !== 'object') return [];
  const plan = nodo as Record<string, unknown>;
  const hijos = Array.isArray(plan.Plans) ? plan.Plans : [];
  return [{ tipo: plan['Node Type'], relacion: plan['Relation Name'],
    indice: plan['Index Name'], filas: plan['Actual Rows'],
    bloquesHit: plan['Shared Hit Blocks'], bloquesRead: plan['Shared Read Blocks'] },
  ...hijos.flatMap(resumirPlan)];
}

async function medir(nombre: string, ejecutar: () => Promise<{ filas: number }>) {
  for (let i = 0; i < 5; i += 1) await ejecutar();
  const tiempos: number[] = [];
  let filas = 0;
  for (let i = 0; i < 20; i += 1) {
    const inicio = performance.now();
    filas = (await ejecutar()).filas;
    tiempos.push(performance.now() - inicio);
  }
  console.log(JSON.stringify({ nombre, ejecuciones: 20, filas, ...estadisticas(tiempos) }));
}

describe('medición no bloqueante de RutaDoc con 50 000 expedientes', () => {
  it('EXPLAIN y 20 ejecuciones tras calentamiento para bandeja, contadores y endpoint', async () => {
    const contenedor = await new PostgreSqlContainer('postgres:18-alpine')
      .withDatabase('sigd_rutadoc_50k').start();
    const pool = new Pool({ connectionString: contenedor.getConnectionUri(), max: 8 });
    let servidor: Server | undefined;
    try {
      await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8'));
      await pool.query(`CREATE SCHEMA sigd_tra;
        CREATE TABLE sigd_tra.tramite (id_tramite BIGINT PRIMARY KEY, asunto TEXT NOT NULL,
          fk_remitente BIGINT NOT NULL);
        CREATE TABLE sigd_tra.expediente (id_expediente BIGINT PRIMARY KEY,
          codigo_expediente TEXT NOT NULL, fk_tramite BIGINT NOT NULL,
          creado_en TIMESTAMPTZ NOT NULL)`);
      // Reejecutar la migración propia tras el fixture externo instala su índice de bandeja.
      await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8'));
      await pool.query(`INSERT INTO sigd_tra.tramite (id_tramite, asunto, fk_remitente)
        SELECT 100000+n, 'Solicitud de laboratorio ' || (n % 100), 80
        FROM generate_series(1,50000) n`);
      await pool.query('ALTER TABLE sigd_tra.expediente DISABLE TRIGGER tr_rutadoc_contador_expediente');
      await pool.query(`INSERT INTO sigd_tra.expediente
        (id_expediente, codigo_expediente, fk_tramite, creado_en)
        SELECT 100000+n, 'EXP-2026-' || lpad(n::text, 6, '0'), 100000+n,
          '2026-09-24T09:00:00Z'::timestamptz + ((n % 2000) * interval '1 millisecond')
        FROM generate_series(1,50000) n`);
      await pool.query('ALTER TABLE sigd_tra.expediente ENABLE TRIGGER tr_rutadoc_contador_expediente');
      // Carga masiva aislada; la migración reconstruye los seis contadores
      // desde los 45 000 movimientos antes de medir cualquier consulta.
      await pool.query('ALTER TABLE sigd_rut.estado_actual_expediente DISABLE TRIGGER tr_contador_pestana_local');
      await pool.query(`INSERT INTO sigd_rut.movimiento_tramite
        (expediente_id, estado_anterior, evento, estado_nuevo,
         usuario_operador_id, fecha_hora, datos)
        SELECT 100000+n,
          (ARRAY['REGISTRADO','RECEPCIONADO','EN_CALIFICACION','EN_CALIFICACION',
                 'EN_REVISION','OBSERVADO','EN_REVISION','EN_FIRMA','RESUELTO'])[n%10],
          (ARRAY['RECEPCION','INICIAR_CALIFICACION','DERIVACION','INICIAR_REVISION',
                 'OBSERVACION','CORRECCION','ENVIAR_A_FIRMA','FIRMA','CIERRE'])[n%10],
          (ARRAY['RECEPCIONADO','EN_CALIFICACION','DERIVADO','EN_REVISION',
                 'OBSERVADO','SUBSANADO','EN_FIRMA','RESUELTO','ARCHIVADO'])[n%10],
          7, '2026-09-24T10:00:00Z'::timestamptz + ((n % 2000) * interval '1 millisecond'),
          jsonb_build_object('areaId', CASE WHEN n % 3 = 0 THEN $1::text ELSE 'otra-area' END)
        FROM generate_series(1,50000) n WHERE n % 10 <> 0`, [AREA]);
      await pool.query('ALTER TABLE sigd_rut.estado_actual_expediente ENABLE TRIGGER tr_contador_pestana_local');
      await pool.query(readFileSync(path.resolve(process.cwd(), 'migraciones/06_sigd_rut.sql'), 'utf8'));
      await pool.query('VACUUM ANALYZE sigd_tra.expediente');
      await pool.query('VACUUM ANALYZE sigd_tra.tramite');
      await pool.query('VACUUM ANALYZE sigd_rut.estado_actual_expediente');
      await pool.query('VACUUM ANALYZE sigd_rut.movimiento_tramite');
      const volumen = await pool.query<{ expedientes: string; movimientos: string;
        estados: string }>(`SELECT
        (SELECT count(*) FROM sigd_tra.expediente)::text expedientes,
        (SELECT count(*) FROM sigd_rut.movimiento_tramite)::text movimientos,
        (SELECT count(DISTINCT COALESCE(u.estado_nuevo, 'REGISTRADO'))
           FROM sigd_tra.expediente e LEFT JOIN sigd_rut.estado_actual_expediente u
             ON u.expediente_id = e.id_expediente)::text estados`);
      expect(volumen.rows[0]).toEqual({ expedientes: '50000', movimientos: '45000', estados: '10' });
      const sqlDirecto = `SELECT estado_nuevo, count(*)::integer total
        FROM sigd_rut.estado_actual_expediente GROUP BY estado_nuevo`;
      const sqlSinMovimiento = `SELECT count(*)::integer total
        FROM sigd_tra.expediente e
        WHERE NOT EXISTS (SELECT 1 FROM sigd_rut.estado_actual_expediente u
                          WHERE u.expediente_id = e.id_expediente)`;
      const actual = await pool.query(SQL_CONTADORES_SIN_TERMINO_RUTADOC,
        [null, null, null, null]);
      const agrupado = await pool.query<{ estado_nuevo: string; total: number }>(sqlDirecto);
      const faltantes = await pool.query<{ total: number }>(sqlSinMovimiento);
      const reconstruido: Record<string, number> = Object.fromEntries(
        Object.keys(actual.rows[0]).map((estado) => [estado, 0]));
      for (const fila of agrupado.rows) reconstruido[fila.estado_nuevo] = fila.total;
      reconstruido.REGISTRADO += faltantes.rows[0].total;
      expect(reconstruido).toEqual(actual.rows[0]);
      expect(faltantes.rows[0].total).toBe(5000);
      const locales = await pool.query<{ pestana: string; total: number }>(SQL_CONTADORES_LOCALES_RUTADOC);
      for (const [pestana, estados] of Object.entries(ESTADOS_POR_PESTANA)) {
        expect(locales.rows.find((fila) => fila.pestana === pestana)?.total)
          .toBe(estados.reduce((suma, estado) => suma + actual.rows[0][estado], 0));
      }
      for (const [nombre, sql] of [['B:proyeccion', sqlDirecto],
        ['C:sin_movimiento', sqlSinMovimiento],
        ['D:contador_transaccional', SQL_CONTADORES_LOCALES_RUTADOC]] as const) {
        const explain = await pool.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`);
        const detalle = explain.rows[0]['QUERY PLAN'][0];
        console.log(JSON.stringify({ comparacion: nombre, explainMs: detalle['Execution Time'],
          plan: resumirPlan(detalle.Plan) }));
      }
      await medir('B:proyeccion', async () => ({ filas: (await pool.query(sqlDirecto)).rowCount ?? 0 }));
      const pruebaIndice = await pool.connect();
      try {
        await pruebaIndice.query('BEGIN READ ONLY');
        await pruebaIndice.query('SET LOCAL enable_seqscan = off');
        const explain = await pruebaIndice.query<{
          'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlDirecto}`);
        const detalle = explain.rows[0]['QUERY PLAN'][0];
        console.log(JSON.stringify({ comparacion: 'B:indice_forzado',
          explainMs: detalle['Execution Time'], plan: resumirPlan(detalle.Plan) }));
        await medir('B:indice_forzado', async () => ({
          filas: (await pruebaIndice.query(sqlDirecto)).rowCount ?? 0 }));
        await pruebaIndice.query('COMMIT');
      } catch (error) {
        await pruebaIndice.query('ROLLBACK');
        throw error;
      } finally {
        pruebaIndice.release();
      }
      await medir('C:sin_movimiento', async () => ({ filas: (await pool.query(sqlSinMovimiento)).rowCount ?? 0 }));
      await medir('D:contador_transaccional', async () => ({
        filas: (await pool.query(SQL_CONTADORES_LOCALES_RUTADOC)).rowCount ?? 0 }));
      const app = construirApp(pool, { obtenerActorRutaDoc: () => actor });
      const servidorActivo = app.listen(0);
      servidor = servidorActivo;
      const escenarios = [
        { nombre: 'base', filtro: [null, null, null, null] },
        { nombre: 'cursor', filtro: [null, null, null, null], cursor: ['2026-09-24T09:00:01.900Z', '101900'] },
        { nombre: 'termino', filtro: ['laboratorio 42', null, null, null] },
        { nombre: 'area', filtro: [null, AREA, null, null] },
        { nombre: 'fechas', filtro: [null, null, '2026-09-24', '2026-09-24'] },
      ] as const;
      for (const escenario of escenarios) {
        const comunes = [...escenario.filtro];
        const cursor = 'cursor' in escenario ? escenario.cursor : undefined;
        const params = [...comunes, ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'],
          cursor?.[0] ?? null, cursor?.[1] ?? null, 21];
        const local = comunes.every((valor) => valor === null);
        const sqlContadores = local ? SQL_CONTADORES_LOCALES_RUTADOC :
          comunes[0] ? SQL_CONTADORES_RUTADOC : SQL_CONTADORES_SIN_TERMINO_RUTADOC;
        const valoresContadores = local ? [] : comunes;
        for (const [tipo, sql, valores] of [
          ['elementos', SQL_LISTAR_RUTADOC, params],
          ['contadores', sqlContadores, valoresContadores],
          ...(local ? [['endpoint_sql', SQL_BANDEJA_LOCAL_RUTADOC, params] as const] : []),
        ] as const) {
          const plan = await pool.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
            `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, valores);
          const detalle = plan.rows[0]['QUERY PLAN'][0];
          if (escenario.nombre === 'base' && tipo === 'elementos') {
            const nombres = resumirPlan(detalle.Plan).map((n) => (n as { indice?: string }).indice);
            expect(nombres).toContain('ix_rutadoc_expediente_fecha_id');
            expect(JSON.stringify(detalle.Plan)).not.toContain('movimiento_tramite_2026');
          }
          console.log(JSON.stringify({ escenario: escenario.nombre, tipo,
            explainMs: detalle['Execution Time'], plan: resumirPlan(detalle.Plan) }));
        }
        await medir(`${escenario.nombre}:elementos`, async () => {
          const res = await pool.query(SQL_LISTAR_RUTADOC, params);
          return { filas: res.rowCount ?? 0 };
        });
        await medir(`${escenario.nombre}:contadores`, async () => {
          const res = await pool.query(sqlContadores, valoresContadores);
          return { filas: res.rowCount ?? 0 };
        });
        const query: Record<string, string> = { pestana: 'PENDIENTES', limite: '20' };
        if (comunes[0]) query.terminoBusqueda = comunes[0];
        if (comunes[1]) query.areaId = comunes[1];
        if (comunes[2]) query.fechaDesde = comunes[2];
        if (comunes[3]) query.fechaHasta = comunes[3];
        if (cursor) query.cursor = codificarCursor({ fechaRadicacion: cursor[0],
          idExpediente: cursor[1] }, { pestana: 'PENDIENTES', limite: 20 });
        await medir(`${escenario.nombre}:endpoint`, async () => {
          const res = await request(servidorActivo).get('/api/v1/expedientes').query(query);
          expect(res.status).toBe(200);
          return { filas: res.body.elementos.length };
        });
      }
      for (const pestana of Object.keys(ESTADOS_POR_PESTANA)) {
        await medir(`pestana:${pestana}:endpoint`, async () => {
          const res = await request(servidorActivo).get('/api/v1/expedientes')
            .query({ pestana, limite: '20' });
          expect(res.status).toBe(200);
          return { filas: res.body.elementos.length };
        });
      }
      // Comprobación aislada del índice GIN: la expresión actual concatena
      // columnas de dos tablas y no debe atribuirse un beneficio no medido.
      await pool.query('CREATE EXTENSION IF NOT EXISTS pg_trgm');
      await pool.query(`CREATE INDEX ix_ensayo_cut_trgm ON sigd_tra.expediente
        USING gin (lower(codigo_expediente) gin_trgm_ops)`);
      await pool.query(`CREATE INDEX ix_ensayo_asunto_trgm ON sigd_tra.tramite
        USING gin (lower(asunto) gin_trgm_ops)`);
      await pool.query('ANALYZE sigd_tra.expediente');
      await pool.query('ANALYZE sigd_tra.tramite');
      for (const [nombre, sql, valores] of [
        ['termino:actual_con_GIN', SQL_CONTADORES_RUTADOC,
          ['laboratorio 42', null, null, null]],
        ['termino:asunto_GIN', `SELECT count(*) FROM sigd_tra.tramite
          WHERE lower(asunto) LIKE '%laboratorio 42%'`, []],
      ] as const) {
        const plan = await pool.query<{ 'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }> }>(
          `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql}`, [...valores]);
        const detalle = plan.rows[0]['QUERY PLAN'][0];
        console.log(JSON.stringify({ comparacion: nombre, explainMs: detalle['Execution Time'],
          plan: resumirPlan(detalle.Plan) }));
      }
    } finally {
      const paraCerrar = servidor;
      if (paraCerrar) await new Promise<void>((resolve, reject) => paraCerrar.close(
        (error) => error ? reject(error) : resolve()));
      await pool.end();
      await contenedor.stop();
    }
  });
});
