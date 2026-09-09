import type { InvalidParam } from '../domain/errors/index.js';

/**
 * Contratos PROVISIONALES — pendientes de aprobación bilateral con RutaDoc.
 * Los nombres de campos pueden cambiar cuando se firme el contrato definitivo.
 *
 * Convención de nomenclatura (D-15, CONFIRMADO — entregable 05):
 *   - Entidades de negocio: id_<agregado>
 *     (id_expediente, id_movimiento, id_area_*, id_usuario_*, id_cuenta)
 *   - Auditoría / Outbox:   id_evento, id_auditoria
 *   - Tabla docucore:       id_tipo_documento, id_formulario (basado en DDL original)
 *   - Contexto/correlación: usuario_id (CorrelationContext y bitácora, entregable 04 §7.1)
 *
 * Los contratos externos aún NO están aprobados. Esta convención se mantendrá
 * hasta que se firme el contrato bilateral con RutaDoc/IdentiCore/OrganiCore.
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
  proxima_reintento_en: string | null;
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
  id_tipo_documental: string;
  id_solicitante: string;
  id_area_destino: string;
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

export type EstadoOutbox = 'PENDIENTE' | 'EN_PROCESO' | 'PROCESADO' | 'FALLIDO';

export type OperacionBitacora = 'INSERT' | 'UPDATE' | 'DELETE';
