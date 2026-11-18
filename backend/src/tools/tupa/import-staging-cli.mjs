import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { cargarStagingDesdeTexto } from './validate-staging.mjs';
import { importarStaging } from './import-staging.mjs';

function argumentos(argv) {
  const indiceArchivo = argv.indexOf('--file');
  if (indiceArchivo >= 0 && !argv[indiceArchivo + 1]) throw new Error('--file requiere una ruta.');
  const predeterminado = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'staging/tupa-suiza-2026.staging.json');
  return {
    archivo: indiceArchivo >= 0 ? path.resolve(argv[indiceArchivo + 1]) : predeterminado,
    aplicar: argv.includes('--apply'),
    // Activación controlada CP-GERIC-013 §7: exige flag explícita junto a --apply.
    permitirAprobadosPrototipo: argv.includes('--permitir-aprobados-prototipo'),
  };
}

export async function ejecutarCli(argv = process.argv.slice(2)) {
  const opcion = argumentos(argv);
  const staging = cargarStagingDesdeTexto(await readFile(opcion.archivo, 'utf8'));

  if (!opcion.aplicar) {
    const resultado = await importarStaging({ query: async () => ({ rowCount: 0 }) }, staging);
    console.log(JSON.stringify({ archivo: opcion.archivo, ...resultado }, null, 2));
    return;
  }

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria para --apply.');
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const cliente = await pool.connect();
  try {
    const resultado = await importarStaging(cliente, staging, {
      aplicar: true,
      permitirAprobadosPrototipo: opcion.permitirAprobadosPrototipo,
    });
    console.log(JSON.stringify({ archivo: opcion.archivo, ...resultado }, null, 2));
  } finally {
    cliente.release();
    await pool.end();
  }
}

const ejecutadoDirectamente = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url
  : false;

if (ejecutadoDirectamente) {
  ejecutarCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
