/**
 * Módulo: Bandeja de Casilla Electrónica Ciudadana y Acuse Legal (ENT-M01-03)
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * Normativa: TUO de la Ley N° 27444 (LPAG) y Ley N° 29733 (Protección de Datos Personales)
 */

export type EstadoNotificacion = "NO_LEIDO" | "LEIDO" | "NOTIFICADO";

export type TipoNotificacion =
  | "RESOLUCION"
  | "OFICIO"
  | "NOTIFICACION_OBSERVACION"
  | "CITACION"
  | "CONSTANCIA"
  | "INFORME"
  | "OTRO";

export type PrioridadNotificacion = "NORMAL" | "ALTA" | "URGENTE";

export interface FirmanteDocumento {
  nombre: string;
  cargo: string;
  fechaFirma: string;
  entidadCertificadora?: string;
  selloTiempo?: string;
}

export interface ActoAdministrativo {
  tipoActo: string; // ej. "Resolución Directoral", "Oficio Múltiple"
  numeroDocumento: string | null;
  anio: number;
  asunto: string;
  resumenLegal: string | null;
  textoCompleto?: string;
  nombreArchivoPdf: string | null;
  tamanoArchivo: string | null;
  urlDescargaPdf?: string;
  hashIntegridadSha256: string | null;
  cvd: string | null;
  firmantes: FirmanteDocumento[];
}

export interface DestinatarioCasilla {
  idPersona?: number;
  nombresCompletos: string | null;
  numeroDocumento: string | null;
  tipoDocumento: "DNI" | "RUC" | "CE" | null;
  direccionCasilla: string | null;
  telefonoContacto?: string;
  correoPersonal?: string;
}

export interface AcuseNotificacion {
  idAcuse: string; // ej. "ACU-2026-000412"
  idNotificacion: string;
  numeroExpediente: string | null;
  destinatario: DestinatarioCasilla;
  documentoUrl?: string | null;
  timestampGeneracionIso: string | null;
  hashSha256Acuse: string | null;
  cvdAcuse: string | null;
  entidadEmisora: string | null;
  unidadEmisora: string | null;
  fechaEfectoLegal: string | null;
  fechaInicioImpugnacion?: string | null;
  plazoImpugnacionDiasHabiles: number | null;
  fechaLimiteImpugnacion?: string;
  ipRegistro?: string;
  validezLegalMensaje: string | null;
}

export interface Notificacion {
  id: string;
  numeroNotificacion: string;
  numeroExpediente: string | null;
  asunto: string;
  tipo: TipoNotificacion;
  estado: EstadoNotificacion;
  prioridad: PrioridadNotificacion | null;
  unidadEmisora: string | null;
  responsableEmision?: string;
  fechaDepositoIso: string; // Timestamp ISO-8601 de depósito en buzón
  fechaLecturaIso?: string | null; // Primer acceso
  fechaNotificadoIso?: string | null; // Perfeccionamiento con acuse
  fechaEfectoLegal?: string | null; // Fecha de eficacia legal (Art. 25 LPAG y Art. 5.2 Ley N° 31736)
  fechaInicioImpugnacion?: string | null; // Día 1 de cómputo de plazos (Art. 5.3 Ley N° 31736)
  plazoImpugnacionDiasHabiles?: number | null; // 15 días hábiles perentorios (Art. 207.2 D.S. N° 006-2026-JUS)
  fechaLimiteImpugnacion?: string | null; // Fecha límite de interposición de recursos
  validezLegalMensaje?: string | null; // Fundamentación legal del cómputo
  plazoConfirmacionDiasHabiles?: number; // 5 días hábiles para confirmar recepción (Art. 5.6 Ley N° 31736)
  fechaLimiteConfirmacion?: string | null; // Vencimiento del plazo de confirmación
  requiereAcuse: boolean;
  documentoUrl?: string | null;
  actoAdministrativo: ActoAdministrativo;
  acuse?: AcuseNotificacion | null;
}

export interface FiltrosCasilla {
  tipo?: TipoNotificacion | "TODOS";
  estado?: EstadoNotificacion | "TODOS";
  fechaInicio?: string; // YYYY-MM-DD
  fechaFin?: string; // YYYY-MM-DD
  busqueda?: string;
  page: number;
  limit: number;
}

export interface PaginationMeta {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface NotificacionesResponse {
  data: Notificacion[];
  meta: PaginationMeta;
}

export interface GenerarAcuseRequest {
  notificacionId: string;
  confirmacionAdministrado: boolean;
  metadataCliente?: {
    navegador?: string;
    zonaHoraria?: string;
  };
}

export interface GenerarAcuseResponse {
  success: boolean;
  message: string;
  data: AcuseNotificacion;
  notificacionActualizada: Notificacion;
}

export interface EstadisticasCasilla {
  total: number;
  noLeidos: number;
  leidos: number;
  notificados: number;
  urgentes: number;
}
