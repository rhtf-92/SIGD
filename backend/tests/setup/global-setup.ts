import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';
import { MANIFIESTO_BASELINE } from '../../src/db/migrate.js';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';
const NOMBRE_BASE_TEST = 'sigd_prueba';
const NOMBRE_PLANTILLA_TEST = 'sigd_e2e_template';

export default async function globalSetup(): Promise<void> {
  const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase('sigd_prueba')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
  process.env.TEST_DATABASE_URL = databaseUrl;
  const adminDatabaseUrl = new URL(databaseUrl);
  adminDatabaseUrl.pathname = '/postgres';
  process.env.TEST_DATABASE_ADMIN_URL = adminDatabaseUrl.toString();
  process.env.TEST_DATABASE_TEMPLATE = NOMBRE_PLANTILLA_TEST;
  (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = container;

  await ejecutarMigraciones(databaseUrl);
  await crearPlantilla();
}

function directorioSetup(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function ejecutarMigraciones(databaseUrl: string): Promise<void> {
  const raizProyecto = path.resolve(directorioSetup(), '../..');
  const dirMigraciones = process.env.MIGRATIONS_DIR
    ? path.resolve(raizProyecto, process.env.MIGRATIONS_DIR)
    : path.join(raizProyecto, 'migraciones');
  const fixture = path.join(raizProyecto, 'tests', 'fixtures', '01_schema_fixtures_test.sql');
  const fixtureTupaRegistry = path.join(raizProyecto, 'tests', 'fixtures', '02_tupa_registry_versions_test.sql');
  const fixtureTupaFase4b = path.join(raizProyecto, 'tests', 'fixtures', '03_tupa_fase4b_test.sql');
  const baseline = path.join(raizProyecto, 'baselines', 'BASELINE_2026_V1.sql');

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    for (const nombre of MANIFIESTO_BASELINE) {
      const ruta = nombre === 'BASELINE_2026_V1.sql'
        ? baseline
        : path.join(dirMigraciones, nombre);
      if (!existsSync(ruta)) {
        throw new Error(`Falta migración del manifiesto de pruebas: ${ruta}`);
      }
      if (nombre === '16_sigd_tupa_versionamiento.sql') {
        await aplicarSql(cliente, fixtureTupaRegistry);
      }
      if (nombre === '29_sigd_tupa_datos_oficiales.sql') {
        await aplicarSql(cliente, fixtureTupaFase4b);
      }
      await aplicarSql(cliente, ruta);
    }

    await aplicarSql(cliente, fixture);
  } finally {
    await cliente.end();
  }
}

async function crearPlantilla(): Promise<void> {
  const cliente = new Client({ connectionString: process.env.TEST_DATABASE_ADMIN_URL });
  await cliente.connect();
  try {
    await cliente.query(`CREATE DATABASE ${NOMBRE_PLANTILLA_TEST} TEMPLATE ${NOMBRE_BASE_TEST}`);
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