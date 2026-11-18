import type { EstadoRutaDoc } from './rutadoc.fsm.js';

/** Mapeo operativo acordado para RD-03; las seis pestañas son exhaustivas. */
export const ESTADOS_POR_PESTANA = Object.freeze({
  PENDIENTES: ['REGISTRADO', 'RECEPCIONADO', 'EN_CALIFICACION'],
  EN_TRAMITE: ['EN_REVISION', 'OBSERVADO', 'SUBSANADO'],
  DERIVADOS: ['DERIVADO'],
  POR_FIRMAR: ['EN_FIRMA'],
  ATENDIDOS: ['RESUELTO'],
  ARCHIVADOS: ['ARCHIVADO'],
} as const satisfies Record<string, readonly EstadoRutaDoc[]>);

export type PestanaRutaDoc = keyof typeof ESTADOS_POR_PESTANA;
export type ContadoresRutaDoc = Record<PestanaRutaDoc, number>;

export interface FiltrosRutaDoc {
  pestana: PestanaRutaDoc;
  limite: number;
  terminoBusqueda?: string;
  areaId?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  cursor?: string;
}

export interface PosicionCursor {
  fechaRadicacion: string;
  idExpediente: string;
}

export interface ExpedienteResumen {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  /** Real reception from the first valid receipt or the canonical document record. */
  fechaIngreso?: string | null;
  estadoActual: EstadoRutaDoc;
  /** Procede de datos.areaId del último movimiento, si el escritor lo aporta. */
  areaActualId: string | null;
}

export interface UltimoMovimiento {
  idMovimiento: string;
  evento: string;
  estadoNuevo: EstadoRutaDoc;
  fechaHora: string;
  usuarioOperadorId: string;
}

export interface ExpedienteDetalle extends ExpedienteResumen {
  /** UUID de sigd_tra.expediente.solicitante_id; el nombre requiere IdentiCore. */
  solicitanteId: string | null;
  resumenDocumentos: { cantidadDocumentos: number; totalFolios: number } | null;
  /** Documentos foliados consultables mediante Storage; nunca incluye claves S3. */
  documentos?: {
    idDocumento: string;
    nombre: string;
    mimeType: string;
    folioInicio: number;
    folioFin: number;
    tieneFirmaDigital?: boolean;
    desglosado?: boolean;
  }[];
  acumulacionInfo?: {
    idAcumulacion: string;
    esAccesorio: boolean;
    esPrincipal: boolean;
    expedientePrincipalId: string;
    expedientePrincipalCodigo: string;
    expedienteAccesorioId: string;
    expedienteAccesorioCodigo: string;
    actoResolutivo: string;
    fechaAcumulacion: string;
  } | null;
  ultimoMovimiento: UltimoMovimiento | null;
  /** El cálculo SLA corresponde a otro entregable. */
  sla: null;
}

export interface ResultadoBandeja {
  elementos: ExpedienteResumen[];
  siguienteCursor: string | null;
  tieneMas: boolean;
  contadores: ContadoresRutaDoc;
}

export interface AlcanceBandejaRutaDoc {
  solicitanteId: string | null;
  accesoGlobal: boolean;
  esOperadorArea?: boolean;
}

export interface ActorRutaDoc {
  id: string;
  roles: readonly string[];
  /** Facultades del RBAC persistido, cuando el proveedor institucional las publica. */
  permisos?: readonly import('../../core/auth/auth.guard.js').PermisoInstitucional[];
  /** Unidad derivada por el proveedor de identidad verificado, si está disponible. */
  unidadOrganicaId?: string | null;
  /** La visibilidad fina queda a cargo del proveedor de autenticación. */
  puedeVerExpediente?: (idExpediente: string) => boolean | Promise<boolean>;
  obtenerAlcanceBandeja?: () => Promise<AlcanceBandejaRutaDoc | null>;
}
