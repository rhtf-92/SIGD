import { validarStaging } from './validate-staging.mjs';

/**
 * Activación controlada del prototipo (CP-GERIC-013 §7).
 *
 * El importador sigue bloqueando APROBADO por defecto. Solo cuando el operador
 * habilita expresamente `permitirAprobadosPrototipo` se aceptan las 18 filas
 * autorizadas, y únicamente con la referencia interna exacta. Cualquier otra
 * fila APROBADO continúa bloqueada. Esta opción no altera el DDL ni la FSM.
 */
export const REFERENCIA_APROBACION_PROTOTIPO = 'VALIDACION_PROTOTIPO_SIGD:TUPA-SUIZA-2026:V1';

export const WHITELIST_APROBADOS_PROTOTIPO = Object.freeze(new Set([
  'p1-fila-05',
  'p1-fila-06',
  'p4-fila-02',
  'p4-fila-05',
  'p4-fila-06',
  'p4-fila-07',
  'p4-fila-10',
  'p4-fila-15',
  'p5-fila-06',
  'p5-fila-07',
  'p5-fila-09',
  'p5-fila-10',
  'p5-fila-11',
  'p5-fila-18',
  'p5-fila-19',
  'p5-fila-20',
  'p5-fila-21',
  'p6-fila-04',
]));

function validarAprobadosPrototipo(entradas) {
  const aprobadas = entradas.filter((entrada) => entrada.estadoValidacion === 'APROBADO');
  for (const entrada of aprobadas) {
    if (entrada.referenciaAprobacion !== REFERENCIA_APROBACION_PROTOTIPO) {
      throw new Error(
        `IMPORTACION_BLOQUEADA: ${entrada.referenciaFila} usa una referencia de aprobación no autorizada.`,
      );
    }
    if (!WHITELIST_APROBADOS_PROTOTIPO.has(entrada.referenciaFila)) {
      throw new Error(
        `IMPORTACION_BLOQUEADA: ${entrada.referenciaFila} no pertenece a la whitelist de 18 aprobados del prototipo.`,
      );
    }
  }
  return aprobadas.length;
}

const INSERT_TUPA = `
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

export async function importarStaging(cliente, valor, opciones = {}) {
  const validacion = validarStaging(valor);
  if (!validacion.ok || !validacion.datos) {
    throw new Error(`Staging invalido:\n${validacion.errores.join('\n')}`);
  }

  const staging = validacion.datos;
  if (!opciones.aplicar) {
    return { modo: 'DRY_RUN', entradasValidas: staging.entradas.length, insertadas: 0, omitidas: 0 };
  }
  if (!staging.fuente.hashVerificado) {
    throw new Error('IMPORTACION_BLOQUEADA: el SHA-256 de la fuente no fue verificado contra el PDF presente.');
  }
  const hayAprobados = staging.entradas.some((entrada) => entrada.estadoValidacion === 'APROBADO');
  if (hayAprobados && !opciones.permitirAprobadosPrototipo) {
    throw new Error('IMPORTACION_BLOQUEADA: esta herramienta no inserta registros APROBADO.');
  }
  if (hayAprobados) validarAprobadosPrototipo(staging.entradas);

  let insertadas = 0;
  try {
    await cliente.query('BEGIN');
    for (const entrada of staging.entradas) {
      const resultado = await cliente.query(INSERT_TUPA, parametros(entrada));
      insertadas += resultado.rowCount ?? 0;
    }
    await cliente.query('COMMIT');
  } catch (error) {
    await cliente.query('ROLLBACK');
    throw error;
  }

  return {
    modo: 'APPLY',
    entradasValidas: staging.entradas.length,
    insertadas,
    omitidas: staging.entradas.length - insertadas,
  };
}
