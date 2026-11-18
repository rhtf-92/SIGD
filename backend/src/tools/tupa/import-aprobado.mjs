import { Pool } from 'pg';

const INSERT_TUPA_APROBADO = `
  INSERT INTO sigd_doc.tupa_registro_version (
    documento_sha256, fuente_nombre, pagina, referencia_fila, revision,
    codigo_externo, denominacion_original, monto_original, requisitos_original,
    referencia_normativa_original, version_fuente, vigencia_desde, vigencia_hasta,
    estado_validacion, referencia_aprobacion
  ) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8, $9::jsonb,
    $10, $11, $12::date, $13::date,
    $14, $15
  )
  ON CONFLICT ON CONSTRAINT uq_tupa_registro_procedencia DO NOTHING
  RETURNING registro_version_id
`;

function parametros(entrada) {
  return [
    entrada.documentoSha256, entrada.fuenteNombre, entrada.pagina,
    entrada.referenciaFila, entrada.revision, entrada.codigoExterno,
    entrada.denominacionOriginal, entrada.montoOriginal,
    JSON.stringify(entrada.requisitosOriginal), entrada.referenciaNormativaOriginal,
    entrada.versionFuente, entrada.vigenciaDesde, entrada.vigenciaHasta,
    entrada.estadoValidacion, entrada.referenciaAprobacion,
  ];
}

export async function importarAprobado(cliente, entradas) {
  const aprobados = entradas.filter(e => e.estadoValidacion === 'APROBADO');
  if (aprobados.length === 0) {
    return { modo: 'APROBADO', entradasValidas: 0, insertadas: 0, omitidas: 0 };
  }

  let insertadas = 0;
  try {
    await cliente.query('BEGIN');
    for (const entrada of aprobados) {
      const resultado = await cliente.query(INSERT_TUPA_APROBADO, parametros(entrada));
      insertadas += resultado.rowCount ?? 0;
    }
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  }

  return {
    modo: 'APROBADO',
    entradasValidas: aprobados.length,
    insertadas,
    omitidas: aprobados.length - insertadas,
  };
}

// CLI entry point
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { cargarStagingDesdeTexto } from './validate-staging.mjs';

function argumentos(argv) {
  const indiceArchivo = argv.indexOf('--file');
  if (indiceArchivo >= 0 && !argv[indiceArchivo + 1]) throw new Error('--file requiere una ruta.');
  const predeterminado = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'staging/tupa-suiza-2026.staging.json');
  return {
    archivo: indiceArchivo >= 0 ? path.resolve(argv[indiceArchivo + 1]) : predeterminado,
  };
}

export async function ejecutarCli(argv = process.argv.slice(2)) {
  const opcion = argumentos(argv);
  const staging = cargarStagingDesdeTexto(await readFile(opcion.archivo, 'utf8'));

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL es obligatoria.');

  const pool = new Pool({ connectionString: databaseUrl, max: 1 });
  const cliente = await pool.connect();
  try {
    const resultado = await importarAprobado(cliente, staging.entradas);
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