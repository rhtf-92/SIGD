import type { ActorRutaDoc } from './rutadoc.types.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';
import type { PoolClient } from 'pg';

/** El ID público del movimiento es su secuencia BIGINT dentro del expediente. */
export interface ComandoReversion {
  movimientoObjetivoId: string;
  motivo: string;
  claveIdempotencia: string;
}

export interface MovimientoObjetivo {
  idMovimiento: string;
  expedienteId: string;
  secuencia: string;
  fechaHora: Date;
  estadoAnterior: EstadoRutaDoc;
  estadoNuevo: EstadoRutaDoc;
  evento: string;
  areaAnteriorId: string | null;
}

export interface CompensacionFolios {
  estado: 'PENDIENTE' | 'PROCESANDO' | 'COMPLETADO' | 'FALLIDO';
  movimientoRelacionadoId: string;
  rangoAfectado: { inicio: number; fin: number } | null;
  referencia: string | null;
}

export type PoliticaReversionRutaDoc = (
  actor: ActorRutaDoc, expedienteId: string,
) => boolean | Promise<boolean>;

/** Puerto local y puro; la integración posterior con DocuCore no abre otra conexión aquí. */
export type PrepararCompensacionFolios = (objetivo: MovimientoObjetivo) => CompensacionFolios;

export interface SolicitudCompensacionFolios {
  expedienteId: string;
  movimientoOriginal: MovimientoObjetivo;
  movimientoCompensatorioId: string;
  rangoAfectado: CompensacionFolios['rangoAfectado'];
  motivo: string;
  actor: ActorRutaDoc;
  correlationId: string;
  claveIdempotencia: string;
  referencia: string;
}

/** El mismo cliente PostgreSQL mantiene asiento, solicitud y outbox atómicos. */
export interface FolioCompensationPort {
  solicitar(cliente: PoolClient, solicitud: SolicitudCompensacionFolios): Promise<void>;
}

export interface ResultadoReversion {
  expedienteId: string;
  movimientoRevertidoId: string;
  movimientoCompensatorioId: string;
  movimientoCompensatorioUuid: string;
  estadoAntesDeReversion: EstadoRutaDoc;
  estadoRestaurado: EstadoRutaDoc;
  motivo: string;
  fechaHora: string;
  compensacionFolios: CompensacionFolios;
  correlationId: string;
}
