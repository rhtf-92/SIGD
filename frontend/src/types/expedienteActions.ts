import type { QueryKey } from "@tanstack/react-query";

/** Datos de interfaz, NO DTO de transporte: los DTO canónicos aún no existen. */
export interface ExpedienteAccionReferencia {
  readonly id: string;
  readonly codigo: string;
  readonly unidadOrigenId?: string;
}

export interface UnidadDestino {
  readonly id: string;
  readonly nombre: string;
  readonly habilitada: boolean;
}

export interface SolicitudDerivacion {
  readonly expediente: ExpedienteAccionReferencia;
  readonly unidadDestinoId: string;
  readonly proveido: string;
}

export interface SolicitudRecepcion {
  readonly expediente: ExpedienteAccionReferencia;
}

export interface SolicitudAtencion {
  readonly expediente: ExpedienteAccionReferencia;
  readonly resultado_resumen: string;
  readonly observacion_interna?: string;
  readonly documento_respuesta_id?: string;
  readonly s3_key?: string;
  readonly sha256?: string;
  readonly nombre_archivo?: string;
  readonly tamano_bytes?: number;
  readonly mime_type?: string;
}

export interface SolicitudArchivado {
  readonly expediente: ExpedienteAccionReferencia;
  readonly estante: string;
  readonly balda: string;
  readonly caja: string;
  readonly observaciones?: string;
}

export interface SolicitudObservacion {
  readonly expediente: ExpedienteAccionReferencia;
  readonly motivo: string;
}

export interface SolicitudSubsanacion {
  readonly expediente: ExpedienteAccionReferencia;
  readonly motivo: string;
}

export interface SolicitudAcumulacion {
  readonly principal: ExpedienteAccionReferencia;
  readonly conexos: readonly ExpedienteAccionReferencia[];
  readonly motivo: string;
}

export interface ResultadoDerivacion { derivacionId: string; nuevoEstado: string }
export interface ResultadoRecepcion { ok: boolean; expedienteId: string; nuevoEstado: string }
export interface ResultadoAtencion { ok: boolean; expedienteId: string; nuevoEstado: string }
export interface ResultadoArchivado { ok: boolean; expedienteId: string; nuevoEstado: string }
export interface ResultadoObservacion { estado: "OBSERVADO"; slaPaused: true }
export interface ResultadoSubsanacion { estado: "EN_REVISION" | "EN_TRAMITE"; expedienteId: string; motivo: string; estadoRutaDoc?: string; pestana?: string }

export type TipoErrorAccion = "http" | "red" | "integracion" | "respuesta" | "concurrencia";

export class ErrorAccionExpediente extends Error {
  constructor(message: string, readonly tipo: TipoErrorAccion, readonly status?: number) {
    super(message);
    this.name = "ErrorAccionExpediente";
  }
}

export interface ServicioExpedienteActions {
  derivar?: (entrada: SolicitudDerivacion) => Promise<ResultadoDerivacion>;
  recepcionar?: (entrada: SolicitudRecepcion) => Promise<ResultadoRecepcion>;
  atender?: (entrada: SolicitudAtencion) => Promise<ResultadoAtencion>;
  archivar?: (entrada: SolicitudArchivado) => Promise<ResultadoArchivado>;
  observar?: (entrada: SolicitudObservacion) => Promise<ResultadoObservacion>;
  subsanar?: (entrada: SolicitudSubsanacion) => Promise<ResultadoSubsanacion>;
  /** Adaptador futuro: solo resuelve cuando el servidor confirma la operación. */
  acumular?: (entrada: SolicitudAcumulacion) => Promise<void>;
}

export interface AccionExpediente<Entrada, Salida> {
  disponible: boolean;
  pending: boolean;
  estado: "idle" | "pending" | "success" | "error";
  error: ErrorAccionExpediente | null;
  resultado: Salida | undefined;
  ejecutar: (entrada: Entrada) => Promise<boolean>;
  restablecer: () => void;
}

export interface NotificacionExpediente {
  tipo: "success" | "error" | "aviso";
  mensaje: string;
}

export interface UseExpedienteActionsOptions {
  servicio?: ServicioExpedienteActions;
  /** Claves exactas del detalle, bandejas y contadores del consumidor. No hay claves compartidas aún. */
  obtenerClavesAfectadas: (ids: readonly string[]) => readonly QueryKey[];
  notificar?: (notificacion: NotificacionExpediente) => void;
}

export interface ModalAccionProps<Entrada, Salida> {
  open: boolean;
  onClose: () => void;
  expediente: ExpedienteAccionReferencia;
  accion: AccionExpediente<Entrada, Salida>;
}

export interface BusquedaExpedientes {
  /** Debe usar el catálogo real; el componente no construye una URL de búsqueda. */
  buscar: (texto: string, signal: AbortSignal) => Promise<readonly ExpedienteAccionReferencia[]>;
}
