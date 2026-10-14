import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { Pool } from 'pg';

import { ejecutarMigraciones } from '../../../src/db/migrate.js';

const MIGRACION_15 = '15_sigd_auth_refresh_token_text.sql';

describe('runner de producción con migración 15 sobre PostgreSQL real', () => {
  let pool: Pool;
  let directorioTemporal: string;
  let migrationsDirAnterior: string | undefined;

  beforeAll(() => {
    if (!process.env.TEST_DATABASE_URL) throw new Error('TEST_DATABASE_URL no configurada por globalSetup');
    pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
  });

  beforeEach(async () => {
    migrationsDirAnterior = process.env.MIGRATIONS_DIR;
    directorioTemporal = mkdtempSync(path.join(tmpdir(), 'sigd-runner-produccion-'));
    process.env.MIGRATIONS_DIR = directorioTemporal;

    await pool.query('DELETE FROM sigd_auth.sesion_usuario');
    await pool.query('DROP TABLE IF EXISTS public.sigd_migraciones');
    await pool.query(`
      ALTER TABLE sigd_auth.sesion_usuario
      ALTER COLUMN refresh_token TYPE VARCHAR(255)
    `);

    const sqlMigracion15 = readFileSync(path.resolve('migraciones', MIGRACION_15), 'utf8');
    writeFileSync(path.join(directorioTemporal, MIGRACION_15), sqlMigracion15, 'utf8');
  });

  afterEach(async () => {
    await pool.query('ALTER TABLE sigd_auth.sesion_usuario ALTER COLUMN refresh_token TYPE TEXT');
    await pool.query('ALTER TABLE sigd_auth.sesion_usuario DROP COLUMN IF EXISTS rollback_probe');
    await pool.query('DROP TABLE IF EXISTS public.sigd_migraciones');
    rmSync(directorioTemporal, { recursive: true, force: true });
    if (migrationsDirAnterior === undefined) delete process.env.MIGRATIONS_DIR;
    else process.env.MIGRATIONS_DIR = migrationsDirAnterior;
  });

  afterAll(async () => {
    await pool.end();
  });

  it('aplica VARCHAR(255) a TEXT y registra el checksum mediante el runner real', async () => {
    await expect(ejecutarMigraciones(pool)).resolves.toEqual([MIGRACION_15]);

    const columna = await pool.query<{ data_type: string; character_maximum_length: number | null }>(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'sigd_auth'
        AND table_name = 'sesion_usuario'
        AND column_name = 'refresh_token'
    `);
    const registro = await pool.query<{ total: number }>(
      'SELECT COUNT(*)::int AS total FROM public.sigd_migraciones WHERE nombre_script = $1',
      [MIGRACION_15],
    );

    expect(columna.rows[0]).toEqual({ data_type: 'text', character_maximum_length: null });
    expect(registro.rows[0].total).toBe(1);
  });

  it('revierte la migración 15 y su registro si una migración posterior falla', async () => {
    writeFileSync(
      path.join(directorioTemporal, '16_forzar_rollback.sql'),
      `ALTER TABLE sigd_auth.sesion_usuario ADD COLUMN rollback_probe BOOLEAN;\nSELECT 1 / 0;\n`,
      'utf8',
    );

    await expect(ejecutarMigraciones(pool)).rejects.toMatchObject({ code: '22012' });

    const columna = await pool.query<{ data_type: string; character_maximum_length: number | null }>(`
      SELECT data_type, character_maximum_length
      FROM information_schema.columns
      WHERE table_schema = 'sigd_auth'
        AND table_name = 'sesion_usuario'
        AND column_name = 'refresh_token'
    `);
    const pruebaRollback = await pool.query<{ existe: string | null }>(
      "SELECT to_regclass('public.sigd_migraciones')::text AS existe",
    );
    const columnaTemporal = await pool.query<{ total: number }>(`
      SELECT COUNT(*)::int AS total
      FROM information_schema.columns
      WHERE table_schema = 'sigd_auth'
        AND table_name = 'sesion_usuario'
        AND column_name = 'rollback_probe'
    `);

    expect(columna.rows[0]).toEqual({ data_type: 'character varying', character_maximum_length: 255 });
    expect(pruebaRollback.rows[0].existe).toBeNull();
    expect(columnaTemporal.rows[0].total).toBe(0);
  });
});
