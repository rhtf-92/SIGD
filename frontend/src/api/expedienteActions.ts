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
  if (desacumulacion) {
    servicio.desacumular = desacumulacion;
  } else {
    servicio.desacumular = async (entrada) => {
      const { apiClient } = await import("./client");
      await apiClient.post(`/api/v1/rutadoc/expedientes/${encodeURIComponent(entrada.principalId)}/desacumular`, {
        expedienteAccesorioId: entrada.accesorioId,
        actoDesacumulacion: entrada.actoDesacumulacion,
        motivo: entrada.motivo,
      });
    };
  }
  if (desglose) {
    servicio.desglosar = desglose;
  } else {
    servicio.desglosar = async (entrada) => {
      const { apiClient } = await import("./client");
      const { data } = await apiClient.post<{
        ok: boolean;
        idDesglose: string;
        expedienteId: string;
        documentoAdjuntoId: string;
        folioInicio: number;
        folioFin: number;
        cantidadFolios: number;
        documentoSustitutorioId?: string | null;
      }>(`/api/v1/rutadoc/expedientes/${encodeURIComponent(entrada.expedienteId)}/desglose`, {
        documentoAdjuntoId: entrada.documentoAdjuntoId,
        actoAutorizacion: entrada.actoAutorizacion,
        motivoDesglose: entrada.motivo,
        solicitanteNombre: entrada.solicitanteNombre,
        solicitanteDocumento: entrada.solicitanteDocumento,
        documentoSustitutorioId: entrada.documentoSustitutorioId || null,
        observaciones: entrada.observaciones || null,
      });
      return {
        idDesglose: data.idDesglose,
        expedienteId: data.expedienteId,
        documentoAdjuntoId: data.documentoAdjuntoId,
        folioInicio: data.folioInicio,
        folioFin: data.folioFin,
        cantidadFolios: data.cantidadFolios,
        documentoSustitutorioId: data.documentoSustitutorioId,
      };
    };
  }
  servicio.listarAcumulaciones = async (expedienteId: string) => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.get<{ ok: boolean; acumulaciones: import("../types/expediente").ItemAcumulacion[] }>(
      `/api/v1/rutadoc/expedientes/${encodeURIComponent(expedienteId)}/acumulaciones`
    );
    return data.acumulaciones ?? [];
  };
  servicio.listarDesgloses = async (expedienteId: string) => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.get<{ ok: boolean; desgloses: import("../types/expediente").ItemDesglose[] }>(
      `/api/v1/rutadoc/expedientes/${encodeURIComponent(expedienteId)}/desgloses`
    );
    return data.desgloses ?? [];
  };
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
