import 'dotenv/config';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';
const BASE_POR_DEFECTO = 'sigd_prueba';

export default async function globalSetup(): Promise<void> {
  const databaseUrl = await resolverBaseDeDatos();
  process.env.TEST_DATABASE_URL = databaseUrl;
  await ejecutarMigraciones(databaseUrl);
}

/**
 * Resuelve la PostgreSQL de la suite E2E con dos estrategias, en este orden:
 *
 *  1. `TEST_DATABASE_URL` — una PostgreSQL ya levantada (la "Opción B" del README,
 *     desarrollo local sin Docker). Es la vía recomendada en máquinas sin runtime
 *     de contenedores.
 *  2. Testcontainers — contenedor efímero `postgres:18-alpine`. Exige Docker o
 *     Podman; es la vía original del proyecto.
 *
 * Se conserva el contenedor en `globalThis` para que el teardown lo detenga. Con
 * una base externa no hay nada que detener: la base es del desarrollador y su
 * ciclo de vida no depende de la suite.
 */
async function resolverBaseDeDatos(): Promise<string> {
  const externa = process.env.TEST_DATABASE_URL?.trim();
  if (externa) {
    await verificarConectividad(externa);
    console.log('[E2E] Usando la PostgreSQL de TEST_DATABASE_URL (sin contenedor).');
    return externa;
  }

  try {
    const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
    const container = await new PostgreSqlContainer(imagen)
      .withDatabase(BASE_POR_DEFECTO)
      .withUsername('postgres')
      .withPassword('postgres')
      .start();
    (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = container;
    return `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/${BASE_POR_DEFECTO}`;
  } catch (error) {
    throw new Error(
      'No se pudo iniciar la base de datos de pruebas.\n' +
        `  · Con Docker/Podman: instala un runtime de contenedores y vuelve a ejecutar.\n` +
        `  · Sin Docker: crea un archivo .env en backend/ con la línea\n` +
        `      TEST_DATABASE_URL=postgres://usuario:clave@localhost:5432/${BASE_POR_DEFECTO}\n` +
        `    y crea antes la base ${BASE_POR_DEFECTO} con createdb.\n` +
        `  Detalle del fallo: ${(error as Error).message}`,
    );
  }
}

/**
 * Falla temprano y con un mensaje útil si la URL apunta a una base inexistente o a
 * credenciales inválidas, en lugar de dejar que reviente la primera prueba.
 */
async function verificarConectividad(databaseUrl: string): Promise<void> {
  const cliente = new Client({ connectionString: databaseUrl });
  try {
    await cliente.connect();
    await cliente.query('SELECT 1');
  } catch (error) {
    throw new Error(
      `TEST_DATABASE_URL no permite conectarse: ${(error as Error).message}\n` +
        `  Revisa usuario, clave, puerto y que la base ${BASE_POR_DEFECTO} exista.`,
    );
  } finally {
    await cliente.end();
  }
}

function directorioSetup(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function ejecutarMigraciones(databaseUrl: string): Promise<void> {
  const raizProyecto = path.resolve(directorioSetup(), '../..');
  const rutaDdlDocs = existsSync(path.resolve(raizProyecto, 'docs/00_corelink/06_sigd_audit_esquema_ddl.sql'))
    ? path.resolve(raizProyecto, 'docs/00_corelink/06_sigd_audit_esquema_ddl.sql')
    : path.resolve(raizProyecto, 'docs/corelink/06_sigd_audit_esquema_ddl.sql');
  const archivoDdlAudit = existsSync(rutaDdlDocs)
    ? rutaDdlDocs
    : path.resolve(raizProyecto, '../06_sigd_audit_esquema_ddl.sql');
  const dirMigraciones = process.env.MIGRATIONS_DIR
    ? path.resolve(raizProyecto, process.env.MIGRATIONS_DIR)
    : path.join(raizProyecto, 'migraciones');
  const fixture = path.join(raizProyecto, 'tests', 'fixtures', '01_schema_fixtures_test.sql');

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

    await aplicarSql(cliente, fixture);
    if (existsSync(archivoDdlAudit)) {
      await aplicarSql(cliente, archivoDdlAudit);
    }

    if (existsSync(dirMigraciones)) {
      const archivos = readdirSync(dirMigraciones)
        .filter((f) => f.endsWith('.sql'))
        .sort();
      for (const archivo of archivos) {
        await aplicarSql(cliente, path.join(dirMigraciones, archivo));
      }
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
