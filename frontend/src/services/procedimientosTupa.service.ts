/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/services/procedimientosTupa.service.ts
 * ==============================================================================
 * ESTADO: PROVISIONAL / BLOCKED
 *
 * Capa única de acceso al catálogo TUPA del backend. Centraliza el fetch para
 * evitar duplicar llamadas entre el asistente (/tramite) y la ventanilla
 * (/tramite/ventanilla-presencial, /ventanilla).
 *
 * CONTRATO PENDIENTE (Christian):
 *   GET /api/v1/tramites/procedimientos-tupa
 * El endpoint solo aparece documentado en `backend/README.md`; aún NO existe en
 * el código del backend ni un DTO acordado. Cuando el contrato llegue, este
 * archivo es el único punto a ajustar.
 *
 * Regla: NUNCA sustituir un error por un catálogo mock. Un fallo se propaga como
 * error para que la UI muestre el estado correspondiente.
 * ==============================================================================
 */

import { apiClient } from '../api/client';
import { adaptarProcedimientoTupa, type ProcedimientoTupa } from '../types/procedimientoTupa';

/**
 * Endpoint documentado (PROVISIONAL/BLOCKED). No implementado todavía en backend.
 */
export const PROCEDIMIENTOS_TUPA_ENDPOINT = '/api/v1/tramites/procedimientos-tupa';

/**
 * Extrae la lista de procedimientos de las posibles envolturas de respuesta.
 */
function extraerLista(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload;

  if (payload && typeof payload === 'object') {
    const registro = payload as Record<string, unknown>;
    for (const clave of ['data', 'items', 'procedimientos', 'procedures', 'result', 'results', 'content']) {
      const valor = registro[clave];
      if (Array.isArray(valor)) return valor;
    }
  }

  return [];
}

/**
 * Obtiene y normaliza el catálogo TUPA.
 * @throws Error si la red o el backend fallan (NO hace fallback a datos locales).
 */
export async function obtenerCatalogoProcedimientosTupa(
  signal?: AbortSignal,
): Promise<ProcedimientoTupa[]> {
  const respuesta = await apiClient.get<unknown>(PROCEDIMIENTOS_TUPA_ENDPOINT, { signal });
  const crudos = extraerLista(respuesta.data);

  return crudos
    .map(adaptarProcedimientoTupa)
    .filter((procedimiento): procedimiento is ProcedimientoTupa => procedimiento !== null);
}
