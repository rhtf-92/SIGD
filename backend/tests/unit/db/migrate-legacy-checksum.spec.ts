import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Pool } from 'pg';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ejecutarMigraciones } from '../../../src/db/migrate.js';

const CHECKSUM_02_ANTERIOR_LF = '14c804323b56f9e88cf74cab9ed1a1683fac6d748fee6090997ab777ee776fa2';

const temporales: string[] = [];
const migrationsDirOriginal = process.env.MIGRATIONS_DIR;

afterEach(() => {
  process.env.MIGRATIONS_DIR = migrationsDirOriginal;
  for (const directorio of temporales.splice(0)) rmSync(directorio, { recursive: true, force: true });
});

function prepararMigracion02(): string {
  const directorio = mkdtempSync(path.join(tmpdir(), 'sigd-migrate-'));
  temporales.push(directorio);
  copyFileSync(
    path.resolve(process.cwd(), 'migraciones/02_sigd_auth.sql'),
    path.join(directorio, '02_sigd_auth.sql'),
  );
  process.env.MIGRATIONS_DIR = directorio;
  return directorio;
}

function poolConChecksumAnterior(esquemaCompatible: boolean) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql.includes('pg_try_advisory_lock')) return { rows: [{ adquirido: true }], rowCount: 1 };
      if (sql.includes('SELECT checksum_sha256')) {
        return { rows: [{ checksum_sha256: CHECKSUM_02_ANTERIOR_LF }], rowCount: 1 };
      }
      if (sql.includes('information_schema.columns')) {
        const validaRelacionExacta =
          sql.includes("origen.attname = 'usuario_id'") &&
          sql.includes("destino.attname = 'id_usuario'") &&
          sql.includes('c.convalidated') &&
          sql.includes("c.confdeltype = 'c'");
        return { rows: [{ compatible: esquemaCompatible && validaRelacionExacta }], rowCount: 1 };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: vi.fn(),
  };
  return { pool: { connect: vi.fn(async () => client) } as unknown as Pool, client };
}

describe('compatibilidad controlada del checksum histórico de migración 02', () => {
  it('acepta exclusivamente el checksum anterior si el esquema esperado existe y actualiza el registro', async () => {
    prepararMigracion02();
    const { pool, client } = poolConChecksumAnterior(true);

    await expect(ejecutarMigraciones(pool)).resolves.toEqual([]);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.sigd_migraciones'),
      expect.arrayContaining(['02_sigd_auth.sql']),
    );
    expect(client.query).toHaveBeenCalledWith('COMMIT');
  });

  it('rechaza el checksum anterior cuando falta la FK exacta usuario_id a id_usuario', async () => {
    prepararMigracion02();
    const { pool, client } = poolConChecksumAnterior(false);

    await expect(ejecutarMigraciones(pool)).rejects.toThrow(/compatibilidad.*migración 02/i);

    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.query).not.toHaveBeenCalledWith(
      expect.stringContaining('UPDATE public.sigd_migraciones'),
      expect.anything(),
    );
  });
});
