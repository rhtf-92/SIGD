import { Pool } from 'pg';

export function crearPool(databaseUrl: string): Pool {
  return new Pool({
    connectionString: databaseUrl,
    max: 20,
  });
}