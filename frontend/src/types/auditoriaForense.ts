// Modelos forenses de la bitácora de auditoría inmutable WORM (ENT-M05-04)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-04

export type ResultadoAuditoria = "Exitoso" | "Denegado" | "Error";

export interface RegistroAuditoria {
  id: string;
  fecha: string;
  usuario: string;
  rol: string;
  area: string;
  accion: string;
  modulo: string;
  registro: string;
  resultado: ResultadoAuditoria;
  ip: string;
  correlationId?: string;
  detallesTecnicos?: Record<string, unknown>;
}