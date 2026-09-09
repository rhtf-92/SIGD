import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase('sigd_prueba')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
  process.env.TEST_DATABASE_URL = databaseUrl;

  await ejecutarMigraciones(databaseUrl);

  return async () => {
    await container.stop();
  };
}

function directorioSetup(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

function raizImplementacion(): string {
  return path.resolve(directorioSetup(), '../..');
}

async function ejecutarMigraciones(databaseUrl: string): Promise<void> {
  const raizImpl = raizImplementacion();
  const archivoDdlAudit = path.resolve(raizImpl, '../integracion/06_sigd_audit_esquema_ddl.sql');
  const fixture = path.join(raizImpl, 'tests', 'fixtures', '01_schema_fixtures_test.sql');

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await aplicarSql(cliente, fixture);

    if (existsSync(archivoDdlAudit)) {
      await aplicarSql(cliente, archivoDdlAudit);
    } else {
      console.warn(`[MIGRACION] DDL de auditoría no encontrado en ${archivoDdlAudit}. Las pruebas de auditoría/Outbox pueden fallar.`);
    }
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