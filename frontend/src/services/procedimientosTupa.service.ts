import { apiClient } from '../api/client';
import { adaptarProcedimientoTupa, esUuidCanonico, type ProcedimientoTupa } from '../types/procedimientoTupa';

export const PROCEDIMIENTOS_TUPA_ENDPOINT = '/api/v1/tramites/tupa?aprobados=true';

export interface RegistroTupaCompleto {
  readonly registroVersionId: string;
  readonly denominacion: string;
  readonly monto: string | null;
  readonly requisitos: readonly string[];
  readonly estadoValidacion: 'APROBADO' | 'PENDIENTE_VALIDACION';
  readonly revision: number;
  readonly vigenciaDesde: string | null;
  readonly vigenciaHasta: string | null;
  readonly fuente: { readonly nombre: string; readonly referenciaFila: string; readonly pagina: number };
}

/** Catálogo completo solo para usuarios autorizados por el backend. */
export async function obtenerCatalogoTupaCompleto(signal?: AbortSignal): Promise<RegistroTupaCompleto[]> {
  const respuesta = await apiClient.get<unknown>('/api/v1/tramites/tupa', { signal });
  if (!Array.isArray(respuesta.data)) throw new Error('Respuesta TUPA completa inválida.');
  const registros: RegistroTupaCompleto[] = [];
  const codigos = new Set<string>();
  for (const raw of respuesta.data) {
    if (typeof raw !== 'object' || raw === null) throw new Error('Fila TUPA inválida.');
    const fila = raw as Record<string, unknown>;
    const fuente = (typeof fila.fuente === 'object' && fila.fuente !== null)
      ? (fila.fuente as Record<string, unknown>)
      : {};

    const registroVersionId = String(fila.registroVersionId || fila.id_procedimiento || fila.idProcedimiento || '').trim();
    const referenciaFila = String(fuente.referenciaFila || fila.codigoRef || fila.codigo_ref || fila.codigo || fila.id || '').trim();
    const denominacion = String(fila.denominacion || '').trim();
    const nombreFuente = String(fuente.nombre || 'TUPA Institucional');
    const paginaFuente = typeof fuente.pagina === 'number' ? fuente.pagina : 1;
    const revision = typeof fila.revision === 'number' ? fila.revision : 1;
    const vigenciaDesde = typeof fila.vigenciaDesde === 'string' ? fila.vigenciaDesde : null;
    const vigenciaHasta = typeof fila.vigenciaHasta === 'string' ? fila.vigenciaHasta : null;
    const estadoValidacion = (fila.estadoValidacion === 'APROBADO' || fila.estadoValidacion === 'PENDIENTE_VALIDACION')
      ? fila.estadoValidacion
      : (fila.generaExpediente || fila.genera_expediente ? 'APROBADO' : 'PENDIENTE_VALIDACION');
    const monto = typeof fila.monto === 'string'
      ? fila.monto
      : (typeof fila.montoNumero === 'number' && fila.montoNumero > 0 ? `S/ ${fila.montoNumero.toFixed(2)}` : null);
    const requisitos = Array.isArray(fila.requisitos)
      ? fila.requisitos.filter((r): r is string => typeof r === 'string')
      : [];

    if (!esUuidCanonico(registroVersionId)
      || !denominacion
      || !referenciaFila
      || (estadoValidacion !== 'APROBADO' && estadoValidacion !== 'PENDIENTE_VALIDACION')) {
      throw new Error('Fila TUPA incompleta o incompatible.');
    }
    if (codigos.has(referenciaFila)) throw new Error('Fila TUPA duplicada.');
    codigos.add(referenciaFila);
    registros.push({
      registroVersionId,
      denominacion,
      monto,
      requisitos,
      estadoValidacion,
      revision,
      vigenciaDesde,
      vigenciaHasta,
      fuente: { nombre: nombreFuente, referenciaFila, pagina: paginaFuente },
    });
  }
  return registros;
}

/**
 * Obtiene el arreglo directo publicado por el backend TUPA versionado.
 * No acepta envolturas legadas y nunca usa catálogos locales como fallback.
 */
export async function obtenerCatalogoProcedimientosTupa(
  signal?: AbortSignal,
): Promise<ProcedimientoTupa[]> {
  const respuesta = await apiClient.get<unknown>(PROCEDIMIENTOS_TUPA_ENDPOINT, { signal });
  if (!Array.isArray(respuesta.data)) {
    throw new Error('El catálogo TUPA no cumple el contrato de respuesta esperado.');
  }

  return respuesta.data
    .map(adaptarProcedimientoTupa)
    .filter((procedimiento): procedimiento is ProcedimientoTupa => procedimiento !== null);
}
