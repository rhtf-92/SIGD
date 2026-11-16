import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';

/**
 * Global Setup institucional para B_JACOBO.
 * Conexión segura y exclusiva a sigd_jacobo_demo con rol técnico de solo lectura.
 * Queda terminantemente prohibida la creación de contenedores adicionales
 * o la ejecución de DDL destructivo/truncate sobre la base oficial.
 */
export default async function globalSetup(): Promise<void> {
  const posiblesRutasEnv = [
    path.resolve(__dirname, '../../.env.test'),
    path.resolve(process.cwd(), '.env.test'),
    path.resolve(process.cwd(), 'backend/.env.test'),
  ];
  for (const ruta of posiblesRutasEnv) {
    if (fs.existsSync(ruta)) {
      dotenv.config({ path: ruta, override: true });
      break;
    }
  }

  const databaseUrl =
    process.env.TEST_DATABASE_URL ||
    process.env.DATABASE_URL ||
    'postgres://sigd_test_ro@127.0.0.1:5433/sigd_jacobo_demo';

  process.env.TEST_DATABASE_URL = databaseUrl;

  const cliente = new Client({ connectionString: databaseUrl });
  await cliente.connect();
  try {
    const res = await cliente.query<{ db: string; usr: string }>('SELECT current_database() AS db, current_user AS usr');
    const db = res.rows[0]?.db;
    const usr = res.rows[0]?.usr;

    if (db !== 'sigd_jacobo_demo') {
      throw new Error(
        `[GLOBAL-SETUP] Violación de Exclusividad: conectado a "${db}". Se requiere estrictamente "sigd_jacobo_demo".`
      );
    }

    console.log(
      `[GLOBAL-SETUP] Verificación de entorno exitosa en "${db}" (usuario: "${usr}"). Modo seguro sin contenedores adicionales.`
    );
  } finally {
    await cliente.end();
  }
}
