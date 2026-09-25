import type { ActorRutaDoc } from './rutadoc.types.js';
import type { EstadoRutaDoc } from './rutadoc.fsm.js';

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
}

export interface CompensacionFolios {
  estado: 'PENDIENTE' | 'REGISTRADA';
  movimientoRelacionadoId: string;
  rangoAfectado: { inicio: number; fin: number } | null;
  referencia: string | null;
}

export type PoliticaReversionRutaDoc = (
  actor: ActorRutaDoc, expedienteId: string,
) => boolean | Promise<boolean>;

/** Puerto local y puro; la integración posterior con DocuCore no abre otra conexión aquí. */
export type PrepararCompensacionFolios = (objetivo: MovimientoObjetivo) => CompensacionFolios;

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
