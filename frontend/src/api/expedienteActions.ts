import { ErrorAccionExpediente } from "../types/expedienteActions";
import type { ResultadoDerivacion, ResultadoObservacion, ServicioExpedienteActions, SolicitudDerivacion, SolicitudObservacion } from "../types/expedienteActions";

/** Implementar únicamente después de verificar el DTO real y sus consumidores. */
export interface AdaptadorPayload<Entrada> {
  construirPayload: (entrada: Entrada) => Readonly<Record<string, unknown>>;
}

export interface ContratosExpedienteActions {
  derivacion?: AdaptadorPayload<SolicitudDerivacion>;
  observacion?: AdaptadorPayload<SolicitudObservacion>;
  acumulacion?: ServicioExpedienteActions["acumular"];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function respuestaNoConfirmada(): never {
  throw new ErrorAccionExpediente("El servidor devolvió una respuesta no reconocida. Compruebe el expediente antes de repetir la acción.", "respuesta");
}

function urlMovimiento(id: string, accion: "derivar" | "observar", baseURL: string | undefined): string {
  // El cliente de ejemplo termina en /api. Una URL absoluta evita /api/api/v1.
  const base = new URL(baseURL ?? "/", window.location.origin);
  return new URL(`/api/v1/expedientes/${encodeURIComponent(id)}/movimientos/${accion}`, base).href;
}

/** Rutas documentadas; no se habilitan sin un adaptador del DTO canónico. */
export function crearServicioExpedienteActions(contratos: ContratosExpedienteActions = {}): ServicioExpedienteActions {
  const servicio: ServicioExpedienteActions = {};
  const { derivacion, observacion, acumulacion } = contratos;
  if (derivacion) servicio.derivar = async (entrada): Promise<ResultadoDerivacion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "derivar", apiClient.defaults.baseURL), derivacion.construirPayload(entrada));
    if (!esObjeto(data) || typeof data.derivacionId !== "string" || !data.derivacionId.trim() || typeof data.nuevoEstado !== "string" || !data.nuevoEstado.trim()) respuestaNoConfirmada();
    return { derivacionId: data.derivacionId, nuevoEstado: data.nuevoEstado };
  };
  if (observacion) servicio.observar = async (entrada): Promise<ResultadoObservacion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "observar", apiClient.defaults.baseURL), observacion.construirPayload(entrada));
    if (!esObjeto(data) || data.estado !== "OBSERVADO" || data.slaPaused !== true) respuestaNoConfirmada();
    return { estado: "OBSERVADO", slaPaused: true };
  };
  if (acumulacion) servicio.acumular = acumulacion;
  return servicio;
}
