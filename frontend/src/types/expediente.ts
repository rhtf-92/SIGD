export type EstadoExpediente =
  | "Pendiente"
  | "En Proceso"
  | "Observado"
  | "Derivado"
  | "Notificado"
  | "Archivado";

export type MovimientoExpediente = "Entrada" | "Salida";

export interface Expediente {
  id: number;
  codigo: string;
  solicitante: string;
  documento: string;
  asunto: string;
  fecha: string;
  estado: EstadoExpediente;
  movimiento: MovimientoExpediente;
  area: string;
}