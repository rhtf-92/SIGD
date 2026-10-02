import 'dotenv/config';
import { crearPool } from '../database.js';
import { ejecutarMigraciones, listarMigracionesAplicadas } from './migrate.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/sigd_prueba';

const pool = crearPool(databaseUrl);

try {
  const aplicadas = await ejecutarMigraciones(pool);
  const registro = await listarMigracionesAplicadas(pool);
  console.log(`[MIGRATE] Aplicadas ahora: ${aplicadas.length > 0 ? aplicadas.join(', ') : '(ninguna, ya estaban al día)'}`);
  console.log(`[MIGRATE] Total registradas en public.sigd_migraciones: ${registro.length}`);
} catch (error) {
  console.error('[MIGRATE] Finalizó con error:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
