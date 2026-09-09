/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/types/tramiteWizard.ts
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Definiciones canónicas de tipos, interfaces, enums y contratos de datos
 * para el flujo de tramitación asistida de 4 pasos (Mesa de Partes Virtual y Ventanilla).
 * Cumple con el estándar estricto de TypeScript (PEN-06: Cero uso de 'any').
 * ==============================================================================
 */

// =============================================================================
// 1. PASOS DEL WIZARD (ENUMS & UNION TYPES)
// =============================================================================

/**
 * Identificadores numéricos secuenciales de los 4 pasos del Wizard.
 */
export type WizardStepId = 1 | 2 | 3 | 4;

/**
 * Claves nominales para identificación unívoca y semántica de cada paso.
 */
export type WizardStepKey =
  | "IDENTIFICACION"
  | "SELECCION_TRAMITE"
  | "FORMULARIO_REQUISITOS"
  | "RESUMEN_RADICACION";

/**
 * Enum representativo de los 4 pasos del Wizard de Tramitación conforme a la
 * especificación funcional institucional (Ley N° 27444 - LPAG).
 */
export enum WizardStepEnum {
  /** Paso 1: Datos del administrado/solicitante (Natural o Jurídica) */
  IDENTIFICACION = 1,
  /** Paso 2: Elección de procedimiento TUPA o libre, tipología y dependencia destino */
  SELECCION_TRAMITE = 2,
  /** Paso 3: Formulario dinámico JSON Schema y carga probatoria de PDFs */
  FORMULARIO_REQUISITOS = 3,
  /** Paso 4: Declaración jurada, revisión consolidada y emisión del CUT / Cargo */
  RESUMEN_RADICACION = 4,
}

/**
 * Metadatos descriptivos inmutables asignados a cada paso del proceso.
 */
export interface WizardStepDefinition {
  readonly id: WizardStepId;
  readonly key: WizardStepKey;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
}

/**
 * Catálogo canónico de pasos del Wizard para el IESTP "Suiza".
 */
export const WIZARD_STEPS: readonly WizardStepDefinition[] = [
  {
    id: 1,
    key: "IDENTIFICACION",
    title: "Identificación del Solicitante",
    shortTitle: "Identificación",
    description: "Datos de identidad y contacto oficial del administrado",
  },
  {
    id: 2,
    key: "SELECCION_TRAMITE",
    title: "Selección de Trámite TUPA",
    shortTitle: "Trámite TUPA",
    description: "Elección del procedimiento institucional y área de destino",
  },
  {
    id: 3,
    key: "FORMULARIO_REQUISITOS",
    title: "Formulario y Requisitos",
    shortTitle: "Requisitos",
    description: "Campos dinámicos y carga digital de documentos en PDF/A",
  },
  {
    id: 4,
    key: "RESUMEN_RADICACION",
    title: "Resumen y Radicación",
    shortTitle: "Radicación",
    description: "Declaración jurada y emisión transaccional del CUT oficial",
  },
] as const;

// =============================================================================
// 2. MODELOS DE DATOS: PASO 1 — IDENTIFICACIÓN DEL SOLICITANTE
// =============================================================================

export type TipoPersona = "NATURAL" | "JURIDICA";

export type TipoDocumentoIdentidad = "DNI" | "RUC" | "CE" | "PASAPORTE";

export interface DatosSolicitante {
  /** Persona Natural o Persona Jurídica */
  tipoPersona: TipoPersona;
  /** Documento de identidad oficial peruano o extranjero */
  tipoDocumento: TipoDocumentoIdentidad;
  /** Número de documento (8 dígitos DNI, 11 dígitos RUC, etc.) */
  numeroDocumento: string;
  /** Nombres del solicitante o representante legal */
  nombres: string;
  /** Apellidos del solicitante o representante legal */
  apellidos: string;
  /** Razón Social requerida en caso de Persona Jurídica */
  razonSocial?: string;
  /** Correo electrónico institucional o personal para notificaciones (RFC 5322) */
  correo: string;
  /** Celular de 9 dígitos que comience en 9 para alertas por SMS */
  celular: string;
  /** Programa de estudios oficial del IESTP Suiza (si aplica) */
  programaEstudios?: string;
  /** Ubigeo: Departamento (por defecto Ucayali) */
  departamento: string;
  /** Ubigeo: Provincia (Coronel Portillo, Padre Abad, etc.) */
  provincia: string;
  /** Ubigeo: Distrito (Callería, Yarinacocha, Manantay, etc.) */
  distrito: string;
  /** Dirección domiciliaria o fiscal detallada */
  direccion?: string;
}

// =============================================================================
// 3. MODELOS DE DATOS: PASO 2 — SELECCIÓN DE TRÁMITE TUPA Y DESTINO
// =============================================================================

export type TipoDocumentoPresentado =
  | "SOLICITUD"
  | "OFICIO"
  | "CARTA"
  | "MEMORANDUM"
  | "INFORME"
  | "EXPEDIENTE_EXTERNO";

export type PrioridadTramite = "NORMAL" | "URGENTE" | "MUY_URGENTE";

export interface TramiteSeleccionado {
  /** Identificador de catálogo (ej. 'TUPA-01', 'TUPA-04', 'LIBRE') */
  tipoProcedimientoId: string;
  /** Nombre completo y descriptivo del trámite TUPA */
  nombreProcedimiento: string;
  /** Flag que indica si corresponde a procedimiento oficial TUPA o libre */
  esTupa: boolean;
  /** Tipología documental formal conforme al marco archivístico institucional */
  tipoDocumentoPresentado: TipoDocumentoPresentado;
  /** Asunto concreto del petitorio (10 a 250 caracteres) */
  asunto: string;
  /** Cantidad total estimada de folios */
  cantidadFolios: number;
  /** ID de la unidad orgánica o área administrativa receptora */
  oficinaDestinoId: string;
  /** Nombre del área de destino (Secretaría Académica, Dirección, etc.) */
  nombreOficinaDestino: string;
  /** Prioridad del expediente */
  prioridad: PrioridadTramite;
  /** Fundamentación de urgencia si la prioridad no es NORMAL */
  justificacionPrioridad?: string;
  /** Costo administrativo oficial del trámite en Soles (PEN) */
  costoSoles?: number;
  /** Plazo máximo legal de resolución en días hábiles (LPAG Ley 27444) */
  diasPlazoLegal?: number;
}

// =============================================================================
// 4. MODELOS DE DATOS: PASO 3 — ARCHIVOS Y FORMULARIO DINÁMICO
// =============================================================================

export type CategoriaDocumento = "PRINCIPAL" | "ANEXO";

export interface ArchivoCargado {
  /** Identificador único local para la lista UI */
  id: string;
  /** Nombre original del archivo */
  nombreOriginal: string;
  /** Tamaño del archivo en bytes (máx 25 MB) */
  tamanoBytes: number;
  /** Tipo MIME validado (application/pdf) */
  mimeType: string;
  /** Hash criptográfico SHA-256 verificado en cliente */
  hashSha256: string;
  /** Clave de objeto en MinIO / S3 tras subida prefirmada */
  s3Key: string;
  /** Cantidad de folios del documento */
  totalFolios: number;
  /** Categoría del archivo: Principal (único) o Anexo complementario */
  categoria: CategoriaDocumento;
  /** Descripción o rótulo del anexo (opcional) */
  descripcion?: string;
  /** Referencia en memoria del objeto File nativo durante la sesión */
  fileRef?: File;
  /** Marca temporal de carga exitosa */
  uploadedAt?: string;
}

/**
 * Identificadores únicos oficiales de los 11 Programas de Estudio del IESTP "Suiza".
 */
export type ProgramaEstudioCodigo =
  | "ADE"
  | "AOT"
  | "ASAD"
  | "CONT"
  | "CCIV"
  | "DSI"
  | "EIND"
  | "ENF"
  | "MFOR"
  | "MAUT"
  | "PAGR";

/**
 * Catálogo canónico oficial de los 11 Programas de Estudio del IESTP "Suiza".
 */
export interface ProgramaEstudioItem {
  readonly value: ProgramaEstudioCodigo;
  readonly label: string;
  readonly description?: string;
}

export const PROGRAMAS_ESTUDIO_CATALOGO: readonly ProgramaEstudioItem[] = [
  { value: "ADE", label: "Administración de Empresas", description: "Gestión empresarial, finanzas y emprendimiento" },
  { value: "AOT", label: "Administración de Operaciones Turísticas", description: "Hotelería, turismo amazónico y gestión de servicios" },
  { value: "ASAD", label: "Asistencia Administrativa", description: "Gestión documental, archivo institucional y soporte ejecutivo" },
  { value: "CONT", label: "Contabilidad", description: "Tributación, auditoría y estados financieros" },
  { value: "CCIV", label: "Construcción Civil", description: "Topografía, edificaciones, obras viales y saneamiento" },
  { value: "DSI", label: "Desarrollo de Sistemas de Información", description: "Desarrollo de software, bases de datos y redes informáticas" },
  { value: "EIND", label: "Electricidad Industrial", description: "Sistemas electrotécnicos, automatización y mantenimiento industrial" },
  { value: "ENF", label: "Enfermería Técnica", description: "Salud pública, atención integral y cuidados comunitarios" },
  { value: "MFOR", label: "Manejo Forestal", description: "Conservación ambiental, silvicultura e industrias madereras" },
  { value: "MAUT", label: "Mecánica Automotriz", description: "Diagnóstico electrónico, motores térmicos y electromovilidad" },
  { value: "PAGR", label: "Producción Agropecuaria", description: "Cultivos tropicales, zootecnia y sanidad agropecuaria" },
] as const;

/**
 * Payload dinámico de formulario generado por el motor JSON Schema.
 * Se define estrictamente como Record<string, unknown> para evitar 'any'.
 */
export type DynamicFormPayload = Record<string, unknown>;

// =============================================================================
// 5. MODELOS DE DATOS: PASO 4 — RESUMEN, DECLARACIÓN JURADA Y CARGO
// =============================================================================

export interface DeclaracionJuradaState {
  /** Administrado declara bajo juramento la autenticidad (Art. 51 Ley N° 27444) */
  aceptada: boolean;
  /** Aceptación de la política de protección de datos personales */
  leidoPoliticasPrivacidad: boolean;
  /** Marca temporal ISO del momento de la declaración */
  fechaAceptacion?: string;
}

// =============================================================================
// 6. ESTADO CONSOLIDADO DEL BORRADOR DE TRAMITACIÓN (REACT STATE)
// =============================================================================

export interface TramiteWizardFormData {
  /** Paso 1: Datos completos del solicitante */
  solicitante: DatosSolicitante;
  /** Paso 2: Parámetros del trámite institucional */
  tramite: TramiteSeleccionado;
  /** Paso 3A: Respuestas dinámicas al esquema del TUPA seleccionado */
  datosFormulario: DynamicFormPayload;
  /** Paso 3B: Documento probatorio principal en formato PDF */
  documentoPrincipal: ArchivoCargado | null;
  /** Paso 3C: Lista de anexos documentales complementarios */
  anexos: ArchivoCargado[];
  /** Paso 4: Declaración jurada de veracidad */
  declaracionJurada: DeclaracionJuradaState;
}

/**
 * Estado inicial limpio del formulario de tramitación.
 */
export const INITIAL_TRAMITE_WIZARD_DATA: Readonly<TramiteWizardFormData> = {
  solicitante: {
    tipoPersona: "NATURAL",
    tipoDocumento: "DNI",
    numeroDocumento: "",
    nombres: "",
    apellidos: "",
    correo: "",
    celular: "",
    programaEstudios: "",
    departamento: "Ucayali",
    provincia: "Coronel Portillo",
    distrito: "Callería",
    direccion: "",
  },
  tramite: {
    tipoProcedimientoId: "",
    nombreProcedimiento: "",
    esTupa: false,
    tipoDocumentoPresentado: "SOLICITUD",
    asunto: "",
    cantidadFolios: 1,
    oficinaDestinoId: "",
    nombreOficinaDestino: "",
    prioridad: "NORMAL",
  },
  datosFormulario: {},
  documentoPrincipal: null,
  anexos: [],
  declaracionJurada: {
    aceptada: false,
    leidoPoliticasPrivacidad: false,
  },
};

// =============================================================================
// 7. TIPOS DE NAVEGACIÓN, VALIDACIÓN Y ACCESIBILIDAD WCAG 2.1 AA
// =============================================================================

/**
 * Estado visual y de accesibilidad de cada paso en la barra de progreso.
 */
export type StepStatus = "completed" | "active" | "pending";

/**
 * Resultado estructurado de validación por paso para evitar el avance inválido.
 */
export interface StepValidationResult {
  isValid: boolean;
  errors: Record<string, string[]>;
}

/**
 * Firma tipada de la función validadora de paso.
 */
export type StepValidatorFn = (
  data: TramiteWizardFormData
) => boolean | StepValidationResult;

/**
 * Propiedades del componente visual de la barra de progreso (WizardStepBar).
 */
export interface WizardStepBarProps {
  /** Paso actualmente activo (1 a 4) */
  currentStep: WizardStepId;
  /** Lista opcional de pasos completados con éxito */
  completedSteps?: ReadonlyArray<WizardStepId>;
  /** Paso máximo alcanzado con validación para permitir navegación hacia atrás/adelante */
  maxStepReached?: WizardStepId;
  /** Permite interactuar con los pasos para navegación directa */
  isInteractive?: boolean;
  /** Callback accionado al hacer clic en un paso permitido */
  onStepClick?: (step: WizardStepId) => void;
  /** Clases utilitarias adicionales para Tailwind CSS */
  className?: string;
  /** Etiqueta semántica de accesibilidad para el landmark <nav> */
  ariaLabel?: string;
}

/**
 * Contrato de retorno del hook useTramiteWizard.
 */
export interface UseTramiteWizardReturn {
  // Estados reactivos en memoria
  currentStep: WizardStepId;
  formData: TramiteWizardFormData;
  isValidStep: boolean;
  isSubmitting: boolean;
  completedSteps: WizardStepId[];
  stepErrors: Record<string, string[]>;

  // Métodos de navegación con validación bloqueante
  goToNextStep: () => boolean;
  goToPrevStep: () => boolean;
  goToStep: (targetStep: WizardStepId) => boolean;
  resetWizard: () => void;

  // Actualización modular de datos
  updateStepData: <K extends keyof TramiteWizardFormData>(
    section: K,
    data: Partial<TramiteWizardFormData[K]>
  ) => void;
  setFormData: React.Dispatch<React.SetStateAction<TramiteWizardFormData>>;
  setSubmitting: (submitting: boolean) => void;
  validateCurrentStep: () => boolean;

  // Metadatos y utilidades del paso actual
  isFirstStep: boolean;
  isLastStep: boolean;
  stepConfig: WizardStepDefinition;
  totalSteps: number;
  canGoNext: boolean;
  canGoPrev: boolean;
}

/**
 * Opciones de configuración del hook useTramiteWizard.
 */
export interface UseTramiteWizardOptions {
  /** Paso inicial del asistente (por defecto 1) */
  initialStep?: WizardStepId;
  /** Datos iniciales opcionales para precarga o edición de borrador */
  initialData?: Partial<TramiteWizardFormData>;
  /** Validadores personalizados por paso */
  customValidators?: Partial<Record<WizardStepId, StepValidatorFn>>;
  /** Clave opcional de sincronización con almacenamiento de sesión (sessionStorage) */
  storageKey?: string;
  /** Activar persistencia en memoria de sesión del navegador (por defecto true) */
  persistInSession?: boolean;
  /** Callback invocado al completar satisfactoriamente el paso 4 */
  onComplete?: (data: TramiteWizardFormData) => Promise<void> | void;
}
