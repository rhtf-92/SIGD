import { Pool } from 'pg';

let pool: Pool | null = null;

export function obtenerPool(): Pool {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('TEST_DATABASE_URL no está configurado. Verifica que el global-setup haya corrido.');
  }
  pool ??= new Pool({ connectionString: databaseUrl });
  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}