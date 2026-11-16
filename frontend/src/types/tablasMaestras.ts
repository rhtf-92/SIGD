// Modelos de tablas maestras y organigrama Materialized Path (ENT-M05-05)
// Alineado al documento SIGD-DOC-ADMIN-SEGURIDAD-AUDITORIA-02

export type TipoTabla = "Sedes" | "Áreas" | "Tipos documentales" | "Catálogo TUPA (Versiones y Requisitos)";
export type EstadoRegistro = "Activo" | "Inactivo";

export interface RegistroMaestro {
  id: number;
  tipo: TipoTabla;
  codigo: string;
  nombre: string;
  detalle: string;
  estado: EstadoRegistro;
}

export interface AreaOrganica {
  id: string;
  codigo: string;
  nombre: string;
  ruta: string;
  detalle: string;
  estado: EstadoRegistro;
  esReal?: boolean;
}

export interface VersionTupaAdmin {
  versionId: string;
  codigoVersion: string;
  denominacion: string;
  resolucionAprobacion: string | null;
  fechaAprobacion: string | null;
  estado: 'BORRADOR' | 'VIGENTE' | 'HISTORICO' | 'INACTIVO';
  vigente: boolean;
  totalTramites: number;
  observaciones: string | null;
}

export interface TramiteTupaAdmin {
  codigoInterno: string;
  codigoVisible: string;
  numeroVisible: string;
  nombre: string;
  rubro: string;
  costo: string;
  estadoValidacion: 'VALIDADO' | 'PENDIENTE_VALIDACION_DOCUMENTAL';
  sinAnexosEspecificos: boolean;
  observacionInstitucional: string;
  unidadRecepcion: string;
  unidadResponsable: string;
  autoridadResolutiva: string;
  plazoDias: number | null;
  silencioAdministrativo: string | null;
  versionTupa: string;
  totalRequisitos: number;
  totalAnexos: number;
  requisitos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    obligatorio: boolean;
    clasificacion: string;
    formatosAdmitidos: readonly string[];
    fuente: string;
    estadoValidacion: string;
  }>;
  anexos: Array<{
    id: string;
    codigo: string;
    nombre: string;
    descripcion: string;
    obligatorio: boolean;
    clasificacion: string;
    formatosAdmitidos: readonly string[];
    fuente: string;
    estadoValidacion: string;
  }>;
}

export interface AuditoriaTupaAdmin {
  totalExpedientesDoc: number;
  expedientesTupaVigente2026: number;
  expedientesAuditoriaHistoricaPre2026: number;
  expedientesHuerfanosDoc: number;
  totalExpedientesTra: number;
  expedientesDirectosInternosTra: number;
  reasignacionesSinEvidencia: number;
  costosAlterados: number;
  cumplimientoRestriccionOrigenUnico: boolean;
  estadoIntegridad: 'AUDITORIA_INTEGRA' | 'CON_OBSERVACIONES';
  detalle: string;
}
