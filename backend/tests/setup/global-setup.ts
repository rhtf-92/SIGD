import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
  const passwordTemporal = randomBytes(32).toString('base64url');
  const databaseUrlAnterior = process.env.TEST_DATABASE_URL;
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase('sigd_prueba')
    .withUsername('postgres')
    .withPassword(passwordTemporal)
    .start();

  const databaseUrl =
    'postgres://postgres:' +
    passwordTemporal +
    '@' +
    container.getHost() +
    ':' +
    container.getPort() +
    '/sigd_prueba';
  process.env.TEST_DATABASE_URL = databaseUrl;

  try {
    await ejecutarMigraciones(databaseUrl);
  } catch (error) {
    restaurarDatabaseUrlDePrueba(databaseUrlAnterior);
    await container.stop();
    throw error;
  }

  return async () => {
    restaurarDatabaseUrlDePrueba(databaseUrlAnterior);
    await container.stop();
  };
}

function restaurarDatabaseUrlDePrueba(valorAnterior: string | undefined): void {
  if (valorAnterior === undefined) {
    delete process.env.TEST_DATABASE_URL;
    return;
  }
  process.env.TEST_DATABASE_URL = valorAnterior;
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

    // Los fixtures mínimos tienen contratos heredados (por ejemplo `cuenta_usuario.id`)
    // incompatibles con las migraciones canónicas (`id_usuario`). Solo se cargan en
    // suites antiguas que los soliciten explícitamente; la suite DB valida DDL real.
    if (process.env.USE_SCHEMA_FIXTURES === 'true') {
      await aplicarSql(cliente, fixture);
    }
    if (process.env.USE_SCHEMA_FIXTURES === 'true' && existsSync(archivoDdlAudit)) {
      await aplicarSql(cliente, archivoDdlAudit);
    }

    if (existsSync(dirMigraciones)) {
      // La suite DB de OrganiCore/IdentiCore no debe bloquearse por los módulos
      // RutaDoc/Reportes y su contrato de métricas (06, 07 y 11 dependen de 06).
      // Se puede sobrescribir explícitamente con MIGRATIONS_EXCLUDE; una cadena
      // vacía fuerza la ejecución de todas.
      const exclusionesConfiguradas = process.env.MIGRATIONS_EXCLUDE
        ?? '06_sigd_rut.sql,07_sigd_reportes.sql,11_sigd_mgd_contract.sql';
      const excluidas = new Set(exclusionesConfiguradas.split(',').map((item) => item.trim()).filter(Boolean));
      const archivos = readdirSync(dirMigraciones)
        .filter((f) => f.endsWith('.sql'))
        .filter((f) => !excluidas.has(f))
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
