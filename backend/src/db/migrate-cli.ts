import 'dotenv/config';
import { crearPool } from '../database.js';
import { ejecutarMigraciones, listarMigracionesAplicadas } from './migrate.js';
import { ejecutarMigracionesConAutorizacion } from './migration-command.js';

try {
  const autorizada = await ejecutarMigracionesConAutorizacion(
    process.argv.slice(2),
    process.env,
    async (databaseUrl) => {
      const pool = crearPool(databaseUrl);
      try {
        const aplicadas = await ejecutarMigraciones(pool);
        const registro = await listarMigracionesAplicadas(pool);
        console.log(
          '[MIGRATE] Aplicadas ahora: ' +
            (aplicadas.length > 0 ? aplicadas.join(', ') : '(ninguna, ya estaban al día)'),
        );
        console.log('[MIGRATE] Total registradas en public.sigd_migraciones: ' + registro.length);
      } finally {
        await pool.end();
      }
    },
  );

  if (!autorizada) {
    console.error('[MIGRATE] No ejecutada. Para autorizar la acción explícita, invoque npm run migrate -- --apply.');
    process.exitCode = 2;
  }
} catch (error) {
  console.error('[MIGRATE] Finalizó con error:', error instanceof Error ? error.message : 'error desconocido');
  process.exitCode = 1;
}
