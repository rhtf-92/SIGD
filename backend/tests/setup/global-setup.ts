import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const ETIQUETA_ORIGEN = '[MIGRACION]';

export default async function globalSetup(): Promise<void> {
  const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase('sigd_prueba')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
  process.env.TEST_DATABASE_URL = databaseUrl;
  (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = container;

  await aplicarEsquemaCanónico(databaseUrl);
}

export async function teardown(): Promise<void> {
  const container = (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ as
    | { stop: () => Promise<void> }
    | undefined;

  if (container) {
    await container.stop();
    (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = undefined;
  }
}

function directorioSetup(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function aplicarEsquemaCanónico(databaseUrl: string): Promise<void> {
  const raizProyecto = path.resolve(directorioSetup(), '../..');
  const dirMigraciones = process.env.MIGRATIONS_DIR
    ? path.resolve(raizProyecto, process.env.MIGRATIONS_DIR)
    : path.join(raizProyecto, 'migraciones');
  const fixture = path.join(raizProyecto, 'tests', 'fixtures', '01_schema_fixtures_test.sql');

  if (!existsSync(dirMigraciones)) {
    throw new Error(`No se encontró el directorio de migraciones canónicas: ${dirMigraciones}`);
  }

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    const archivos = readdirSync(dirMigraciones)
      .filter((f) => f.endsWith('.sql'))
      .sort();
    for (const archivo of archivos) {
      await aplicarSql(cliente, path.join(dirMigraciones, archivo));
    }

    if (existsSync(fixture)) {
      await aplicarSql(cliente, fixture);
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
    console.log(`${ETIQUETA_ORIGEN} aplicado ${path.basename(ruta)}`);
  } catch (error) {
    console.error(`${ETIQUETA_ORIGEN} falló ${path.basename(ruta)}:`, error);
    throw error;
  }
}
