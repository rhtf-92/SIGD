/** Contrato publicado por GET /api/v1/tramites/tupa. */

export interface FuenteTupa {
  readonly nombre: string;
  readonly documentoSha256: string;
  readonly pagina: number;
  readonly referenciaFila: string;
}

export interface VersionTupa {
  readonly etiqueta: string | null;
  readonly revision: number;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
}

export interface VigenciaTupa {
  readonly desde: string | null;
  readonly hasta: string | null;
}

export interface ProcedimientoTupaApi {
  readonly registroVersionId: string;
  readonly codigoExterno: string | null;
  readonly codigo: string | null;
  readonly denominacion: string;
  readonly monto: string | null;
  readonly requisitos: readonly string[] | null;
  readonly fuente: FuenteTupa;
  readonly pagina: number;
  readonly revision: number;
  readonly vigencia: VigenciaTupa;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
  readonly version: VersionTupa;
  readonly estadoValidacion: 'APROBADO';
  readonly estado: 'APROBADO';
  readonly referenciaAprobacion: string;
  readonly id: string;
}

/** Modelo normalizado para la UI. registroVersionId es el único identificador de selección. */
export interface ProcedimientoTupa extends Omit<ProcedimientoTupaApi, 'requisitos' | 'vigencia'> {
  readonly requisitos: readonly string[];
  readonly vigencia: VigenciaTupa | null;
}

const UUID_CANONICO = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

function esCadenaONull(valor: unknown): valor is string | null {
  return valor === null || typeof valor === 'string';
}

function esEntero(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isInteger(valor);
}

function esFuente(valor: unknown): valor is FuenteTupa {
  return esObjeto(valor)
    && typeof valor.nombre === 'string'
    && typeof valor.documentoSha256 === 'string'
    && SHA256.test(valor.documentoSha256)
    && esEntero(valor.pagina)
    && typeof valor.referenciaFila === 'string';
}

function esVersion(valor: unknown): valor is VersionTupa {
  return esObjeto(valor)
    && esCadenaONull(valor.etiqueta)
    && esEntero(valor.revision)
    && esCadenaONull(valor.vigenciaDesde)
    && esCadenaONull(valor.vigenciaHasta);
}

function esVigencia(valor: unknown): valor is VigenciaTupa {
  return esObjeto(valor) && esCadenaONull(valor.desde) && esCadenaONull(valor.hasta);
}

export function esUuidCanonico(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID_CANONICO.test(valor);
}

export const esRegistroVersionIdValido = esUuidCanonico;

/**
 * Valida el DTO real sin aceptar alias, índices, códigos sintéticos ni envolturas legadas.
 * Una fila inválida se excluye; nunca se sustituye por un mock.
 */
export function adaptarProcedimientoTupa(raw: unknown): ProcedimientoTupa | null {
  if (!esObjeto(raw)) return null;
  if (!esRegistroVersionIdValido(raw.registroVersionId)) return null;
  if (typeof raw.denominacion !== 'string' || raw.denominacion.trim().length === 0) return null;
  if (!esCadenaONull(raw.codigoExterno) || !esCadenaONull(raw.codigo)) return null;
  if (!esCadenaONull(raw.monto)) return null;
  if (raw.requisitos !== null && (!Array.isArray(raw.requisitos) || !raw.requisitos.every((r) => typeof r === 'string'))) return null;
  if (!esFuente(raw.fuente) || !esVersion(raw.version) || !esVigencia(raw.vigencia)) return null;
  if (!esEntero(raw.pagina) || !esEntero(raw.revision)) return null;
  if (!esCadenaONull(raw.vigenciaDesde) || !esCadenaONull(raw.vigenciaHasta)) return null;
  if (raw.estadoValidacion !== 'APROBADO' || raw.estado !== 'APROBADO') return null;
  if (typeof raw.referenciaAprobacion !== 'string' || typeof raw.id !== 'string') return null;
  if (raw.id !== raw.registroVersionId || raw.codigo !== raw.codigoExterno) return null;

  const vigencia = raw.vigencia.desde === null && raw.vigencia.hasta === null
    ? null
    : raw.vigencia;

  return {
    registroVersionId: raw.registroVersionId,
    codigoExterno: raw.codigoExterno,
    codigo: raw.codigo,
    denominacion: raw.denominacion.trim(),
    monto: raw.monto,
    requisitos: raw.requisitos ?? [],
    fuente: raw.fuente,
    pagina: raw.pagina,
    revision: raw.revision,
    vigencia,
    vigenciaDesde: raw.vigenciaDesde,
    vigenciaHasta: raw.vigenciaHasta,
    version: raw.version,
    estadoValidacion: raw.estadoValidacion,
    estado: raw.estado,
    referenciaAprobacion: raw.referenciaAprobacion,
    id: raw.id,
  };
}
