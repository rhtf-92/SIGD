/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-02 — Motor Dinámico de Formularios JSON Schema (Draft 2020-12)
 * ARCHIVO: src/types/jsonSchema.ts
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R/A) - Lucy Panduro Ramos (C)
 * 
 * DESCRIPCIÓN:
 * Definiciones de tipos estrictas para el motor de interpretación y renderizado
 * dinámico de formularios gobernados por JSON Schema (Draft 2020-12).
 * Elimina completamente el uso de 'any' para evitar la penalización docente PEN-06.
 * Diseñado para emitir estructuras válidas destinadas a columnas PostgreSQL JSONB.
 * ==============================================================================
 */

// =============================================================================
// 1. TIPOS PRIMITIVOS Y FORMATOS JSON SCHEMA DRAFT 2020-12
// =============================================================================

/**
 * Tipos de datos primitivos admitidos en la especificación JSON Schema Draft 2020-12.
 */
export type JsonSchemaPrimitiveType =
  | "string"
  | "number"
  | "integer"
  | "boolean";

/**
 * Formatos de cadena semánticos reconocidos para validación y selección de widgets.
 */
export type JsonSchemaFormat =
  | "date"
  | "email"
  | "uri"
  | "time"
  | "date-time"
  | "uuid";

/**
 * Tipologías de controles visuales (widgets) inferidos por el parser.
 */
export type FormWidgetType =
  | "text"
  | "textarea"
  | "number"
  | "select"
  | "date"
  | "checkbox";

// =============================================================================
// 2. DEFINICIÓN DE PROPIEDADES INDIVIDUALES DEL ESQUEMA
// =============================================================================

/**
 * Definición canónica de una propiedad dentro del objeto `properties` de un JSON Schema.
 */
export interface SchemaProperty {
  /** Título descriptivo visible del campo */
  readonly title: string;
  /** Descripción o instrucción de ayuda contextual */
  readonly description?: string;
  /** Tipo de dato primitivo JSON Schema */
  readonly type: JsonSchemaPrimitiveType;
  /** Valor predeterminado de inicialización */
  readonly default?: string | number | boolean;
  /** Lista finita de valores admisibles para selectores (enum) */
  readonly enum?: readonly (string | number)[];
  /** Valor numérico mínimo permitido */
  readonly minimum?: number;
  /** Valor numérico máximo permitido */
  readonly maximum?: number;
  /** Longitud mínima de caracteres para cadenas */
  readonly minLength?: number;
  /** Longitud máxima de caracteres para cadenas */
  readonly maxLength?: number;
  /** Expresión regular de validación sintáctica */
  readonly pattern?: string;
  /** Formato semántico especial (date, email, uri) */
  readonly format?: JsonSchemaFormat;
  /** Flag que indica si el campo es de solo lectura */
  readonly readOnly?: boolean;
  /** Pistas opcionales para forzar un widget específico */
  readonly widget?: FormWidgetType;
}

// =============================================================================
// 3. ESTRUCTURA RAÍZ DEL ESQUEMA (JSON SCHEMA DRAFT 2020-12)
// =============================================================================

/**
 * Esquema raíz formal descargado desde el endpoint canónico:
 * `GET /api/v1/tipos-documentos/:id/formulario-schema`
 */
export interface JsonSchemaDraft2020_12 {
  /** Metadato del dialecto oficial JSON Schema */
  readonly $schema?: string;
  /** Identificador URI unívoco del esquema */
  readonly $id?: string;
  /** Título formal del procedimiento TUPA o documento institucional */
  readonly title: string;
  /** Descripción del procedimiento administrativo */
  readonly description?: string;
  /** El tipo raíz de un formulario dinámico siempre es un objeto */
  readonly type: "object";
  /** Mapa de propiedades que componen los campos del formulario */
  readonly properties: Record<string, SchemaProperty>;
  /** Claves de propiedades estrictamente requeridas para radicación */
  readonly required?: readonly string[];
}

// =============================================================================
// 4. ESTRUCTURA INTERMEDIA DE CAMPOS PARSEADOS (PARSED FORM FIELDS)
// =============================================================================

/**
 * Representación de una opción elegible en selectores desplegables.
 */
export interface FieldOption {
  readonly label: string;
  readonly value: string | number;
  readonly description?: string;
}

/**
 * Reglas consolidadas de validación para evaluación client-side en React Hook Form.
 */
export interface FieldValidationRules {
  readonly required?: boolean;
  readonly min?: number;
  readonly max?: number;
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  /** Regla de negocio LPAG (Ley N° 27444): bloqueo de fines de semana */
  readonly noWeekends?: boolean;
}

/**
 * Modelo de campo parseado listo para ser renderizado por DynamicSchemaForm.
 */
export interface ParsedFormField {
  /** Clave de la propiedad en el JSONB */
  readonly name: string;
  /** Etiqueta visible del control */
  readonly label: string;
  /** Descripción auxiliar o texto de ayuda */
  readonly description?: string;
  /** Tipo de control UI a instanciar */
  readonly widget: FormWidgetType;
  /** Flag de obligatoriedad deducido de required[] */
  readonly required: boolean;
  /** Valor inicial por defecto */
  readonly defaultValue?: string | number | boolean;
  /** Opciones si widget === 'select' */
  readonly options?: readonly FieldOption[];
  /** Reglas de validación estáticas deducidas del esquema */
  readonly validationRules: FieldValidationRules;
  /** Texto de marcador de posición accesible */
  readonly placeholder?: string;
}

// =============================================================================
// 5. PAYLOAD DE SALIDA PARA COLUMNA POSTGRESQL JSONB
// =============================================================================

/**
 * Payload estructurado emitido por el formulario dinámico.
 * Mapea directamente a la columna `JSONB` de la tabla `expedientes` en PostgreSQL 18.
 * Tipado de forma segura sin recurrir a 'any'.
 */
export type DynamicFormValues = Record<string, unknown>;
