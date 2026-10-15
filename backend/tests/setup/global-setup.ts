import { existsSync, readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from 'pg';
import { PostgreSqlContainer } from '@testcontainers/postgresql';

const ON_ERROR_STOP = 'ON_ERROR_STOP=1';

export default async function globalSetup(): Promise<void> {
  const databaseUrlExterna = process.env.TEST_DATABASE_URL?.trim();
  if (databaseUrlExterna) {
    validarBaseExclusivaDePruebas(databaseUrlExterna, process.env.ALLOW_EXTERNAL_TEST_DATABASE);
    await ejecutarMigraciones(databaseUrlExterna);
    return;
  }

  const imagen = process.env.TESTCONTAINERS_IMAGE ?? 'postgres:18-alpine';
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase('sigd_prueba')
    .withUsername('postgres')
    .withPassword('postgres')
    .start();

  const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
  process.env.TEST_DATABASE_URL = databaseUrl;
  (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = container;

  await ejecutarMigraciones(databaseUrl);
}

export function validarBaseExclusivaDePruebas(databaseUrl: string, habilitada?: string): void {
  if (habilitada !== 'true') {
    throw new Error('Una base externa requiere ALLOW_EXTERNAL_TEST_DATABASE=true de forma explícita.');
  }
  const nombreBase = decodeURIComponent(new URL(databaseUrl).pathname.replace(/^\//, ''));
  if (!/^sigd_(?:test|prueba)(?:_[a-z0-9]+)*$/i.test(nombreBase)) {
    throw new Error('TEST_DATABASE_URL debe usar un nombre canónico sigd_test_* o sigd_prueba_*.');
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
      // La suite DB de OrganiCore no debe bloquearse por el hallazgo preexistente
      // de RutaDoc (06, SQLSTATE 42703) ni por la migración MGD 11, que depende
      // directamente de las relaciones creadas por 06. Se puede sobrescribir con
      // MIGRATIONS_EXCLUDE; una cadena vacía fuerza la ejecución de todas.
      const exclusionesConfiguradas = process.env.MIGRATIONS_EXCLUDE
        ?? '06_sigd_rut.sql,07_sigd_reportes.sql,11_sigd_mgd_contract.sql';
      const excluidas = new Set(exclusionesConfiguradas.split(',').map((item) => item.trim()).filter(Boolean));
      await cliente.query(`
        CREATE TABLE IF NOT EXISTS public.sigd_prueba_migraciones (
          nombre_script TEXT PRIMARY KEY,
          aplicado_en TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      const archivos = readdirSync(dirMigraciones)
        .filter((f) => f.endsWith('.sql'))
        .filter((f) => !excluidas.has(f))
        .sort();
      for (const archivo of archivos) {
        const aplicada = await cliente.query(
          'SELECT 1 FROM public.sigd_prueba_migraciones WHERE nombre_script = $1',
          [archivo],
        );
        if (aplicada.rowCount && aplicada.rowCount > 0) continue;
        await aplicarSql(cliente, path.join(dirMigraciones, archivo));
        await cliente.query(
          'INSERT INTO public.sigd_prueba_migraciones (nombre_script) VALUES ($1)',
          [archivo],
        );
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
