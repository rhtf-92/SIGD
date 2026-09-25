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
  /** TramiCore sólo publica fk_remitente; el nombre requiere IdentiCore. */
  solicitanteId: string | null;
  resumenDocumentos: { cantidadDocumentos: number; totalFolios: number } | null;
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

export interface ActorRutaDoc {
  id: string;
  roles: readonly string[];
  /** La visibilidad fina queda a cargo del proveedor de autenticación. */
  puedeVerExpediente?: (idExpediente: string) => boolean | Promise<boolean>;
}
