import { apiClient } from '../api/client';
import { adaptarProcedimientoTupa, type ProcedimientoTupa } from '../types/procedimientoTupa';

export const PROCEDIMIENTOS_TUPA_ENDPOINT = '/api/v1/tramites/tupa';

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
