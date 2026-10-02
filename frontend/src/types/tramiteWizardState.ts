/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-14 — Arquitectura de Máquina de Estados de UI y Persistencia Defensiva
 * ARCHIVO: src/types/tramiteWizardState.ts
 * ==============================================================================
 * DESCRIPCIÓN:
 * Definiciones de tipos e interfaces canónicas para el asistente de trámites (Wizard)
 * estructurado en 4 pasos canónicos:
 * 1. Identificación del Solicitante
 * 2. Documentos del Trámite
 * 3. Declaración Jurada de Veracidad (Art. 51 Ley N° 27444)
 * 4. Confirmación y Emisión de Cargo Digital (CUT)
 *
 * Cumplimiento estricto: TypeScript 5+ sin 'any' (PEN-06), inmutabilidad y
 * compatibilidad con verbatimModuleSyntax.
 * ==============================================================================
 */

/**
 * 4 pasos canónicos del asistente de tramitación de Mesa de Partes Virtual.
 * 1: Identificación
 * 2: Documentos
 * 3: Declaración Jurada
 * 4: Confirmación / Emisión de Cargo
 */
export type WizardStep = 1 | 2 | 3 | 4;

/**
 * Identificador semántico de cada paso canónico.
 */
export type WizardStepKey =
  | 'IDENTIFICACION'
  | 'DOCUMENTOS'
  | 'DECLARACION_JURADA'
  | 'CONFIRMACION_CARGO';

/**
 * Metadatos inmutables para renderizado accesible de cada paso en el stepper.
 */
export interface CanonicalStepMetadata {
  readonly step: WizardStep;
  readonly key: WizardStepKey;
  readonly title: string;
  readonly shortTitle: string;
  readonly description: string;
}

/**
 * Catálogo canónico de configuración para los 4 pasos del Wizard.
 */
export const CANONICAL_STEPS: readonly CanonicalStepMetadata[] = [
  {
    step: 1,
    key: 'IDENTIFICACION',
    title: 'Identificación del Solicitante',
    shortTitle: 'Identificación',
    description: 'Datos de identidad oficial y contacto del administrado',
  },
  {
    step: 2,
    key: 'DOCUMENTOS',
    title: 'Documentos del Trámite',
    shortTitle: 'Documentos',
    description: 'Procedimiento institucional, petitorio sucinto y folios',
  },
  {
    step: 3,
    key: 'DECLARACION_JURADA',
    title: 'Declaración Jurada',
    shortTitle: 'Declaración Jurada',
    description: 'Aceptación de términos legales y notificación vía casilla',
  },
  {
    step: 4,
    key: 'CONFIRMACION_CARGO',
    title: 'Confirmación y Emisión de Cargo',
    shortTitle: 'Cargo Digital',
    description: 'Resumen probatorio y Código Único de Trámite (CUT) oficial',
  },
] as const;

/**
 * Tipos de documentos de identidad reconocidos por la administración pública peruana.
 */
export type TipoDocumentoIdentidad = 'DNI' | 'CE' | 'RUC';

/**
 * Datos correspondientes al Paso 1: Identificación del Solicitante.
 */
export interface IdentificacionData {
  tipoDocumento: TipoDocumentoIdentidad;
  numeroDocumento: string;
  nombres: string;
  apellidos: string;
  correo: string;
  telefono: string;
  direccion?: string;
}

/**
 * Metadatos de un archivo digital adjuntado al expediente.
 */
export interface ArchivoTramite {
  nombre: string;
  peso: number;
  hashSha256: string;
  storageUrl?: string;
}

/**
 * Datos correspondientes al Paso 2: Documentos del Trámite.
 */
export interface DocumentosData {
  tipoTramiteId: string;
  asunto: string;
  numeroFolios: number;
  archivos: ArchivoTramite[];
}

/**
 * Datos correspondientes al Paso 3: Declaración Jurada.
 * Sustentado en el Art. 51 del TUO de la Ley N° 27444 (LPAG).
 */
export interface DeclaracionJuradaData {
  aceptaTerminos: boolean;
  declaracionVeracidad: boolean;
  autorizaNotificacionCasilla: boolean;
}

/**
 * Respuesta oficial del backend tras la radicación legal del trámite.
 * Contiene el Código Único de Trámite (CUT) inmutable y trazabilidad.
 */
export interface CargoDigitalResponse {
  cut: string;
  fechaRadicacion: string;
  fechaRecepcionOficial: string;
  asunto: string;
  remitente: string;
  hashTransaccion: string;
  qrValidationUrl: string;
}

/**
 * Estado global inmutable de la máquina de estados del TramiteWizard.
 */
export interface TramiteWizardState {
  currentStep: WizardStep;
  identificacion: IdentificacionData;
  documentos: DocumentosData;
  declaracionJurada: DeclaracionJuradaData;
  cargoEmitido: CargoDigitalResponse | null;
  isSubmitting: boolean;
  error: string | null;
}

/**
 * Acciones atómicas discriminadas para la transición de estados en el reducer.
 */
export type WizardAction =
  | { type: 'SET_STEP'; payload: WizardStep }
  | { type: 'UPDATE_IDENTIFICACION'; payload: Partial<IdentificacionData> }
  | { type: 'UPDATE_DOCUMENTOS'; payload: Partial<DocumentosData> }
  | { type: 'UPDATE_DECLARACION'; payload: Partial<DeclaracionJuradaData> }
  | { type: 'SET_CARGO'; payload: CargoDigitalResponse }
  | { type: 'SET_SUBMITTING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'RESET' };

/**
 * Valores iniciales por defecto para el estado de Identificación.
 */
export const INITIAL_IDENTIFICACION: IdentificacionData = {
  tipoDocumento: 'DNI',
  numeroDocumento: '',
  nombres: '',
  apellidos: '',
  correo: '',
  telefono: '',
  direccion: '',
};

/**
 * Valores iniciales por defecto para el estado de Documentos.
 */
export const INITIAL_DOCUMENTOS: DocumentosData = {
  tipoTramiteId: '',
  asunto: '',
  numeroFolios: 1,
  archivos: [],
};

/**
 * Valores iniciales por defecto para el estado de Declaración Jurada.
 */
export const INITIAL_DECLARACION: DeclaracionJuradaData = {
  aceptaTerminos: false,
  declaracionVeracidad: false,
  autorizaNotificacionCasilla: true,
};

/**
 * Estado canónico inicial del Asistente Wizard.
 */
export const INITIAL_WIZARD_STATE: TramiteWizardState = {
  currentStep: 1,
  identificacion: INITIAL_IDENTIFICACION,
  documentos: INITIAL_DOCUMENTOS,
  declaracionJurada: INITIAL_DECLARACION,
  cargoEmitido: null,
  isSubmitting: false,
  error: null,
};