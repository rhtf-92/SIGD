import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll } from 'vitest';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Client, Pool, type PoolClient } from 'pg';
import {
  ejecutarMigraciones,
  listarMigracionesAplicadas,
  SIGD_MIGRATION_ADVISORY_LOCK_ID,
} from '../../../../src/db/migrate.js';

const URL_BASE = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
const LOCK_ID_PRUEBA = 987654321;

const suiteDb = URL_BASE ? describe : describe.skip;

suiteDb('Pipeline DDL · ejecutarMigraciones (advisory lock, checksum e idempotencia)', () => {
  let pool: Pool;
  let dirTemporal: string;
  let lockIdPrevio: string | undefined;

  beforeAll(() => {
    pool = new Pool({ connectionString: URL_BASE, max: 10 });
    dirTemporal = fs.mkdtempSync(path.join(os.tmpdir(), 'sigd-migrate-'));
    lockIdPrevio = process.env.MIGRATE_ADVISORY_LOCK_ID;
  });

  beforeEach(async () => {
    for (const archivo of fs.readdirSync(dirTemporal)) {
      fs.rmSync(path.join(dirTemporal, archivo));
    }
    process.env.MIGRATIONS_DIR = dirTemporal;
    process.env.MIGRATE_ADVISORY_LOCK_ID = String(LOCK_ID_PRUEBA);
    await pool.query('DROP TABLE IF EXISTS public.sigd_migraciones');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_a');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_b');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_rota');
  });

  afterEach(() => {
    if (lockIdPrevio === undefined) {
      delete process.env.MIGRATE_ADVISORY_LOCK_ID;
    } else {
      process.env.MIGRATE_ADVISORY_LOCK_ID = lockIdPrevio;
    }
  });

  afterAll(async () => {
    await pool.query('DROP TABLE IF EXISTS public.sigd_migraciones');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_a');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_b');
    await pool.query('DROP TABLE IF EXISTS public.mig_prueba_rota');
    fs.rmSync(dirTemporal, { recursive: true, force: true });
    await pool.end();
  });

  function escribirScript(nombre: string, sql: string): string {
    const ruta = path.join(dirTemporal, nombre);
    fs.writeFileSync(ruta, sql, 'utf-8');
    return ruta;
  }

  function sembrarScriptsValidos(): void {
    escribirScript('01_prueba.sql', 'CREATE TABLE IF NOT EXISTS public.mig_prueba_a (id INT PRIMARY KEY);');
    escribirScript('02_prueba.sql', 'CREATE TABLE IF NOT EXISTS public.mig_prueba_b (id INT PRIMARY KEY);');
  }

  async function adquirirLockExterno(cliente: Pick<PoolClient, 'query'>, lockId: number): Promise<void> {
    await cliente.query('SELECT pg_advisory_lock($1)', [lockId]);
  }

  it('expone el identificador de advisory lock canonico del plan (§7.4.6 T-BE-CL-01)', () => {
    expect(SIGD_MIGRATION_ADVISORY_LOCK_ID).toBe(987654321);
  });

  it('aplica los scripts en orden estricto 01 -> 06 y registra el checksum SHA-256', async () => {
    sembrarScriptsValidos();

    const aplicadas = await ejecutarMigraciones(pool);

    expect(aplicadas).toEqual(['01_prueba.sql', '02_prueba.sql']);

    const registro = await listarMigracionesAplicadas(pool);
    expect(registro.map((r) => r.nombre_script)).toEqual(['01_prueba.sql', '02_prueba.sql']);

    const contenido = fs.readFileSync(path.join(dirTemporal, '01_prueba.sql'), 'utf-8');
    expect(registro[0].checksum_sha256).toBe(crypto.createHash('sha256').update(contenido).digest('hex'));

    const tablas = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name IN ('mig_prueba_a', 'mig_prueba_b')`,
    );
    expect(tablas.rows[0].n).toBe(2);
  });

  it('es idempotente: la segunda ejecucion no reaplica ningun script', async () => {
    sembrarScriptsValidos();

    const primera = await ejecutarMigraciones(pool);
    const segunda = await ejecutarMigraciones(pool);

    expect(primera).toHaveLength(2);
    expect(segunda).toEqual([]);

    const registros = await listarMigracionesAplicadas(pool);
    expect(registros).toHaveLength(2);
  });

  it('rechaza con rollback la alteracion de un script ya aplicado (integridad DDL)', async () => {
    sembrarScriptsValidos();
    await ejecutarMigraciones(pool);

    escribirScript('01_prueba.sql', 'CREATE TABLE IF NOT EXISTS public.mig_prueba_a (id BIGINT PRIMARY KEY);');

    await expect(ejecutarMigraciones(pool)).rejects.toThrow(/Error de Integridad DDL/);

    const registros = await listarMigracionesAplicadas(pool);
    expect(registros.map((r) => r.nombre_script)).toEqual(['01_prueba.sql', '02_prueba.sql']);
    expect(registros[0].checksum_sha256).not.toBe(
      crypto
        .createHash('sha256')
        .update(fs.readFileSync(path.join(dirTemporal, '01_prueba.sql'), 'utf-8'))
        .digest('hex'),
    );
  });

  it('libera el advisory lock al finalizar correctamente', async () => {
    sembrarScriptsValidos();
    await ejecutarMigraciones(pool);

    const verificador = new Client({ connectionString: URL_BASE });
    await verificador.connect();
    try {
      const sondeo = await verificador.query<{ adquirido: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS adquirido',
        [LOCK_ID_PRUEBA],
      );
      expect(sondeo.rows[0].adquirido).toBe(true);
      await verificador.query('SELECT pg_advisory_unlock($1)', [LOCK_ID_PRUEBA]);
    } finally {
      await verificador.end();
    }
  });

  it('libera el advisory lock incluso cuando una migracion falla', async () => {
    escribirScript('01_prueba_rota.sql', 'CREATE TABLE public.mig_prueba_rota (id INT); SELECT 1/0;');

    await expect(ejecutarMigraciones(pool)).rejects.toThrow();

    const verificador = new Client({ connectionString: URL_BASE });
    await verificador.connect();
    try {
      const sondeo = await verificador.query<{ adquirido: boolean }>(
        'SELECT pg_try_advisory_lock($1) AS adquirido',
        [LOCK_ID_PRUEBA],
      );
      expect(sondeo.rows[0].adquirido).toBe(true);
      await verificador.query('SELECT pg_advisory_unlock($1)', [LOCK_ID_PRUEBA]);
    } finally {
      await verificador.end();
    }
  });

  it('una replica concurrente espera pasivamente y NO ejecuta el DDL en paralelo', async () => {
    sembrarScriptsValidos();

    const titular = new Client({ connectionString: URL_BASE });
    await titular.connect();
    await adquirirLockExterno(titular, LOCK_ID_PRUEBA);

    try {
      await expect(ejecutarMigraciones(pool, { timeoutLockMs: 200 })).rejects.toThrow(
        /No se pudo adquirir el Advisory Lock/,
      );

      const control = new Client({ connectionString: URL_BASE });
      await control.connect();
      try {
        const aplicadas = await control.query<{ n: number }>(
          `SELECT COUNT(*)::int AS n FROM information_schema.tables
            WHERE table_schema = 'public' AND table_name IN ('mig_prueba_a', 'mig_prueba_b')`,
        );
        expect(aplicadas.rows[0].n).toBe(0);
      } finally {
        await control.end();
      }
    } finally {
      await titular.query('SELECT pg_advisory_unlock($1)', [LOCK_ID_PRUEBA]);
      await titular.end();
    }

    const aplicadas = await ejecutarMigraciones(pool, { timeoutLockMs: 5000 });
    expect(aplicadas).toEqual(['01_prueba.sql', '02_prueba.sql']);
  });

  it('dos runners simultaneos sobre el mismo lock ID aplican cada script una sola vez', async () => {
    sembrarScriptsValidos();

    const [primera, segunda] = await Promise.all([
      ejecutarMigraciones(pool, { timeoutLockMs: 10_000 }),
      ejecutarMigraciones(pool, { timeoutLockMs: 10_000 }),
    ]);

    expect(primera.length + segunda.length).toBe(2);
    expect((await listarMigracionesAplicadas(pool)).length).toBe(2);
  });

  it('falla de forma explicita si MIGRATE_ADVISORY_LOCK_ID no es un entero', async () => {
    sembrarScriptsValidos();
    process.env.MIGRATE_ADVISORY_LOCK_ID = 'no-es-un-entero';

    await expect(ejecutarMigraciones(pool)).rejects.toThrow(/MIGRATE_ADVISORY_LOCK_ID inválido/);
  });

  it('falla de forma explicita si el directorio de migraciones no existe', async () => {
    process.env.MIGRATIONS_DIR = path.join(dirTemporal, 'inexistente');

    await expect(ejecutarMigraciones(pool)).rejects.toThrow(/No existe el directorio de migraciones/);
  });
});