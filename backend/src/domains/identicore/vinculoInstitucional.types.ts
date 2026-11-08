/**
 * Tipos y contratos de dominio para Vínculos Institucionales (Fase 5B)
 * Sistema Integral de Gestión Documentaria (SIGD) — IESTP "Suiza"
 */

export type CategoriaActor = 'COMUNIDAD_ACADEMICA' | 'PERSONAL_INSTITUCIONAL' | 'EXTERNO';

export type EstadoVinculo = 'ACTIVO' | 'FINALIZADO' | 'ANULADO';

export type CodigoTipoVinculo =
  | 'POSTULANTE'
  | 'ESTUDIANTE_ACTIVO'
  | 'EGRESADO'
  | 'TITULADO'
  | 'DOCENTE'
  | 'ADMINISTRATIVO'
  | 'DIRECTIVO'
  | (string & {});

export interface TipoVinculoInstitucional {
  idTipoVinculo: number;
  codigo: string;
  nombre: string;
  categoriaActor: CategoriaActor;
  descripcion: string | null;
  vigente: boolean;
  creadoEn: string;
}

export interface VinculoInstitucional {
  idVinculo: string;
  idPersona: string;
  idTipoVinculo: number;
  codigoTipo: string;
  nombreTipo: string;
  categoriaActor: CategoriaActor;
  estado: EstadoVinculo;
  vigenteDesde: string;
  vigenteHasta: string | null;
  motivoFinalizacion: string | null;
  motivoAnulacion: string | null;
  anuladoEn: string | null;
  anuladoPor: string | null;
  creadoEn: string;
  actualizadoEn: string;
}

export interface CrearVinculoInput {
  personaId: string;
  tipoVinculo: string | number;
  vigenteDesde?: string | Date;
  vigenteHasta?: string | Date | null;
}

export interface FinalizarVinculoInput {
  vinculoId: string;
  motivoFinalizacion?: string;
  fechaFinalizacion?: string | Date;
}

export interface AnularVinculoInput {
  vinculoId: string;
  motivoAnulacion: string;
  anuladoPor?: string;
}

export interface FiltroVinculosInput {
  soloVigentes?: boolean;
  fechaCorte?: string | Date;
}
