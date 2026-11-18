import { Pool } from 'pg';

export function crearPool(databaseUrl: string): Pool {
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 20,
    client_encoding: 'UTF8',
  });
  pool.on('connect', (client) => {
    client.query("SET client_encoding TO 'UTF8'").catch(() => {});
  });
  return pool;
}