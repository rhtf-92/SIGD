import { apiClient } from "../../../api/client";
import { validarRespuesta } from "./rutadoc.adapters";
import { uuid } from "./rutadoc.dto";
import { contextoTupaSchema, type ContextoTupaExpediente } from "./tupa.dto";

function url(expedienteId: string) {
  // Evita duplicar /api al usar baseURL=/api.
  return new URL(`/api/v1/tramites/expedientes/${encodeURIComponent(expedienteId)}/tupa`,
    new URL(apiClient.defaults.baseURL || "/", window.location.origin)).href;
}

/**
 * Lectura de solo lectura del contexto TUPA persistido del expediente.
 * Rechaza identificadores no UUID antes de consultar y valida el contrato.
 */
export async function obtenerContextoTupa(
  expedienteId: string,
  signal?: AbortSignal,
): Promise<ContextoTupaExpediente> {
  if (!uuid.safeParse(expedienteId).success) {
    throw new Error("400: UUID de expediente inválido.");
  }
  const { data } = await apiClient.get<unknown>(url(expedienteId), { signal });
  return validarRespuesta(contextoTupaSchema, data);
}
