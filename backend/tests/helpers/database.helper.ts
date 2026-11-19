import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

let pool: Pool | null = null;

/**
 * Carga de credenciales locales de prueba (gitignored).
 */
function cargarConfiguracionPruebas(): void {
  const posiblesRutas = [
    path.resolve(__dirname, '../../.env.test'),
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), 'backend/.env.test'),
  ];
  for (const ruta of posiblesRutas) {
    if (fs.existsSync(ruta)) {
      dotenv.config({ path: ruta, override: true });
      break;
    }
  }
}

/**
 * Proveedor centralizado de conexiones PostgreSQL para suites de prueba.
 * Garantiza exclusividad hacia sigd_jacobo_demo utilizando el rol técnico de solo lectura 'sigd_test_ro'.
 * Además activa 'default_transaction_read_only = on' a nivel de sesión de PostgreSQL
 * para imposibilitar físicamente operaciones destructivas (INSERT, UPDATE, DELETE, TRUNCATE).
 */
export function obtenerPool(): Pool {
  cargarConfiguracionPruebas();

  const databaseUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://sigd_test_ro@127.0.0.1:5433/sigd_jacobo_demo';

  if (!pool) {
    pool = new Pool({ connectionString: databaseUrl });

    // Blindaje a nivel de PostgreSQL: forzar transacciones de solo lectura
    pool.on('connect', (client) => {
      client.query('SET default_transaction_read_only = on').catch(() => undefined);
    });
  }

  return pool;
}

export async function cerrarPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
