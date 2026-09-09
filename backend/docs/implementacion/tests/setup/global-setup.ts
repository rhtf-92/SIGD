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
    throw new Error(
      '[MIGRACION] No se pudo preparar PostgreSQL. Define TEST_DATABASE_URL explícitamente ' +
        '(por ejemplo postgres://postgres:postgres@localhost:5432/sigd_prueba) o asegura Docker ' +
        'disponible para Testcontainers. La suite NO cae silenciosamente a un PostgreSQL local fijo. ' +
        `Detalle: ${error instanceof Error ? error.message : String(error)}`,
    );
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

    if (!existsSync(ddl)) {
      throw new Error(
        `[MIGRACION] DDL real de auditoría no encontrado en ${ddl}. ` +
          'La suite requiere el esquema sigd_audit real; NO se sustituye por un stub del fixture.',
      );
    }

    console.log(`[MIGRACION] Aplicando DDL real de auditoría (${ON_ERROR_STOP}): ${ddl}`);
    await aplicarSql(cliente, ddl);

    console.log(
      `[MIGRACION] Aplicando FIXTURES PROVISIONALES (5 esquemas de módulos; sigd_audit NO está aquí): ${fixture}`,
    );
    await aplicarSql(cliente, fixture);
    console.log(
      '[MIGRACION] Entorno preparado: sigd_audit del DDL real de integracion/ + stubs provisionales de los 5 módulos.',
    );
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