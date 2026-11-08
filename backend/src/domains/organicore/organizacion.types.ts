/**
 * Contratos de Dominio y Tipos para Estructura Orgánica y Responsabilidades Temporales (Fase 5C)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

export type TipoUnidadOrganica =
  | 'DIRECCION'
  | 'UNIDAD'
  | 'AREA'
  | 'OFICINA'
  | 'SECRETARIA'
  | 'SERVICIO'
  | 'OTRO';

export type EstadoRegistroOrg = 'ACTIVO' | 'FINALIZADO' | 'REVOCADO' | 'ANULADO';

export type TipoResponsabilidadTemporal =
  | 'ENCARGATURA'
  | 'SUPLENCIA'
  | 'DELEGACION'
  | 'DESIGNACION_ESPECIFICA';

export interface UnidadOrganicaModel {
  areaId: string;
  codigo: string;
  nombre: string;
  tipoUnidad: TipoUnidadOrganica;
  areaPadreId: string | null;
  path: string;
  nivel: number;
  vigente: boolean;
  creadoEn: string;
}

export interface UnidadOrganicaArbol extends UnidadOrganicaModel {
  hijos: UnidadOrganicaArbol[];
}

export interface CargoInstitucionalModel {
  cargoId: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  vigente: boolean;
}

export interface AsignacionPersonalModel {
  idAsignacion: string;
  idUsuario: string;
  usuarioNombre?: string;
  usuarioUsername?: string;
  cargoId: string;
  cargoCodigo?: string;
  cargoNombre?: string;
  areaId: string;
  areaCodigo?: string;
  areaNombre?: string;
  estado: EstadoRegistroOrg;
  vigenteDesde: string;
  vigenteHasta: string | null;
  tipoDocumentoSustento: string | null;
  numeroDocumentoSustento: string | null;
  fechaDocumentoSustento: string | null;
  motivoFinalizacion: string | null;
  motivoAnulacion: string | null;
  anuladoEn: string | null;
  anuladoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface AlcanceDelegacion {
  tipoActuacion: string;
  materias?: string[];
  expedientesAutorizados?: string[];
  restricciones?: string;
  [key: string]: unknown;
}

export interface ResponsabilidadTemporalModel {
  idResponsabilidad: string;
  tipoResponsabilidad: TipoResponsabilidadTemporal;
  idUsuario: string;
  usuarioNombre?: string;
  usuarioUsername?: string;
  titularUsuarioId: string | null;
  titularNombre?: string;
  titularUsername?: string;
  cargoId: string;
  cargoCodigo?: string;
  cargoNombre?: string;
  areaId: string;
  areaCodigo?: string;
  areaNombre?: string;
  estado: EstadoRegistroOrg;
  vigenteDesde: string;
  vigenteHasta: string | null;
  tipoDocumentoSustento: string | null;
  numeroDocumentoSustento: string | null;
  fechaDocumentoSustento: string | null;
  alcance: AlcanceDelegacion | null;
  motivoFinalizacion: string | null;
  motivoRevocacion: string | null;
  motivoAnulacion: string | null;
  anuladoEn: string | null;
  anuladoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

// =============================================================================
// DTOs de Entrada
// =============================================================================

export interface CrearUnidadInput {
  codigo: string;
  nombre: string;
  tipoUnidad?: TipoUnidadOrganica;
  areaPadreId?: string | null;
}

export interface CrearCargoInput {
  codigo: string;
  nombre: string;
  descripcion?: string | null;
}

export interface CrearAsignacionInput {
  idUsuario: string;
  cargoId: string;
  areaId: string;
  vigenteDesde?: string | Date;
  vigenteHasta?: string | Date | null;
  tipoDocumentoSustento?: string | null;
  numeroDocumentoSustento?: string | null;
  fechaDocumentoSustento?: string | null;
}

export interface FinalizarAsignacionInput {
  idAsignacion: string;
  fechaFinalizacion?: string | Date;
  motivoFinalizacion?: string | null;
}

export interface CrearResponsabilidadTemporalInput {
  tipoResponsabilidad: TipoResponsabilidadTemporal;
  idUsuario: string;
  titularUsuarioId?: string | null;
  cargoId: string;
  areaId: string;
  vigenteDesde?: string | Date;
  vigenteHasta?: string | Date | null;
  tipoDocumentoSustento?: string | null;
  numeroDocumentoSustento?: string | null;
  fechaDocumentoSustento?: string | null;
  alcance?: AlcanceDelegacion | null;
}

export interface FinalizarResponsabilidadInput {
  idResponsabilidad: string;
  fechaFinalizacion?: string | Date;
  motivoFinalizacion?: string | null;
}

export interface RevocarResponsabilidadInput {
  idResponsabilidad: string;
  motivoRevocacion: string;
  fechaRevocacion?: string | Date;
}

export interface AnularResponsabilidadInput {
  idResponsabilidad: string;
  motivoAnulacion: string;
  usuarioEjecutorId: string;
}

export interface FiltroConsultaOrg {
  areaId?: string;
  idUsuario?: string;
  cargoId?: string;
  tipoResponsabilidad?: TipoResponsabilidadTemporal;
  soloActivos?: boolean;
  fechaCorte?: string;
}
