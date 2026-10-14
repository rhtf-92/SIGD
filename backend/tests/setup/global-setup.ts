import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client, Pool } from "pg";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { ejecutarMigraciones as ejecutarRunnerMigraciones } from "../../src/db/migrate.js";

const ON_ERROR_STOP = "ON_ERROR_STOP=1";

export default async function globalSetup(): Promise<void> {
  const imagen = process.env.TESTCONTAINERS_IMAGE ?? "postgres:18-alpine";
  const container = await new PostgreSqlContainer(imagen)
    .withDatabase("sigd_prueba")
    .withUsername("postgres")
    .withPassword("postgres")
    .start();

  const databaseUrl = `postgres://postgres:postgres@${container.getHost()}:${container.getPort()}/sigd_prueba`;
  process.env.TEST_DATABASE_URL = databaseUrl;
  (globalThis as Record<string, unknown>).__SIGD_CONTAINER__ = container;

  await ejecutarBootstrap(databaseUrl);
}

function directorioSetup(): string {
  return path.dirname(fileURLToPath(import.meta.url));
}

async function ejecutarBootstrap(databaseUrl: string): Promise<void> {
  const raizProyecto = path.resolve(directorioSetup(), "../..");
  const fixture = path.join(
    raizProyecto,
    "tests",
    "fixtures",
    "01_schema_fixtures_test.sql",
  );
  const semilla = path.join(
    raizProyecto,
    "tests",
    "fixtures",
    "02_seed_test.sql",
  );

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    await cliente.query("CREATE EXTENSION IF NOT EXISTS pgcrypto");
    await cliente.query("CREATE EXTENSION IF NOT EXISTS ltree");
    await cliente.query("CREATE EXTENSION IF NOT EXISTS btree_gist");
  } finally {
    await cliente.end();
  }

  if (process.env.SKIP_MIGRATIONS !== "true") {
    const pool = new Pool({ connectionString: databaseUrl });
    try {
      await ejecutarRunnerMigraciones(pool);
    } finally {
      await pool.end();
    }
  }

  const clientePost = new Client({ connectionString: databaseUrl });
  await clientePost.connect();
  try {
    if (process.env.USE_SCHEMA_FIXTURES === "true" && existsSync(fixture)) {
      await aplicarSql(clientePost, fixture);
    }
    if (existsSync(semilla)) {
      await aplicarSql(clientePost, semilla);
    }
  } finally {
    await clientePost.end();
  }
}

async function aplicarSql(cliente: Client, ruta: string): Promise<void> {
  const sql = readFileSync(ruta, "utf8").trim();
  if (!sql) return;
  try {
    await cliente.query(sql);
  } catch (error) {
    console.error(
      `[BOOTSTRAP] Fallo al aplicar ${ruta} (${ON_ERROR_STOP}):`,
      error,
    );
    throw error;
  }
}
