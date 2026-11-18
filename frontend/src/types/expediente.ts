/**
 * Contratos TypeScript del dominio de Gestión de Expedientes (Módulo 05 - RutaDoc).
 * Fuente normativa: frontend/docs/05_gestion-expedientes/03_modelo_datos_typescript_y_trazabilidad_inmutable.md
 *
 * Este archivo es la base compartida por los 5 entregables del Grupo 3 (ENT-M03-01 a ENT-M03-05).
 * No usar `any` en ningún punto (criterio de evaluación D4).
 */

/** Clasificación archivística según el Cuadro de Clasificación Documental (CCD). */
export interface ClasificacionCCD {
  /** Fondo Documental oficial institucional. */
  fondo: "IESTP_SUIZA";
  /** Sección o unidad orgánica responsable (ej. 'SECRETARIA_ACADEMICA'). */
  seccion: string;
  /** Serie documental reglamentaria (ej. 'TITULACION_PROFESIONAL'). */
  serieDocumental: string;
  /** Subdivisión de la serie, cuando ha sido clasificada. */
  subserieDocumental?: string;
  /** Código unificado de la serie archivística (ej. 'CCD-SA-TIT'). */
  codigoSerie: string;
  codigoSubserie?: string;
}

/** Representa una versión inmutable de un documento adjunto o proyectado. */
export interface VersionDocumento {
  /** Identificador único de versión (ej. 'v1.0', 'v1.1'). */
  versionId: string;
  /** Número correlativo incremental. */
  numeroVersion: number;
  /** Estado del documento dentro de su historial de versiones. */
  estado: "VIGENTE" | "HISTORICA";
  /** Nombre del archivo original. */
  nombreArchivo: string;
  /** Clave o URL de almacenamiento seguro en MinIO / S3. */
  urlArchivo: string;
  /** Identificador del autor que emitió o modificó la versión. */
  autorCambioId: string;
  /** Nombre legible del funcionario responsable. */
  autorCambioNombre: string;
  /** Marca temporal en formato ISO 8601. */
  fechaRegistro: string;
  /** Justificación de la creación de la nueva versión. */
  motivoModificacion: string;
  /** Huella criptográfica SHA-256 calculada localmente para auditoría de inmutabilidad. */
  hashIntegridad: string;
}

/** Tipología documental principal reconocida por el SIGD. */
export type TipoDocumentoPrincipal =
  | "OFICIO"
  | "INFORME"
  | "CARTA"
  | "RESOLUCION_DIRECTORAL"
  | "SOLICITUD"
  | "PROVEIDO"
  | "EXPEDIENTE_EXTERNO";

/** Metadatos documentales avanzados para indexación y búsqueda semántica. */
export interface MetadatosAvanzados {
  tipoDocumentoPrincipal: TipoDocumentoPrincipal;
  /** Etiquetas semánticas para búsqueda temática y filtrado rápido. */
  palabrasClave: string[];
  creadorId: string;
  creadorNombre: string;
  responsableAsignadoId?: string;
  responsableAsignadoNombre?: string;
  canalIngreso?: "MESA_DE_PARTES_VIRTUAL" | "VENTANILLA_PRESENCIAL";
}

/** Información del solicitante o administrado (modelo polimórfico). */
export interface SolicitanteExpediente {
  tipoPersona: "NATURAL" | "JURIDICA";
  tipoDocumento: "DNI" | "RUC" | "CE" | "PASAPORTE";
  numeroDocumento: string;
  nombreOrazonSocial: string;
  correoNotificacion: string;
  telefonoContacto: string;
}

/**
 * Estado del flujo de trabajo dentro de la máquina de estados finitos (FSM) institucional.
 * Corresponde a las 6 pestañas de la Bandeja Operativa (ENT-M03-01).
 */
export type EstadoFlujoExpediente =
  | "PENDIENTE"
  | "EN_PROCESO"
  | "OBSERVADO"
  | "DERIVADO"
  | "NOTIFICADO"
  | "ARCHIVADO";

/** Nivel de prioridad procesal del expediente. */
export type PrioridadExpediente = "NORMAL" | "URGENTE" | "MUY_URGENTE";

/** Entidad maestra del Expediente en el SIGD. */
export interface ExpedienteSGD {
  /** UUID primario en base de datos. */
  id: string;
  /** Código Único de Trámite con formato estricto EXP-YYYY-XXXXXX. */
  codigoExpediente: string;
  /** Resumen ejecutivo del petitorio. */
  asunto: string;
  /** Sujeto procesal que presenta la solicitud. */
  solicitante: SolicitanteExpediente;
  /** Taxonomía archivística CCD. */
  clasificacionCCD: ClasificacionCCD;
  /** Metadatos para búsqueda avanzada. */
  metadatos: MetadatosAvanzados;
  /** Área u oficina donde se originó el ingreso. */
  areaOrigen: string;
  /** Unidad orgánica que actualmente custodia y tramita el expediente. */
  areaActual: string;
  estadoFlujo: EstadoFlujoExpediente;
  prioridad: PrioridadExpediente;
  /** Fecha de ingreso formal al sistema (ISO 8601). */
  fechaIngreso: string;
  /** Marca de tiempo de la última actuación registrada. */
  fechaUltimoMovimiento: string;
  /** Fecha límite legal de atención (ISO 8601), usada para el semáforo SLA (ENT-M03-02). */
  fechaLimiteAtencion: string;
  /** Colección histórica de versiones documentales sin sobreescritura. */
  versionesDocumentos: VersionDocumento[];
  /** Total de folios acumulados según protocolo AGN. */
  cantidadFolios: number;
}

/** Detalle de pase o derivación entre unidades orgánicas (usado por ENT-M03-05). */
export interface DetalleDerivacion {
  derivacionId: string;
  expedienteId: string;
  areaOrigenId: string;
  areaDestinoId: string;
  usuarioRemitenteId: string;
  usuarioAsignadoId?: string;
  fechaDerivacion: string;
  plazoAtencionDias: number;
  estadoDerivacion: "PENDIENTE_RECEPCION" | "ACEPTADO" | "RECHAZADO";
  proveidoInstruccion: string;
  observacionDevolucion?: string;
}

/** Etiquetas legibles en español para cada estado, usadas en la UI de la bandeja. */
export const ETIQUETAS_ESTADO_FLUJO: Record<EstadoFlujoExpediente, string> = {
  PENDIENTE: "Pendientes",
  EN_PROCESO: "En Proceso",
  OBSERVADO: "Observados",
  DERIVADO: "Derivados",
  NOTIFICADO: "Notificados",
  ARCHIVADO: "Archivados",
};

/** Orden canónico de las 6 pestañas de la Bandeja Operativa (ENT-M03-01). */
export const ORDEN_PESTANAS_BANDEJA: EstadoFlujoExpediente[] = [
  "PENDIENTE",
  "EN_PROCESO",
  "OBSERVADO",
  "DERIVADO",
  "NOTIFICADO",
  "ARCHIVADO",
];

/** DTO de lectura de RutaDoc. No completa metadatos que la API no entrega. */
export const PESTANAS_RUTADOC = ["PENDIENTES", "EN_TRAMITE", "DERIVADOS", "POR_FIRMAR", "ATENDIDOS", "ARCHIVADOS"] as const;
export type PestanaRutaDoc = typeof PESTANAS_RUTADOC[number];
export const ETIQUETAS_PESTANA_RUTADOC: Record<PestanaRutaDoc, string> = {
  PENDIENTES: "Pendientes", EN_TRAMITE: "En trámite", DERIVADOS: "Derivados",
  POR_FIRMAR: "Por firmar", ATENDIDOS: "Atendidos", ARCHIVADOS: "Archivados",
};
export interface ExpedienteResumenRutaDoc {
  idExpediente: string;
  cut: string;
  asunto: string;
  fechaRadicacion: string;
  /** Recepción real; no confundir con el inicio legal proyectado de los plazos. */
  fechaIngreso?: string | null;
  estadoActual: string;
  areaActualId: string | null;
}
export interface DocumentoAdjuntoRutaDoc {
  idDocumento: string;
  nombre: string;
  mimeType: string;
  folioInicio: number;
  folioFin: number;
  tieneFirmaDigital?: boolean;
  desglosado?: boolean;
}

export interface AcumulacionInfoRutaDoc {
  idAcumulacion: string;
  esAccesorio: boolean;
  esPrincipal: boolean;
  expedientePrincipalId: string;
  expedientePrincipalCodigo: string;
  expedienteAccesorioId: string;
  expedienteAccesorioCodigo: string;
  actoResolutivo: string;
  fechaAcumulacion: string;
}

export interface ItemAcumulacion {
  id_acumulacion: string;
  expediente_principal_id: string;
  principal_codigo: string;
  expediente_accesorio_id: string;
  accesorio_codigo: string;
  acto_resolutivo: string;
  estado: 'ACUMULADO' | 'DESACUMULADO';
  fecha_acumulacion: string;
  fecha_desacumulacion?: string | null;
  motivo_desacumulacion?: string | null;
  acto_desacumulacion?: string | null;
  rol_en_acumulacion: 'PRINCIPAL' | 'ACCESORIO';
}

export interface ItemDesglose {
  id_desglose: string;
  expediente_id: string;
  documento_adjunto_id: string;
  documento_nombre: string;
  folio_inicio: number;
  folio_fin: number;
  cantidad_folios: number;
  acto_autorizacion: string;
  motivo_desglose: string;
  solicitante_nombre: string;
  solicitante_documento: string;
  documento_sustitutorio_id?: string | null;
  sustitutorio_nombre?: string | null;
  fecha_desglose: string;
  observaciones?: string | null;
}

/** Información canónica de resolución directoral asociada al expediente. Consulta de PDF mediante Storage API (documentoAdjuntoId); nunca expone claves físicas S3. */
export interface ResolucionInfoRutaDoc {
  resolucionId: string;
  expedienteId: string;
  numeroBorrador: string;
  numeroResolucion?: string | null;
  tipoResolucion: string;
  asunto: string;
  estado: string;
  fechaProyeccion: string;
  firmadoPor?: string | null;
  firmanteNombre?: string | null;
  firmadoEn?: string | null;
  cvd?: string | null;
  hashPades?: string | null;
  documentoAdjuntoId?: string | null;
}

export interface ExpedienteDetalleRutaDoc extends ExpedienteResumenRutaDoc {
  solicitanteId: string | null;
  resumenDocumentos: { cantidadDocumentos: number; totalFolios: number } | null;
  documentos?: DocumentoAdjuntoRutaDoc[];
  acumulacionInfo?: AcumulacionInfoRutaDoc | null;
  resolucionInfo?: ResolucionInfoRutaDoc | null;
  ultimoMovimiento: { idMovimiento: string; evento: string; estadoNuevo: string;
    fechaHora: string; usuarioOperadorId: string } | null;
  sla: null;
}
export interface ResultadoBandejaRutaDoc {
  elementos: ExpedienteResumenRutaDoc[];
  siguienteCursor: string | null;
  tieneMas: boolean;
  contadores: Record<PestanaRutaDoc, number>;
}

export interface EvaluadorActivoInfo {
  idAsignacion: string;
  idUsuarioDocente: string;
  docenteNombre: string;
  docenteEmail: string;
  areaId: string;
  areaNombre?: string;
  asignadoPor: string;
  asignadorNombre?: string;
  motivoAsignacion: string;
  esReasignacion: boolean;
  justificacionReasignacion?: string | null;
  asignadoEn: string;
  estadoEvaluacion: string;
  observaciones?: string | null;
}

export interface HistorialEvaluadorItem {
  idAsignacion: string;
  idUsuarioDocente: string;
  docenteNombre: string;
  docenteEmail: string;
  areaId: string;
  asignadoPor: string;
  asignadorNombre?: string;
  motivoAsignacion: string;
  esReasignacion: boolean;
  justificacionReasignacion?: string | null;
  asignacionAnteriorId?: string | null;
  activo: boolean;
  asignadoEn: string;
  estadoEvaluacion: string;
  desactivadoPor?: string | null;
  desactivadorNombre?: string | null;
  desactivadoEn?: string | null;
  motivoDesasignacion?: string | null;
  observaciones?: string | null;
}

export interface DocenteElegible {
  idUsuario: string;
  nombreCompleto: string;
  correo: string;
  rol: string;
  areaId?: string | null;
  areaNombre?: string | null;
}

export interface EvaluacionSupervisionItem {
  idAsignacion: string;
  expedienteId: string;
  codigoExpediente: string;
  asunto: string;
  docenteNombre: string;
  docenteEmail: string;
  estadoEvaluacion: string;
  estadoExpediente: string;
  asignadoEn: string;
  diasTranscurridos: number;
  resultadoEvaluacion: string | null;
}

export interface ReasignacionMasivaResultado {
  ok: boolean;
  mensaje: string;
  total: number;
  exitosos: number;
  fallidos: number;
  resultados: Array<{
    expedienteId: string;
    ok: boolean;
    idAsignacion?: string;
    evaluadorAnteriorId?: string;
    error?: string;
  }>;
}
