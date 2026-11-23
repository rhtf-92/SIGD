import { ErrorAccionExpediente } from "../types/expedienteActions";
import type { ResultadoDerivacion, ResultadoObservacion, ResultadoRecepcion, ServicioExpedienteActions, SolicitudDerivacion, SolicitudObservacion, SolicitudRecepcion } from "../types/expedienteActions";

/** Implementar únicamente después de verificar el DTO real y sus consumidores. */
export interface AdaptadorPayload<Entrada> {
  construirPayload: (entrada: Entrada) => Readonly<Record<string, unknown>>;
}

export interface ContratosExpedienteActions {
  derivacion?: AdaptadorPayload<SolicitudDerivacion>;
  observacion?: AdaptadorPayload<SolicitudObservacion>;
  acumulacion?: ServicioExpedienteActions["acumular"];
  desacumulacion?: ServicioExpedienteActions["desacumular"];
  desglose?: ServicioExpedienteActions["desglosar"];
  recepcion?: AdaptadorPayload<SolicitudRecepcion> | boolean;
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function respuestaNoConfirmada(): never {
  throw new ErrorAccionExpediente("El servidor devolvió una respuesta no reconocida. Compruebe el expediente antes de repetir la acción.", "respuesta");
}

function urlMovimiento(id: string, accion: "derivar" | "observar" | "recepcionar", baseURL: string | undefined): string {
  // Ruta absoluta: evita duplicar el prefijo si el baseURL ya incluye /api o /api/v1.
  const base = new URL(baseURL ?? "/", window.location.origin);
  return new URL(`/api/v1/expedientes/${encodeURIComponent(id)}/movimientos/${accion}`, base).href;
}

/** Rutas documentadas; no se habilitan sin un adaptador del DTO canónico. */
export function crearServicioExpedienteActions(contratos: ContratosExpedienteActions = {}): ServicioExpedienteActions {
  const servicio: ServicioExpedienteActions = {};
  const { derivacion, observacion, acumulacion, desacumulacion, desglose, recepcion } = contratos;
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
  if (desacumulacion) servicio.desacumular = desacumulacion;
  if (desglose) servicio.desglosar = desglose;
  if (recepcion) servicio.recepcionar = async (entrada): Promise<ResultadoRecepcion> => {
    const { apiClient } = await import("./client");
    const payload = typeof recepcion === "object" && recepcion.construirPayload
      ? recepcion.construirPayload(entrada)
      : { observaciones: entrada.observaciones };
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "recepcionar", apiClient.defaults.baseURL), payload);
    if (!esObjeto(data) || data.nuevoEstado !== "EN_REVISION") respuestaNoConfirmada();
    return data as unknown as ResultadoRecepcion;
  };
  return servicio;
}

export async function obtenerResolucionPorExpediente(expedienteId: string): Promise<import("../types/expediente").ResolucionInfoRutaDoc | null> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.get<{ ok: boolean; resolucion: import("../types/expediente").ResolucionInfoRutaDoc | null }>(
    `/api/v1/resoluciones/expediente/${encodeURIComponent(expedienteId)}`
  );
  return data?.resolucion ?? null;
}

export async function elevarExpedienteAFirma(
  expedienteId: string,
  resumen?: string
): Promise<{ ok: boolean; mensaje: string; expediente_id: string }> {
  const { apiClient } = await import("./client");
  const { data } = await apiClient.post<{ ok: boolean; mensaje: string; expediente_id: string }>(
    `/api/v1/expedientes/${encodeURIComponent(expedienteId)}/atender`,
    {
      resultado_resumen: resumen || "Proyecto de Resolución Directoral elevado a Despacho de Dirección General para firma digital.",
    }
  );
  return data;
}
