import 'dotenv/config';
import { crearPool } from '../database.js';
import {
  ejecutarMigraciones,
  listarMigracionesAplicadas,
  BASE_DATOS_OFICIAL_B_JACOBO,
  BASES_TEST_AUTORIZADAS,
} from './migrate.js';

const databaseUrl =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres_password@127.0.0.1:5433/sigd_jacobo_demo';

const pool = crearPool(databaseUrl);
const soloArchivo = process.env.SIGD_MIGRATION_ONLY;
const permitirTest = process.env.SIGD_ALLOW_TEST_DB === 'true';
const baseEsperada = process.env.SIGD_MIGRATION_EXPECTED_DATABASE ?? BASE_DATOS_OFICIAL_B_JACOBO;

try {
  if (permitirTest && process.env.NODE_ENV === 'production') {
    throw new Error('Violación de Seguridad DDL: El modo de prueba DDL está prohibido terminantemente en entorno de producción (NODE_ENV=production).');
  }
  if (!permitirTest && baseEsperada !== BASE_DATOS_OFICIAL_B_JACOBO) {
    throw new Error(
      `Base de datos no autorizada: "${baseEsperada}". B_JACOBO opera exclusivamente sobre "${BASE_DATOS_OFICIAL_B_JACOBO}".`
    );
  }
  if (permitirTest && baseEsperada === BASE_DATOS_OFICIAL_B_JACOBO) {
    throw new Error(
      `Violación de Integridad DDL: El modo de prueba no puede ejecutarse contra la base oficial "${BASE_DATOS_OFICIAL_B_JACOBO}".`
    );
  }
  if (permitirTest && !BASES_TEST_AUTORIZADAS.includes(baseEsperada)) {
    throw new Error(
      `Base de datos de prueba no autorizada: "${baseEsperada}". El modo de prueba admite exclusivamente: ${BASES_TEST_AUTORIZADAS.join(', ')}.`
    );
  }
  const aplicadas = await ejecutarMigraciones(pool, {
    ...(soloArchivo ? { soloArchivo } : {}),
    baseEsperada,
    permitirBaseCualquieraEnTest: permitirTest,
  });
  const registro = await listarMigracionesAplicadas(pool);
  console.log(`[MIGRATE] Aplicadas ahora: ${aplicadas.length > 0 ? aplicadas.join(', ') : '(ninguna, ya estaban al día)'}`);
  console.log(`[MIGRATE] Total registradas en public.sigd_migraciones: ${registro.length}`);
} catch (error) {
  console.error('[MIGRATE] Finalizó con error:', error);
  process.exitCode = 1;
} finally {
  await pool.end();
}
