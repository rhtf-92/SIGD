/**
-- =============================================================================
-- Tipos de Dominio: Workflow Configurable y Versionado (Fase 5G)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- =============================================================================
*/

export type TipoProvenienciaWorkflow =
  | 'OFICIAL_SUIZA'
  | 'DISEÑO_SIGD'
  | 'NORMATIVA_MINEDU'
  | 'NO_DETERMINADO';

export type EstadoHomologacionWorkflow =
  | 'PENDIENTE_HOMOLOGACION'
  | 'HOMOLOGADO'
  | 'HISTORICO'
  | 'ANULADO';

export type EstadoInstanciaWorkflow =
  | 'EN_CURSO'
  | 'COMPLETADO'
  | 'CANCELADO';

export interface PasoWorkflow {
  orden: number;
  nombre: string;
  areaId?: string | null;
  areaCodigo?: string | null;
  perfilRequerido?: string | null;
  accionRequerida: string;
  permiteObservacion?: boolean;
  esResolutivo?: boolean;
  esFinal?: boolean;
}

export interface DtoWorkflowDefinicion {
  idWorkflow: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  proveniencia: TipoProvenienciaWorkflow;
  fuenteOriginal: string;
  estadoHomologacion: EstadoHomologacionWorkflow;
  creadoEn: string;
}

export interface DtoWorkflowVersion {
  idVersion: string;
  idWorkflow: string;
  version: string;
  codigoCompleto: string;
  descripcion: string | null;
  activo: boolean;
  proveniencia: TipoProvenienciaWorkflow;
  fuenteOriginal: string;
  estadoHomologacion: EstadoHomologacionWorkflow;
  pasos: PasoWorkflow[];
  creadoEn: string;
}

export interface RegistroHistorialPaso {
  paso: number;
  completadoEn: string;
  usuarioId: string;
  areaId: string;
  evento: string;
  detalle?: string;
}

export interface DtoWorkflowInstancia {
  idInstancia: string;
  expedienteId: string;
  idVersionWorkflow: string;
  codigoVersion?: string;
  pasoActual: number;
  totalPasos: number;
  estadoInstancia: EstadoInstanciaWorkflow;
  historialPasos: RegistroHistorialPaso[];
  iniciadoEn: string;
  finalizadoEn: string | null;
}

export interface CrearWorkflowDefinicionInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  proveniencia?: TipoProvenienciaWorkflow;
  fuenteOriginal?: string;
  estadoHomologacion?: EstadoHomologacionWorkflow;
}

export interface CrearWorkflowVersionInput {
  idWorkflow: string;
  version: string;
  codigoCompleto: string;
  descripcion?: string | null;
  activo?: boolean;
  proveniencia?: TipoProvenienciaWorkflow;
  fuenteOriginal?: string;
  estadoHomologacion?: EstadoHomologacionWorkflow;
  pasos: PasoWorkflow[];
}
