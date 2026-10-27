import { Pool } from 'pg';

export function crearPool(databaseUrl: string): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 30_000,
  });

  pool.on('error', (error) => {
    console.error('[DB] Error inesperado en un cliente inactivo de PostgreSQL:', error);
  });

  return pool;
}