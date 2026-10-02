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

export interface SolicitudObservacion {
  readonly expediente: ExpedienteAccionReferencia;
  readonly motivo: string;
}

export interface SolicitudAcumulacion {
  readonly principal: ExpedienteAccionReferencia;
  readonly conexos: readonly ExpedienteAccionReferencia[];
  readonly motivo: string;
}

/** Formas de respuesta documentadas en el plan, verificadas en tiempo de ejecución. */
export interface ResultadoDerivacion { derivacionId: string; nuevoEstado: string }
export interface ResultadoObservacion { estado: "OBSERVADO"; slaPaused: true }

export type TipoErrorAccion = "http" | "red" | "integracion" | "respuesta" | "concurrencia";

export class ErrorAccionExpediente extends Error {
  constructor(message: string, readonly tipo: TipoErrorAccion, readonly status?: number) {
    super(message);
    this.name = "ErrorAccionExpediente";
  }
}

export interface ServicioExpedienteActions {
  derivar?: (entrada: SolicitudDerivacion) => Promise<ResultadoDerivacion>;
  observar?: (entrada: SolicitudObservacion) => Promise<ResultadoObservacion>;
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
