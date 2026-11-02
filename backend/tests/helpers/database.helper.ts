import { Client, Pool } from 'pg';

let pool: Pool | null = null;
const NOMBRE_BASE_TEST = 'sigd_prueba';
const NOMBRE_PLANTILLA_TEST = 'sigd_e2e_template';

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

export async function restaurarBaseE2E(): Promise<void> {
  const databaseUrl = process.env.TEST_DATABASE_URL;
  const adminDatabaseUrl = process.env.TEST_DATABASE_ADMIN_URL;
  const template = process.env.TEST_DATABASE_TEMPLATE;
  if (!databaseUrl || !adminDatabaseUrl || template !== NOMBRE_PLANTILLA_TEST) {
    throw new Error('La base E2E aislada no está configurada por global-setup.');
  }
  if (new URL(databaseUrl).pathname !== `/${NOMBRE_BASE_TEST}`) {
    throw new Error('Se rechazó restaurar una base distinta de la base E2E aislada.');
  }

  await cerrarPool();
  const cliente = new Client({ connectionString: adminDatabaseUrl });
  await cliente.connect();
  try {
    await cliente.query(
      'SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()',
      [NOMBRE_BASE_TEST],
    );
    await cliente.query(`DROP DATABASE ${NOMBRE_BASE_TEST} WITH (FORCE)`);
    await cliente.query(`CREATE DATABASE ${NOMBRE_BASE_TEST} TEMPLATE ${NOMBRE_PLANTILLA_TEST}`);
  } finally {
    await cliente.end();
  }
}