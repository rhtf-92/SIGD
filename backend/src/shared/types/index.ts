import type { InvalidParam } from '../domain/errors/index.js';

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
  estado: 'PENDIENTE' | 'PROCESADO' | 'FALLIDO';
  intentos: number;
  creado_en: string;
  procesado_en: string | null;
}

export interface EventoEnvelope {
  schema_version: number;
  tipo_evento: string;
  id_evento: string;
  id_expediente: string;
  id_movimiento?: string;
  ocurrido_en: string;
  correlation_id: string;
  clave_idempotencia: string;
  datos: Record<string, unknown>;
}

export interface ExpedienteContract {
  id_expediente: string;
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
  id_area_origen: string;
  id_area_destino: string;
  motivo: string;
}

export interface DatosExpedienteAtendido {
  id_area_atencion: string;
  id_usuario_atencion: string;
  resultado: 'ATENDIDO';
}

export interface DatosExpedienteObservado {
  id_area_atencion: string;
  id_usuario_atencion: string;
  resultado: 'OBSERVADO';
  detalle_observacion: string;
  plazo_subsanacion_dias?: number;
}

export type EstadoOutbox = 'PENDIENTE' | 'PROCESADO' | 'FALLIDO';

export type OperacionBitacora = 'INSERT' | 'UPDATE' | 'DELETE';