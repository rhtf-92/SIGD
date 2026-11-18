import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { ejecutarResetDemoDev } from '../../../src/tools/reset-demo-dev.js';

const SQL_DESTRUCTIVO = /\b(?:DELETE|TRUNCATE|ALTER|UPDATE|INSERT)\b/i;

function crearPoolMock(databaseName: string, failSql?: string) {
  const client = {
    query: vi.fn(async (sql: string) => {
      if (sql === 'SELECT current_database() AS database_name') {
        return { rows: [{ database_name: databaseName }] };
      }
      if (failSql && sql.includes(failSql)) throw new Error('Simulated database error');
      return { rows: [] };
    }),
    release: vi.fn(),
  };
  const pool = { connect: vi.fn(async () => client) } as unknown as Pool;
  return { pool, client };
}

describe('reset-demo-dev: salvaguardas y comportamiento', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.NODE_ENV;
    delete process.env.DATABASE_URL;
    delete process.env.ALLOW_DEMO_RESET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('aborta en production antes de abrir conexión', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ALLOW_DEMO_RESET = 'true';
    const { pool } = crearPoolMock('sigd_prueba');
    await expect(ejecutarResetDemoDev(pool)).rejects.toThrow('Demo reset refused in production');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('aborta si ALLOW_DEMO_RESET está ausente', async () => {
    const { pool } = crearPoolMock('sigd_prueba');
    await expect(ejecutarResetDemoDev(pool)).rejects.toThrow('Demo reset disabled: ALLOW_DEMO_RESET=true is required');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('aborta si ALLOW_DEMO_RESET=false', async () => {
    process.env.ALLOW_DEMO_RESET = 'false';
    const { pool } = crearPoolMock('sigd_prueba');
    await expect(ejecutarResetDemoDev(pool)).rejects.toThrow('Demo reset disabled: ALLOW_DEMO_RESET=true is required');
    expect(pool.connect).not.toHaveBeenCalled();
  });

  it('falla con error claro si falta DATABASE_URL sin pool inyectado', async () => {
    process.env.ALLOW_DEMO_RESET = 'true';
    await expect(ejecutarResetDemoDev()).rejects.toThrow(
      'Falta definir DATABASE_URL para ejecutar la limpieza de datos demo.',
    );
  });

  it('rechaza una base distinta sin iniciar transacción ni ejecutar SQL destructivo', async () => {
    process.env.ALLOW_DEMO_RESET = 'true';
    const { pool, client } = crearPoolMock('sigd_staging');
    await expect(ejecutarResetDemoDev(pool)).rejects.toThrow('Demo reset refused: connected database must be sigd_prueba');
    expect(client.query).toHaveBeenCalledExactlyOnceWith('SELECT current_database() AS database_name');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('permite continuar solo con flag true, no production y base real sigd_prueba', async () => {
    process.env.ALLOW_DEMO_RESET = 'true';
    const { pool, client } = crearPoolMock('sigd_prueba');
    await ejecutarResetDemoDev(pool);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM sigd_tra.orden_pago;');
    expect(client.query).toHaveBeenCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledOnce();

    const queries = client.query.mock.calls.map(([sql]) => sql);
    expect(queries[0]).toBe('SELECT current_database() AS database_name');
    expect(queries[1]).toBe('BEGIN');
    expect(queries.slice(0, 2).some((sql) => SQL_DESTRUCTIVO.test(sql))).toBe(false);
  });

  it('hace rollback si falla la limpieza después de validar la base', async () => {
    process.env.ALLOW_DEMO_RESET = 'true';
    const { pool, client } = crearPoolMock('sigd_prueba', 'DELETE FROM sigd_tra.orden_pago');
    await expect(ejecutarResetDemoDev(pool)).rejects.toThrow('Simulated database error');
    expect(client.query.mock.calls.map(([sql]) => sql).slice(0, 2)).toEqual([
      'SELECT current_database() AS database_name', 'BEGIN',
    ]);
    expect(client.query).toHaveBeenCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledOnce();
  });
});
