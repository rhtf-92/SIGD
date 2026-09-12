/** Evento inmutable de la hoja de ruta de un expediente. */
export type TipoMovimientoExpediente =
  | "CREACION"
  | "RECEPCION"
  | "DERIVACION"
  | "OBSERVACION"
  | "SUBSANACION"
  | "NOTIFICACION"
  | "ARCHIVADO"
  | "DESARCHIVADO"
  | "OTRO";

export interface DocumentoAsociadoTrazabilidad {
  readonly id: string;
  readonly nombre: string;
  readonly url?: string;
}

export interface EventoTrazabilidadExpediente {
  readonly id: string;
  /** Fecha y hora en formato ISO 8601. */
  readonly fechaHora: string;
  readonly unidadEmisora: string;
  readonly unidadReceptora: string;
  readonly servidorResponsable: string;
  readonly tipoMovimiento: TipoMovimientoExpediente;
  readonly proveido: string;
  readonly hashIntegridad: string;
  readonly documentoAsociado?: DocumentoAsociadoTrazabilidad;
}

export type EventoTrazabilidad = EventoTrazabilidadExpediente;

