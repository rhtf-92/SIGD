/**
-- =============================================================================
-- Contratos de Tipos de Autorización Contextual (Fase 5D)
-- Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
-- -----------------------------------------------------------------------------
-- Autor     : Geric (B_GERIC)
-- Marco     : Modelo Canónico de Autorización Contextual, Scopes y Segregación SIGD 2026
-- =============================================================================
*/

import { z } from 'zod';

export type ScopeOperativo =
  | 'PROPIO'
  | 'EXPEDIENTE_ASIGNADO'
  | 'AREA'
  | 'SUBARBOL'
  | 'INSTITUCIONAL'
  | 'GLOBAL_TECNICO';

export type EstadoAsignacionPerfil = 'ACTIVO' | 'FINALIZADO' | 'REVOCADO' | 'ANULADO';

export type ContextoOperacion = 'PERSONAL' | 'INSTITUCIONAL';

export type AccionPermiso =
  | 'ORGANIZACION_GESTIONAR'
  | 'CUENTA_GESTIONAR'
  | 'EXPEDIENTE_VER'
  | 'EXPEDIENTE_RECIBIR'
  | 'EXPEDIENTE_DERIVAR'
  | 'EXPEDIENTE_OBSERVAR'
  | 'EXPEDIENTE_ATENDER'
  | 'EXPEDIENTE_ARCHIVAR'
  | 'DEVOLUCION_REVISAR'
  | 'DEVOLUCION_AUTORIZAR'
  | 'DEVOLUCION_EJECUTAR'
  | 'PAGO_VER'
  | 'PAGO_REGISTRAR'
  | 'TUPA_GESTIONAR'
  | 'TUPA_ACTIVAR'
  | 'TUPA_PUBLICAR'
  | 'ROLES_GESTIONAR'
  | 'PERMISOS_GESTIONAR'
  | 'PERFILES_GESTIONAR'
  | 'CONFIGURACION_GLOBAL_GESTIONAR'
  | 'AUDITORIA_GLOBAL_VER'
  | 'FIRMA_FIRMAR'
  | 'ADMIN_USUARIOS'
  | 'REPORTE_LEER'
  | string;

export interface PerfilOperativoCatalogo {
  perfilId: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  vigente: boolean;
  creadoEn: string;
}

export interface AsignacionPerfilOperativo {
  idAsignacionPerfil: string;
  idUsuario: string;
  perfilId: number;
  perfilCodigo: string;
  perfilNombre: string;
  areaId: string | null;
  areaCodigo?: string | null;
  areaNombre?: string | null;
  scope: ScopeOperativo;
  idResponsabilidad: string | null;
  estado: EstadoAsignacionPerfil;
  vigenteDesde: string;
  vigenteHasta: string | null;
  tipoDocumentoSustento?: string | null;
  numeroDocumentoSustento?: string | null;
  fechaDocumentoSustento?: string | null;
  alcance?: Record<string, unknown> | null;
  motivoFinalizacion?: string | null;
  motivoRevocacion?: string | null;
  motivoAnulacion?: string | null;
  anuladoEn?: string | null;
  anuladoPor?: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface ContextoAutorizacion {
  cuenta: {
    idUsuario: string;
    usuario: string;
    correo?: string;
    activo: boolean;
  };
  persona: {
    idPersona: string;
    nombres: string;
    primerApellido: string;
    segundoApellido: string | null;
    tipoDocumento?: number | null;
    numeroDocumento?: string | null;
  } | null;
  vinculos: Array<{
    idVinculo: string;
    codigoTipo: string;
    nombreTipo: string;
    categoria: string;
    estado: string;
    vigenteDesde: string;
    vigenteHasta: string | null;
  }>;
  asignaciones: Array<{
    idAsignacion: string;
    cargoId: string;
    cargoCodigo: string;
    cargoNombre: string;
    areaId: string;
    areaCodigo: string;
    areaNombre: string;
    areaJerarquia?: string | null;
    estado: string;
    vigenteDesde: string;
    vigenteHasta: string | null;
  }>;
  responsabilidadesTemporales: Array<{
    idResponsabilidad: string;
    tipo: 'ENCARGATURA' | 'SUPLENCIA' | 'DELEGACION' | 'DESIGNACION_ESPECIFICA';
    titularUsuarioId?: string | null;
    cargoId: string;
    areaId: string;
    estado: string;
    vigenteDesde: string;
    vigenteHasta: string | null;
    alcance?: Record<string, unknown> | null;
  }>;
  perfilesOperativos: Array<{
    idAsignacionPerfil: string;
    perfilId: number;
    perfilCodigo: string;
    perfilNombre: string;
    areaId: string | null;
    scope: ScopeOperativo;
    idResponsabilidad: string | null;
    estado: string;
    vigenteDesde: string;
    vigenteHasta: string | null;
    permisos: string[];
    alcance?: Record<string, unknown> | null;
  }>;
  rolesCanonicos: string[];
}

export interface RecursoAutorizacion {
  tipo:
    | 'EXPEDIENTE'
    | 'DOCUMENTO'
    | 'PAGO'
    | 'DEVOLUCION'
    | 'ORGANIZACION'
    | 'CUENTA'
    | 'CONFIGURACION'
    | string;
  id?: string;
  areaId?: string;
  propietarioPersonaId?: string;
  propietarioUsuarioId?: string;
  expedienteAsignadoAUsuarioId?: string;
  solicitanteUsuarioId?: string;
  solicitantePersonaId?: string;
  autorizadorUsuarioId?: string;
  metadatos?: Record<string, unknown>;
}

export interface SolicitudAutorizacion {
  usuarioId: string;
  rolesDeclarados?: string[];
  accion: AccionPermiso;
  recurso?: RecursoAutorizacion;
  fechaReferencia?: Date;
  contextoOperacion?: ContextoOperacion;
  reglasSegregacion?: {
    prohibirAutoaprobacion?: boolean;
    prohibirAutorizadorComoEjecutor?: boolean;
  };
}

export interface ResultadoAutorizacion {
  autorizado: boolean;
  codigoDenegacion?: string;
  motivoInterno?: string;
  perfilAplicado?: string;
  scopeAplicado?: ScopeOperativo;
}

// Zod Schemas para Validación de Asignación de Perfiles Operativos
export const crearAsignacionPerfilSchema = z.object({
  idUsuario: z.string().uuid(),
  perfilCodigo: z.string().min(1).max(50),
  areaId: z.string().uuid().nullable().optional(),
  scope: z
    .enum(['PROPIO', 'EXPEDIENTE_ASIGNADO', 'AREA', 'SUBARBOL', 'INSTITUCIONAL', 'GLOBAL_TECNICO'])
    .default('AREA'),
  idResponsabilidad: z.string().uuid().nullable().optional(),
  vigenteDesde: z.string().optional(),
  vigenteHasta: z.string().nullable().optional(),
  tipoDocumentoSustento: z.string().max(50).nullable().optional(),
  numeroDocumentoSustento: z.string().max(100).nullable().optional(),
  fechaDocumentoSustento: z.string().nullable().optional(),
  alcance: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const finalizarAsignacionPerfilSchema = z.object({
  fechaFinalizacion: z.string().optional(),
  motivoFinalizacion: z.string().max(255).optional(),
});

export const revocarAsignacionPerfilSchema = z.object({
  fechaRevocacion: z.string().optional(),
  motivoRevocacion: z.string().min(1, 'El motivo de revocación es obligatorio').max(255),
});

export const anularAsignacionPerfilSchema = z.object({
  motivoAnulacion: z.string().min(1, 'El motivo de anulación es obligatorio').max(255),
});

/**
 * Permisos canónicos de solo consulta documental que NO otorgan capacidad de recepción operativa.
 */
export const PERMISOS_CONSULTA_RUTADOC: readonly AccionPermiso[] = [
  'EXPEDIENTE_VER',
] as const;

/**
 * Permisos canónicos mínimos que facultan operativamente a un funcionario para recibir y/o atender
 * expedientes en una unidad orgánica (capacidad real de receptor operativo en RutaDoc).
 */
export const PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC: readonly AccionPermiso[] = [
  'EXPEDIENTE_RECIBIR',
  'EXPEDIENTE_ATENDER',
] as const;

/**
 * Roles funcionales canónicos que facultan operativamente la gestión de recepción y despacho
 * de expedientes en una unidad orgánica (o a nivel directivo/institucional).
 *
 * NOTA DE SEGURIDAD Y GOBIERNO (Fase C0.1B):
 * Ni SUPERADMINISTRADOR ni ADMINISTRADOR pertenecen a esta lista.
 * Los roles de gobierno técnico o administración no convierten por sí solos un área en enrutable.
 */
export const ROLES_OPERATIVOS_RECEPTOR_RUTADOC = [
  'DIRECTOR',
  'SECRETARIO',
  'ESPECIALISTA',
  'MESA_PARTES',
] as const;
export type RolOperativoReceptorRutaDoc = (typeof ROLES_OPERATIVOS_RECEPTOR_RUTADOC)[number];

// Alias canónicos para compatibilidad hacia atrás
export const PERMISOS_OPERATIVOS_RUTADOC = PERMISOS_OPERATIVOS_RECEPTOR_RUTADOC;
export const ROLES_OPERATIVOS_RUTADOC = ROLES_OPERATIVOS_RECEPTOR_RUTADOC;
export type RolOperativoRutaDoc = RolOperativoReceptorRutaDoc;
