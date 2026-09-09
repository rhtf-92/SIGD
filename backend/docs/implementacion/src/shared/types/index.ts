import type { InvalidParam } from '../domain/errors/index.js';

/**
 * Contratos PROVISIONALES — pendientes de aprobación bilateral con RutaDoc.
 * Los nombres de campos pueden cambiar cuando se firme el contrato definitivo.
 */

export interface CorrelationContext {
  correlation_id: string;
  usuario_id: string | null;
  ip_origen: string;
  user_agent: string;
}

export interface ApiErrorResponse {
  type: string;
  title: string;
  status: number;
  detail: string;
  instance: string;
  code: string;
  correlation_id: string;
  invalid_params: InvalidParam[];
}

export interface PaginacionRequest {
  pagina: number;
  por_pagina: number;
}

export interface PaginacionResponse<T> {
  pagina: number;
  por_pagina: number;
  total: number;
  datos: T[];
}

export interface EventoOutboxContract {
  id_evento: string;
  correlation_id: string;
  agregado: string;
  tipo_evento: string;
  payload: EventoEnvelope;
  estado: 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'FALLIDO';
  intentos: number;
  creado_en: string;
  procesado_en: string | null;
}

export interface EventoEnvelope {
  schema_version: number;
  tipo_evento: string;
  id_evento: string;
  expediente_id: string;
  id_movimiento?: string;
  ocurrido_en: string;
  correlation_id: string;
  clave_idempotencia: string;
  datos: Record<string, unknown>;
}

export interface ExpedienteContract {
  expediente_id: string;
  numero: string;
  tipo_documental_id: string;
  solicitante_id: string;
  area_destino_id: string;
  fecha_radicacion: string;
}

export type TipoEventoRutaDoc =
  | 'ExpedienteDerivado'
  | 'ExpedienteAtendido'
  | 'ExpedienteObservado'
  | 'ExpedienteFinalizado';

export interface EventoRutaDoc<Datos extends Record<string, unknown>> {
  tipo_evento: TipoEventoRutaDoc;
  envelope: EventoEnvelope;
  datos: Datos;
}

export interface DatosExpedienteDerivado {
  area_origen_id: string;
  area_destino_id: string;
  motivo: string;
}

export interface DatosExpedienteAtendido {
  area_atencion_id: string;
  usuario_atencion_id: string;
  resultado: 'ATENDIDO';
}

export interface DatosExpedienteObservado {
  area_atencion_id: string;
  usuario_atencion_id: string;
  resultado: 'OBSERVADO';
  detalle_observacion: string;
  plazo_subsanacion_dias?: number;
}

export type EstadoOutbox = 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'FALLIDO';

export type OperacionBitacora = 'INSERT' | 'UPDATE' | 'DELETE';
