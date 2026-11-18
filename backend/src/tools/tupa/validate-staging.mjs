const SHA_256_SQL = /^[0-9a-f]{64}$/;
const FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
const ESTADOS_SQL = new Set(['PENDIENTE_VALIDACION', 'APROBADO', 'RECHAZADO']);
const CLASIFICACIONES = new Set([
  'PROCEDIMIENTO_DOCUMENTARIO', 'SERVICIO_ACADEMICO', 'PAGO_DERECHO',
  'BIEN_SERVICIO', 'OTRO', 'REQUIERE_DECISION',
]);
const CANDIDATURAS_RADICACION = new Set([
  'CANDIDATO', 'NO_CANDIDATO', 'REQUIERE_DECISION',
]);
const ESTADOS_HOMOLOGACION = new Set([
  'LISTO_PARA_REVISION', 'REQUIERE_DECISION', 'NO_APLICA_SIGD',
]);

function esObjeto(valor) {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function textoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0;
}

function textoONull(valor) {
  return valor === null || typeof valor === 'string';
}

function enteroPositivo(valor) {
  return Number.isSafeInteger(valor) && valor > 0;
}

function jsonValido(valor, visitados = new Set()) {
  if (valor === null || typeof valor === 'string' || typeof valor === 'boolean') return true;
  if (typeof valor === 'number') return Number.isFinite(valor);
  if (typeof valor !== 'object') return false;
  if (visitados.has(valor)) return false;
  visitados.add(valor);
  const valores = Array.isArray(valor) ? valor : Object.values(valor);
  const valido = valores.every((item) => jsonValido(item, visitados));
  visitados.delete(valor);
  return valido;
}

function fechaValida(valor) {
  if (valor === null) return true;
  if (!FECHA_ISO.test(valor)) return false;
  const fecha = new Date(`${valor}T00:00:00Z`);
  return !Number.isNaN(fecha.valueOf()) && fecha.toISOString().slice(0, 10) === valor;
}

export function validarStaging(valor) {
  const errores = [];
  if (!esObjeto(valor)) return { ok: false, errores: ['El staging debe ser un objeto JSON.'] };

  if (valor.schemaVersion !== 1) errores.push('schemaVersion debe ser 1.');
  if (!esObjeto(valor.fuente)) errores.push('fuente debe ser un objeto.');
  if (!Array.isArray(valor.entradas)) errores.push('entradas debe ser un arreglo.');
  if (errores.length > 0) return { ok: false, errores };

  const fuente = valor.fuente;
  if (!textoNoVacio(fuente.archivoNombre)) errores.push('fuente.archivoNombre es obligatorio.');
  if (!SHA_256_SQL.test(String(fuente.documentoSha256 ?? ''))) {
    errores.push('fuente.documentoSha256 debe contener 64 caracteres hexadecimales en minusculas.');
  }
  if (fuente.tamanoBytes !== null && !enteroPositivo(fuente.tamanoBytes)) {
    errores.push('fuente.tamanoBytes debe ser null o un entero positivo.');
  }
  if (fuente.numeroPaginas !== null && !enteroPositivo(fuente.numeroPaginas)) {
    errores.push('fuente.numeroPaginas debe ser null o un entero positivo.');
  }
  if (typeof fuente.hashVerificado !== 'boolean') errores.push('fuente.hashVerificado debe ser booleano.');

  const claves = new Set();
  valor.entradas.forEach((item, indice) => {
    const prefijo = `entradas[${indice}]`;
    if (!esObjeto(item)) {
      errores.push(`${prefijo} debe ser un objeto.`);
      return;
    }
    const sha = String(item.documentoSha256 ?? '');
    if (!SHA_256_SQL.test(sha)) errores.push(`${prefijo}.documentoSha256 no es un SHA-256 valido.`);
    if (sha !== fuente.documentoSha256) errores.push(`${prefijo}.documentoSha256 no coincide con la fuente.`);
    if (!textoNoVacio(item.fuenteNombre)) errores.push(`${prefijo}.fuenteNombre es obligatorio.`);
    if (item.fuenteNombre !== fuente.archivoNombre) errores.push(`${prefijo}.fuenteNombre no coincide con la fuente.`);
    if (!enteroPositivo(item.pagina)) errores.push(`${prefijo}.pagina debe ser un entero mayor que cero.`);
    if (enteroPositivo(item.pagina) && enteroPositivo(fuente.numeroPaginas) && item.pagina > fuente.numeroPaginas) {
      errores.push(`${prefijo}.pagina excede el numero de paginas de la fuente.`);
    }
    if (!textoNoVacio(item.referenciaFila)) errores.push(`${prefijo}.referenciaFila es obligatoria.`);
    if (!enteroPositivo(item.revision)) errores.push(`${prefijo}.revision debe ser un entero mayor que cero.`);
    if (!textoONull(item.codigoExterno)) errores.push(`${prefijo}.codigoExterno debe ser texto o null.`);
    if (!textoNoVacio(item.textoOriginal)) errores.push(`${prefijo}.textoOriginal es obligatorio para trazabilidad.`);
    if (!textoNoVacio(item.denominacionOriginal)) errores.push(`${prefijo}.denominacionOriginal no puede estar vacia.`);
    if (!textoONull(item.montoOriginal)) errores.push(`${prefijo}.montoOriginal debe ser texto o null.`);
    if (!jsonValido(item.requisitosOriginal)) errores.push(`${prefijo}.requisitosOriginal no es JSON valido.`);
    if (!textoONull(item.referenciaNormativaOriginal)) errores.push(`${prefijo}.referenciaNormativaOriginal debe ser texto o null.`);
    if (!textoONull(item.versionFuente)) errores.push(`${prefijo}.versionFuente debe ser texto o null.`);
    if (!textoONull(item.vigenciaDesde) || !fechaValida(item.vigenciaDesde)) {
      errores.push(`${prefijo}.vigenciaDesde debe ser null o YYYY-MM-DD valido.`);
    }
    if (!textoONull(item.vigenciaHasta) || !fechaValida(item.vigenciaHasta)) {
      errores.push(`${prefijo}.vigenciaHasta debe ser null o YYYY-MM-DD valido.`);
    }
    if (typeof item.vigenciaDesde === 'string' && typeof item.vigenciaHasta === 'string' && item.vigenciaHasta < item.vigenciaDesde) {
      errores.push(`${prefijo}.vigenciaHasta no puede ser anterior a vigenciaDesde.`);
    }
    if (!ESTADOS_SQL.has(item.estadoValidacion)) errores.push(`${prefijo}.estadoValidacion no coincide con el CHECK SQL.`);
    if (!textoONull(item.referenciaAprobacion)) errores.push(`${prefijo}.referenciaAprobacion debe ser texto o null.`);
    if (item.estadoValidacion === 'APROBADO' && !textoNoVacio(item.referenciaAprobacion)) {
      errores.push(`${prefijo}.referenciaAprobacion es obligatoria para APROBADO.`);
    }
    if (!CLASIFICACIONES.has(item.clasificacion)) errores.push(`${prefijo}.clasificacion no es valida.`);
    if (!CANDIDATURAS_RADICACION.has(item.candidatoRadicacion)) {
      errores.push(`${prefijo}.candidatoRadicacion no es valido.`);
    }
    if (!ESTADOS_HOMOLOGACION.has(item.estadoHomologacion)) {
      errores.push(`${prefijo}.estadoHomologacion no es valido.`);
    }
    if (!textoNoVacio(item.observacionClasificacion)) {
      errores.push(`${prefijo}.observacionClasificacion es obligatoria.`);
    }

    if (SHA_256_SQL.test(sha) && enteroPositivo(item.pagina) && textoNoVacio(item.referenciaFila) && enteroPositivo(item.revision)) {
      const clave = `${sha}|${item.pagina}|${item.referenciaFila}|${item.revision}`;
      if (claves.has(clave)) errores.push(`${prefijo} esta duplicada segun uq_tupa_registro_procedencia.`);
      claves.add(clave);
    }
  });

  return errores.length === 0
    ? { ok: true, errores, datos: valor }
    : { ok: false, errores };
}

export function cargarStagingDesdeTexto(texto) {
  let valor;
  try {
    valor = JSON.parse(texto);
  } catch (error) {
    throw new Error(`JSON invalido: ${error instanceof Error ? error.message : 'error desconocido'}`);
  }
  const resultado = validarStaging(valor);
  if (!resultado.ok || !resultado.datos) {
    throw new Error(`Staging invalido:\n${resultado.errores.join('\n')}`);
  }
  return resultado.datos;
}
