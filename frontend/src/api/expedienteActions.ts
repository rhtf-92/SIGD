import { ErrorAccionExpediente } from "../types/expedienteActions";
import type {
  ResultadoDerivacion,
  ResultadoRecepcion,
  ResultadoAtencion,
  ResultadoArchivado,
  ResultadoObservacion,
  ResultadoSubsanacion,
  ServicioExpedienteActions,
  SolicitudDerivacion,
  SolicitudRecepcion,
  SolicitudAtencion,
  SolicitudArchivado,
  SolicitudObservacion,
  SolicitudSubsanacion
} from "../types/expedienteActions";

/** Implementar únicamente después de verificar el DTO real y sus consumidores. */
export interface AdaptadorPayload<Entrada> {
  construirPayload: (entrada: Entrada) => Readonly<Record<string, unknown>>;
}

export interface ContratosExpedienteActions {
  derivacion?: AdaptadorPayload<SolicitudDerivacion>;
  recepcion?: AdaptadorPayload<SolicitudRecepcion>;
  atencion?: AdaptadorPayload<SolicitudAtencion>;
  archivado?: AdaptadorPayload<SolicitudArchivado>;
  observacion?: AdaptadorPayload<SolicitudObservacion>;
  subsanacion?: AdaptadorPayload<SolicitudSubsanacion>;
  acumulacion?: ServicioExpedienteActions["acumular"];
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === "object" && valor !== null;
}

function respuestaNoConfirmada(): never {
  throw new ErrorAccionExpediente("El servidor devolvió una respuesta no reconocida. Compruebe el expediente antes de repetir la acción.", "respuesta");
}

function urlMovimiento(id: string, accion: "derivar" | "recepcionar" | "atender" | "archivar" | "observar" | "subsanar", baseURL: string | undefined): string {
  // Ruta absoluta: evita duplicar el prefijo si el baseURL ya incluye /api o /api/v1.
  const base = new URL(baseURL ?? "/", window.location.origin);
  return new URL(`/api/v1/expedientes/${encodeURIComponent(id)}/movimientos/${accion}`, base).href;
}

/** Rutas documentadas; no se habilitan sin un adaptador del DTO canónico. */
export function crearServicioExpedienteActions(contratos: ContratosExpedienteActions = {}): ServicioExpedienteActions {
  const servicio: ServicioExpedienteActions = {};
  const { derivacion, recepcion, atencion, archivado, observacion, subsanacion, acumulacion } = contratos;
  if (derivacion) servicio.derivar = async (entrada: SolicitudDerivacion): Promise<ResultadoDerivacion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "derivar", apiClient.defaults.baseURL), derivacion.construirPayload(entrada));
    if (!esObjeto(data) || typeof data.derivacionId !== "string" || !data.derivacionId.trim() || typeof data.nuevoEstado !== "string" || !data.nuevoEstado.trim()) respuestaNoConfirmada();
    return { derivacionId: data.derivacionId, nuevoEstado: data.nuevoEstado };
  };
  if (recepcion) servicio.recepcionar = async (entrada: SolicitudRecepcion): Promise<ResultadoRecepcion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "recepcionar", apiClient.defaults.baseURL), recepcion.construirPayload(entrada));
    if (!esObjeto(data) || data.ok !== true) respuestaNoConfirmada();
    return { ok: true, expedienteId: entrada.expediente.id, nuevoEstado: (data.nuevoEstado as string) || "EN_REVISION" };
  };
  if (atencion) servicio.atender = async (entrada: SolicitudAtencion): Promise<ResultadoAtencion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "atender", apiClient.defaults.baseURL), atencion.construirPayload(entrada));
    if (!esObjeto(data) || data.ok !== true) respuestaNoConfirmada();
    return { ok: true, expedienteId: entrada.expediente.id, nuevoEstado: (data.nuevoEstado as string) || "RESUELTO" };
  };
  if (archivado) servicio.archivar = async (entrada: SolicitudArchivado): Promise<ResultadoArchivado> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "archivar", apiClient.defaults.baseURL), archivado.construirPayload(entrada));
    if (!esObjeto(data) || data.ok !== true) respuestaNoConfirmada();
    return { ok: true, expedienteId: entrada.expediente.id, nuevoEstado: (data.nuevoEstado as string) || "ARCHIVADO" };
  };
  if (observacion) servicio.observar = async (entrada: SolicitudObservacion): Promise<ResultadoObservacion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "observar", apiClient.defaults.baseURL), observacion.construirPayload(entrada));
    if (!esObjeto(data) || data.estado !== "OBSERVADO" || data.slaPaused !== true) respuestaNoConfirmada();
    return { estado: "OBSERVADO", slaPaused: true };
  };
  if (subsanacion) servicio.subsanar = async (entrada: SolicitudSubsanacion): Promise<ResultadoSubsanacion> => {
    const { apiClient } = await import("./client");
    const { data } = await apiClient.post<unknown>(urlMovimiento(entrada.expediente.id, "subsanar", apiClient.defaults.baseURL), subsanacion.construirPayload(entrada));
    if (!esObjeto(data) || data.ok !== true || (data.estado !== "EN_REVISION" && data.estado !== "EN_TRAMITE") || data.expedienteId !== entrada.expediente.id || typeof data.motivo !== "string") respuestaNoConfirmada();
    return {
      estado: data.estado as "EN_REVISION" | "EN_TRAMITE",
      expedienteId: data.expedienteId,
      motivo: data.motivo,
      estadoRutaDoc: typeof data.estadoRutaDoc === "string" ? data.estadoRutaDoc : undefined,
      pestana: typeof data.pestana === "string" ? data.pestana : undefined,
    };
  };
  if (acumulacion) servicio.acumular = acumulacion;
  return servicio;
}

/**
 * Contratos canónicos verificados contra BASELINE_2026_V1 y endpoints de RutaDoc.
 */
export const contratosRealesExpedienteActions: ContratosExpedienteActions = {
  derivacion: {
    construirPayload: (entrada: SolicitudDerivacion) => ({
      destinos: [
        {
          area_destino_id: entrada.unidadDestinoId,
          es_copia: false,
        },
      ],
      proveido: entrada.proveido,
    }),
  },
  recepcion: {
    construirPayload: () => ({}),
  },
  atencion: {
    construirPayload: (entrada: SolicitudAtencion) => ({
      resultado_resumen: entrada.resultado_resumen,
      observacion_interna: entrada.observacion_interna || undefined,
      documento_respuesta_id: entrada.documento_respuesta_id || undefined,
      s3_key: entrada.s3_key || undefined,
      sha256: entrada.sha256 || undefined,
      nombre_archivo: entrada.nombre_archivo || undefined,
      tamano_bytes: entrada.tamano_bytes || undefined,
      mime_type: entrada.mime_type || undefined,
    }),
  },
  archivado: {
    construirPayload: (entrada: SolicitudArchivado) => ({
      estante: entrada.estante,
      balda: entrada.balda,
      caja: entrada.caja,
      observaciones: entrada.observaciones || undefined,
    }),
  },
  observacion: {
    construirPayload: (entrada: SolicitudObservacion) => ({
      motivo: entrada.motivo,
      observacion: entrada.motivo,
    }),
  },
  subsanacion: {
    construirPayload: (entrada: SolicitudSubsanacion) => ({ motivo: entrada.motivo }),
  },
  acumulacion: async (entrada) => {
    const { apiClient } = await import("./client");
    const idPrincipal = entrada.principal.id;
    const accesorioId = entrada.conexos[0]?.id;
    if (!accesorioId) {
      throw new ErrorAccionExpediente("Debe seleccionar al menos un expediente conexo para acumular.", "integracion");
    }
    const base = new URL(apiClient.defaults.baseURL ?? "/", window.location.origin);
    const url = new URL(`/api/v1/expedientes/${encodeURIComponent(idPrincipal)}/movimientos/acumular`, base).href;
    await apiClient.post(url, {
      expedienteAccesorioId: accesorioId,
      actoResolutivo: entrada.motivo,
      conexos: entrada.conexos.map((c) => ({ id: c.id, codigo: c.codigo })),
    });
  },
};

export const servicioExpedienteActionsReal = crearServicioExpedienteActions(contratosRealesExpedienteActions);
