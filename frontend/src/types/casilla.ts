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
  numeroDocumento: string; // ej. "RD N.° 0412-2026-DG-IESTP-SUIZA"
  anio: number;
  asunto: string;
  resumenLegal: string;
  textoCompleto?: string;
  nombreArchivoPdf: string;
  tamanoArchivo: string;
  urlDescargaPdf?: string;
  hashIntegridadSha256: string; // SHA-256 del acto administrativo
  cvd: string; // Código de Verificación Digital (CVD-YYYY-TIP-XXXXXX-HASH)
  firmantes: FirmanteDocumento[];
}

export interface DestinatarioCasilla {
  idPersona?: number;
  nombresCompletos: string;
  numeroDocumento: string; // DNI o RUC
  tipoDocumento: "DNI" | "RUC" | "CE";
  direccionCasilla: string; // ej. "74561238@casilla.iestpsuiza.edu.pe"
  telefonoContacto?: string;
  correoPersonal?: string;
}

export interface AcuseNotificacion {
  idAcuse: string; // ej. "ACU-2026-000412"
  idNotificacion: string;
  numeroExpediente: string;
  destinatario: DestinatarioCasilla;
  timestampGeneracionIso: string; // Timestamp ISO-8601 devuelto por backend
  hashSha256Acuse: string; // Hash SHA-256 devuelto por backend
  cvdAcuse: string; // CVD del Acuse oficial
  entidadEmisora: string; // "IESTP Suiza"
  unidadEmisora: string; // ej. "Secretaría Académica"
  fechaEfectoLegal: string; // Fecha en que surte efecto jurídico (Art. 20 Ley 27444)
  plazoImpugnacionDiasHabiles: number; // ej. 15 días hábiles
  fechaLimiteImpugnacion?: string;
  ipRegistro?: string;
  validezLegalMensaje: string;
}

export interface Notificacion {
  id: string;
  numeroNotificacion: string; // ej. "NOT-2026-000184"
  numeroExpediente: string; // ej. "EXP-2026-000104"
  asunto: string;
  tipo: TipoNotificacion;
  estado: EstadoNotificacion;
  prioridad: PrioridadNotificacion;
  unidadEmisora: string; // ej. "Secretaría Académica", "Dirección General"
  responsableEmision?: string;
  fechaDepositoIso: string; // Timestamp ISO-8601 de depósito en buzón
  fechaLecturaIso?: string | null; // Primer acceso
  fechaNotificadoIso?: string | null; // Perfeccionamiento con acuse
  requiereAcuse: boolean;
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
