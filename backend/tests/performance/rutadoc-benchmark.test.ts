import { performance } from 'node:perf_hooks';
import type { Server } from 'node:http';
import { Pool } from 'pg';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { construirApp } from '../../src/app.js';
import { codificarCursor } from '../../src/domains/rutadoc/rutadoc.cursor.js';
import {
  SQL_BANDEJA_LOCAL_RUTADOC,
  SQL_CONTADORES_LOCALES_RUTADOC,
  SQL_CONTADORES_RUTADOC,
  SQL_CONTADORES_SIN_TERMINO_RUTADOC,
  SQL_LISTAR_RUTADOC,
} from '../../src/domains/rutadoc/rutadoc.repository.js';
import { ESTADOS_POR_PESTANA } from '../../src/domains/rutadoc/rutadoc.types.js';
import type { ActorRutaDoc } from '../../src/domains/rutadoc/rutadoc.types.js';

/**
 * Benchmark institucional no bloqueante de RutaDoc adaptado a B_JACOBO.
 * Opera exclusivamente sobre sigd_jacobo_demo en modo estrictamente de solo lectura
 * utilizando el rol técnico de privilegios mínimos 'sigd_test_ro'.
 * Queda prohibida la creación de contenedores adicionales (Testcontainers) o la inserción masiva artificial.
 */

const posiblesRutasEnv = [
  path.resolve(__dirname, '../../.env.test'),
  path.resolve(process.cwd(), '.env.test'),
  path.resolve(process.cwd(), 'backend/.env.test'),
];
for (const ruta of posiblesRutasEnv) {
  if (fs.existsSync(ruta)) {
    dotenv.config({ path: ruta, override: true });
    break;
  }
}

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  'postgres://sigd_test_ro@127.0.0.1:5433/sigd_jacobo_demo';

const AREA = 'da7aa251-a027-47f3-8bfd-4cc94df486d1';
const actor: ActorRutaDoc = {
  id: '7',
  roles: ['SUPER_ADMIN'],
  puedeVerExpediente: () => true,
  obtenerAlcanceBandeja: async () => ({ accesoGlobal: true, solicitanteId: null }),
};

function estadisticas(valores: number[]) {
  const ordenados = [...valores].sort((a, b) => a - b);
  const n = ordenados.length;
  return {
    minimo: ordenados[0],
    mediana: (ordenados[Math.floor(n / 2) - 1] + ordenados[Math.floor(n / 2)]) / 2,
    p95: ordenados[Math.floor(n * 0.95)],
    maximo: ordenados[n - 1],
  };
}

function resumirPlan(nodo: unknown): unknown[] {
  if (!nodo || typeof nodo !== 'object') return [];
  const plan = nodo as Record<string, unknown>;
  const hijos = Array.isArray(plan.Plans) ? plan.Plans : [];
  return [
    {
      tipo: plan['Node Type'],
      relacion: plan['Relation Name'],
      indice: plan['Index Name'],
      filas: plan['Actual Rows'],
      bloquesHit: plan['Shared Hit Blocks'],
      bloquesRead: plan['Shared Read Blocks'],
    },
    ...hijos.flatMap(resumirPlan),
  ];
}

async function medir(nombre: string, ejecutar: () => Promise<{ filas: number }>) {
  for (let i = 0; i < 3; i += 1) await ejecutar();
  const tiempos: number[] = [];
  let filas = 0;
  for (let i = 0; i < 10; i += 1) {
    const inicio = performance.now();
    filas = (await ejecutar()).filas;
    tiempos.push(performance.now() - inicio);
  }
  console.log(JSON.stringify({ nombre, ejecuciones: 10, filas, ...estadisticas(tiempos) }));
}

describe('Medición de rendimiento no bloqueante de RutaDoc en sigd_jacobo_demo (Solo Lectura)', () => {
  it('EXPLAIN ANALYZE y mediciones de rendimiento sobre datos institucionales existentes', async () => {
    const pool = new Pool({ connectionString: DATABASE_URL, max: 4 });
    let servidor: Server | undefined;

    try {
      // 1. Verificación estricta de base de datos oficial y rol
      const check = await pool.query<{ db: string; usr: string }>('SELECT current_database() AS db, current_user AS usr');
      const dbActual = check.rows[0]?.db;
      const usrActual = check.rows[0]?.usr;
      if (dbActual !== 'sigd_jacobo_demo') {
        throw new Error(`[BENCHMARK] Abortado: conectado a "${dbActual}". Exclusivo para "sigd_jacobo_demo".`);
      }
      console.log(`[BENCHMARK] Conexión verificada a "${dbActual}" con rol técnico "${usrActual}".`);

      // 2. Blindaje a nivel de PostgreSQL: forzar sesión en solo lectura
      await pool.query('SET default_transaction_read_only = on');

      // 3. Verificación de volumen institucional existente (sin alterar datos)
      const volumen = await pool.query<{
        expedientes: string;
        movimientos: string;
      }>(`SELECT
        (SELECT count(*) FROM sigd_tra.expediente)::text expedientes,
        (SELECT count(*) FROM sigd_rut.movimiento_tramite)::text movimientos`);

      console.log('[BENCHMARK] Volumen institucional existente en sigd_jacobo_demo:', volumen.rows[0]);
      expect(Number(volumen.rows[0].expedientes)).toBeGreaterThan(0);

      // 4. Medición de contadores locales de RutaDoc
      const sqlContadores = SQL_CONTADORES_LOCALES_RUTADOC;
      const explainContadores = await pool.query<{
        'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }>;
      }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sqlContadores}`);

      const detalleContadores = explainContadores.rows[0]['QUERY PLAN'][0];
      console.log(
        JSON.stringify({
          comparacion: 'SQL_CONTADORES_LOCALES_RUTADOC',
          explainMs: detalleContadores['Execution Time'],
          plan: resumirPlan(detalleContadores.Plan),
        }),
      );
      expect(detalleContadores['Execution Time']).toBeLessThan(50); // < 50ms

      await medir('contadores_locales_rutadoc', async () => {
        const res = await pool.query(sqlContadores);
        return { filas: res.rowCount ?? 0 };
      });

      // 5. Medición de consulta de listado de expedientes con paginación
      const paramsListar = [null, null, null, null, true, null, ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'], null, null, 20];
      const explainListar = await pool.query<{
        'QUERY PLAN': Array<{ 'Execution Time': number; Plan: unknown }>;
      }>(`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${SQL_LISTAR_RUTADOC}`, paramsListar);

      const detalleListar = explainListar.rows[0]['QUERY PLAN'][0];
      console.log(
        JSON.stringify({
          comparacion: 'SQL_LISTAR_RUTADOC',
          explainMs: detalleListar['Execution Time'],
          plan: resumirPlan(detalleListar.Plan),
        }),
      );
      expect(detalleListar['Execution Time']).toBeLessThan(100);

      await medir('listar_expedientes_rutadoc', async () => {
        const res = await pool.query(SQL_LISTAR_RUTADOC, paramsListar);
        return { filas: res.rowCount ?? 0 };
      });

      // 6. Medición del endpoint HTTP en memoria
      const app = construirApp(pool, { obtenerActorRutaDoc: () => actor });
      const servidorActivo = app.listen(0);
      servidor = servidorActivo;

      const queryHttp: Record<string, string> = { pestana: 'PENDIENTES', limite: '20' };
      await medir('endpoint_expedientes_http', async () => {
        const res = await request(servidorActivo).get('/api/v1/expedientes').query(queryHttp);
        expect(res.status).toBe(200);
        return { filas: res.body.elementos?.length ?? 0 };
      });
    } finally {
      if (servidor) {
        await new Promise<void>((resolve, reject) => servidor!.close((err) => (err ? reject(err) : resolve())));
      }
      await pool.end();
    }
  });
});
