/**
 * Contratos TypeScript de trazabilidad inmutable del expediente (ENT-M03-03).
 * Fuente normativa: frontend/docs/05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md
 *
 * Principio inquebrantable: ningún evento aquí representado puede editarse ni eliminarse
 * desde la interfaz. El Timeline es de solo lectura (Write Once, Read Many).
 */

/** Tipo de evento registrado en la bitácora inmutable del expediente. */
export type TipoEventoBitacora =
  | "CREACION"
  | "RECEPCION"
  | "VERSION_ADJUNTA"
  | "DERIVACION"
  | "OBSERVACION"
  | "SUBSANACION"
  | "NOTIFICACION"
  | "ARCHIVADO"
  | "DESARCHIVADO";

/** Bitácora de auditoría inmutable y eventos del expediente (un nodo del Timeline). */
export interface BitacoraEventoExpediente {
  eventoId: string;
  expedienteId: string;
  tipoEvento: TipoEventoBitacora;
  /** Marca temporal ISO 8601 del evento. */
  timestamp: string;
  usuarioId: string;
  usuarioNombre: string;
  areaNombre: string;
  estadoAnterior?: string;
  estadoNuevo: string;
  descripcionDetallada: string;
  /** Huella SHA-256 de la transacción, para verificación de integridad del historial. */
  hashTransaccion: string;
}

/** Etiquetas legibles en español para cada tipo de evento del Timeline. */
export const ETIQUETAS_TIPO_EVENTO: Record<TipoEventoBitacora, string> = {
  CREACION: "Registro del expediente",
  RECEPCION: "Recepción formal",
  VERSION_ADJUNTA: "Documento adjuntado",
  DERIVACION: "Derivación a otra área",
  OBSERVACION: "Observación emitida",
  SUBSANACION: "Subsanación recibida",
  NOTIFICACION: "Notificación al administrado",
  ARCHIVADO: "Archivo definitivo",
  DESARCHIVADO: "Desarchivo motivado",
};
