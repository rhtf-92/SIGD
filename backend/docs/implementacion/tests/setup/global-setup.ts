import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const existingUrl = process.env.TEST_DATABASE_URL;

  if (existingUrl) {
    console.log(`[MIGRACION] Usando PostgreSQL existente: ${existingUrl}`);
    await ejecutarMigraciones(existingUrl);
    return async () => {};
  }

  try {
    const { PostgreSqlContainer } = await import('@testcontainers/postgresql');
    const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
    const container = await new PostgreSqlContainer(imagen)
      .withDatabase('sigd_prueba')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
    process.env.TEST_DATABASE_URL = databaseUrl;
    console.log(`[MIGRACION] Testcontainers PostgreSQL iniciado en ${databaseUrl}`);

    await ejecutarMigraciones(databaseUrl);

    return async () => {
      await container.stop();
    };
  } catch (error) {
    const localUrl = 'postgres://postgres:postgres@localhost:5432/sigd_prueba';
    console.warn(
      '[MIGRACION] Docker/Testcontainers no disponible. Usando PostgreSQL local.',
      error instanceof Error ? error.message : String(error),
    );
    console.log(`[MIGRACION] Conectando a: ${localUrl}`);
    process.env.TEST_DATABASE_URL = localUrl;

    await ejecutarMigraciones(localUrl);

    return async () => {};
  }
}

function directorioImplementacion(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function rutaDdlAudit(): string {
  const raizImpl = path.resolve(directorioImplementacion(), '../..');
  return path.resolve(raizImpl, '../integracion/06_sigd_audit_esquema_ddl.sql');
}

function rutaFixture(): string {
  const raizImpl = path.resolve(directorioImplementacion(), '../..');
  return path.join(raizImpl, 'tests', 'fixtures', '01_schema_fixtures_test.sql');
}

async function ejecutarMigraciones(databaseUrl: string): Promise<void> {
  const ddl = rutaDdlAudit();
  const fixture = rutaFixture();

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    if (existsSync(ddl)) {
      console.log(`[MIGRACION] Aplicando DDL de auditoría: ${ddl}`);
      await aplicarSql(cliente, ddl);
    } else {
      console.warn(
        `[MIGRACION] DDL de auditoría no encontrado en ${ddl}. ` +
        'Las pruebas de auditoría/Outbox usarán el stub del fixture.',
      );
    }

    await aplicarSql(cliente, fixture);
    console.log('[MIGRACION] Fixtures de los 6 esquemas aplicados correctamente.');
  } finally {
    await cliente.end();
  }
}

async function aplicarSql(cliente: Client, ruta: string): Promise<void> {
  const sql = readFileSync(ruta, 'utf8').trim();
  if (!sql) return;
  try {
    await cliente.query(sql);
  } catch (error) {
    console.error(`[MIGRACION] Falló al aplicar ${ruta} (${ON_ERROR_STOP}):`, error);
    throw error;
  }
}
