/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-02 — Motor Dinámico de Formularios JSON Schema (Draft 2020-12)
 * ARCHIVO: src/utils/schemaFormParser.ts
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R/A) - Lucy Panduro Ramos (C)
 * 
 * DESCRIPCIÓN:
 * Intérprete desacoplado para transformar esquemas formales JSON Schema
 * (Draft 2020-12) en una estructura plana y declarativa de campos UI (`ParsedFormField[]`).
 * Incluye:
 * - Inferencia inteligente de widgets (text, textarea, number, select, date, checkbox).
 * - Mapeo de reglas de validación client-side para React Hook Form.
 * - Regla de negocio LPAG (Ley N° 27444): Verificación y bloqueo de fines de semana (`isWeekend`).
 * - Extractor de valores iniciales por defecto (`extractDefaultValues`).
 * - Esquema mock oficial de procedimiento TUPA institucional (`mockTupaSchema`).
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import {
  type JsonSchemaDraft2020_12,
  type SchemaProperty,
  type ParsedFormField,
  type FormWidgetType,
  type FieldOption,
  type FieldValidationRules,
  type DynamicFormValues,
} from "../types/jsonSchema";

// =============================================================================
// 1. UTILIDAD DE NEGOCIO LPAG: CONTROL DE DÍAS HÁBILES (LEY N° 27444)
// =============================================================================

/**
 * Evalúa si una fecha dada en formato 'YYYY-MM-DD' o ISO 8601 corresponde a un fin de semana
 * (sábado o domingo), conforme a la regla de cómputo de plazos hábiles del Art. 138 de la Ley N° 27444.
 * Implementa parseo defensivo por componentes para evitar el desfase horario UTC de JavaScript.
 * 
 * @param dateString Fecha en formato 'YYYY-MM-DD' o similar.
 * @returns true si es sábado o domingo, false si es día hábil (lunes a viernes).
 */
export function isWeekend(dateString: string): boolean {
  if (!dateString || typeof dateString !== "string") {
    return false;
  }

  const trimmed = dateString.trim();
  // Extracción defensiva de partes año, mes, día (ignora horas si existen)
  const parts = trimmed.split("T")[0].split("-");
  if (parts.length >= 3) {
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // 0-indexado en Date de JS
    const day = parseInt(parts[2], 10);

    if (!isNaN(year) && !isNaN(month) && !isNaN(day)) {
      // Instanciación con hora fija a mediodía local para evitar bordes de medianoche
      const localDate = new Date(year, month, day, 12, 0, 0);
      const dayOfWeek = localDate.getDay();
      // 0 = Domingo, 6 = Sábado
      return dayOfWeek === 0 || dayOfWeek === 6;
    }
  }

  // Fallback estándar si el formato difiere
  const parsedDate = new Date(trimmed);
  if (isNaN(parsedDate.getTime())) {
    return false;
  }
  const dayOfWeek = parsedDate.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6;
}

// =============================================================================
// 2. INFERENCIA DE WIDGETS Y REGLAS DE VALIDACIÓN
// =============================================================================

/**
 * Determina el tipo de widget UI adecuado para renderizar una propiedad del esquema.
 */
function inferWidgetType(key: string, prop: SchemaProperty): FormWidgetType {
  // 1. Si la propiedad declara explícitamente un widget sugerido
  if (prop.widget) {
    return prop.widget;
  }

  // 2. Si posee enumeración finita de valores, proyectar como selector desplegable
  if (prop.enum && Array.isArray(prop.enum) && prop.enum.length > 0) {
    return "select";
  }

  // 3. Tipos booleanos proyectan como casillas de verificación
  if (prop.type === "boolean") {
    return "checkbox";
  }

  // 4. Tipos numéricos enteros o decimales
  if (prop.type === "integer" || prop.type === "number") {
    return "number";
  }

  // 5. Cadenas con formato de fecha
  if (prop.type === "string" && prop.format === "date") {
    return "date";
  }

  // 6. Cadenas largas o descriptivas se proyectan como textarea
  const isKeyDescriptive =
    /motivo|asunto_largo|descripcion|detalle|observacion|fundamento|petitorio/i.test(
      key
    );
  if (
    prop.type === "string" &&
    ((prop.maxLength && prop.maxLength > 100) || isKeyDescriptive)
  ) {
    return "textarea";
  }

  // 7. Widget predeterminado para texto simple
  return "text";
}

/**
 * Convierte un array de enum en opciones enriquecidas { label, value }.
 */
function buildOptions(prop: SchemaProperty): readonly FieldOption[] | undefined {
  if (!prop.enum || !Array.isArray(prop.enum) || prop.enum.length === 0) {
    return undefined;
  }

  return prop.enum.map((val) => ({
    label: String(val),
    value: val,
  }));
}

/**
 * Consolida las reglas de validación aplicables en el cliente.
 */
function buildValidationRules(
  prop: SchemaProperty,
  isRequired: boolean,
  widget: FormWidgetType
): FieldValidationRules {
  return {
    required: isRequired,
    min: prop.minimum,
    max: prop.maximum,
    minLength: prop.minLength,
    maxLength: prop.maxLength,
    pattern: prop.pattern,
    noWeekends: widget === "date",
  };
}

// =============================================================================
// 3. PARSER PRINCIPAL: parseJsonSchema
// =============================================================================

/**
 * Transforma un objeto `JsonSchemaDraft2020_12` descargado de la API
 * en una lista ordenada de campos listos para renderizado declarativo.
 * 
 * @param schema Esquema formal del trámite TUPA.
 * @returns Array de campos parseados `ParsedFormField[]`.
 */
export function parseJsonSchema(
  schema: JsonSchemaDraft2020_12
): ParsedFormField[] {
  if (!schema || !schema.properties || typeof schema.properties !== "object") {
    return [];
  }

  const requiredList = new Set<string>(schema.required ?? []);
  const parsedFields: ParsedFormField[] = [];

  for (const [key, prop] of Object.entries(schema.properties)) {
    const isRequired = requiredList.has(key);
    const widget = inferWidgetType(key, prop);
    const options = buildOptions(prop);
    const validationRules = buildValidationRules(prop, isRequired, widget);

    parsedFields.push({
      name: key,
      label: prop.title || key,
      description: prop.description,
      widget,
      required: isRequired,
      defaultValue: prop.default,
      options,
      validationRules,
      placeholder: prop.description
        ? prop.description
        : `Ingrese ${prop.title || key}...`,
    });
  }

  return parsedFields;
}

// =============================================================================
// 4. EXTRACTOR DE VALORES POR DEFECTO PARA REACT HOOK FORM
// =============================================================================

/**
 * Construye el objeto de valores iniciales (`DynamicFormValues`) para alimentar
 * el estado del formulario o el hook `useForm({ defaultValues })`.
 * 
 * @param schema Esquema formal del trámite.
 * @returns Objeto Record<string, unknown> con valores tipados por defecto.
 */
export function extractDefaultValues(
  schema: JsonSchemaDraft2020_12
): DynamicFormValues {
  const defaults: DynamicFormValues = {};

  if (!schema || !schema.properties || typeof schema.properties !== "object") {
    return defaults;
  }

  for (const [key, prop] of Object.entries(schema.properties)) {
    if (prop.default !== undefined) {
      defaults[key] = prop.default;
      continue;
    }

    switch (prop.type) {
      case "boolean":
        defaults[key] = false;
        break;
      case "integer":
      case "number":
        // Si tiene un mínimo definido positivo, puede sugerirse, o cadena vacía para inputs
        defaults[key] = prop.minimum !== undefined ? prop.minimum : "";
        break;
      case "string":
      default:
        defaults[key] = "";
        break;
    }
  }

  return defaults;
}

// =============================================================================
// 5. VALIDADOR PURO CLIENT-SIDE POR CAMPO (CON REGLA LPAG)
// =============================================================================

/**
 * Valida el valor de un campo específico aplicando las reglas deducidas del esquema.
 * 
 * @param field Campo parseado.
 * @param value Valor actual del campo.
 * @returns Mensaje de error amigable en caso de infracción, o null si es válido.
 */
export function validateFieldValue(
  field: ParsedFormField,
  value: unknown
): string | null {
  const { validationRules, label, widget } = field;

  // 1. Chequeo de obligatoriedad
  const isEmpty =
    value === undefined ||
    value === null ||
    (typeof value === "string" && value.trim() === "") ||
    (widget === "checkbox" && value === false && validationRules.required);

  if (validationRules.required && isEmpty) {
    return `El campo "${label}" es obligatorio para continuar.`;
  }

  if (isEmpty) {
    return null; // Si no es requerido y está vacío, es válido
  }

  // 2. Validación de cadenas
  if (typeof value === "string") {
    const trimmed = value.trim();

    if (
      validationRules.minLength !== undefined &&
      trimmed.length < validationRules.minLength
    ) {
      return `"${label}" debe contener al menos ${validationRules.minLength} caracteres.`;
    }

    if (
      validationRules.maxLength !== undefined &&
      trimmed.length > validationRules.maxLength
    ) {
      return `"${label}" no puede superar los ${validationRules.maxLength} caracteres.`;
    }

    if (validationRules.pattern) {
      const regex = new RegExp(validationRules.pattern);
      if (!regex.test(trimmed)) {
        return `El formato ingresado en "${label}" no cumple con el patrón requerido.`;
      }
    }
  }

  // 3. Validación de números
  if (widget === "number") {
    const numValue =
      typeof value === "number" ? value : parseFloat(String(value));

    if (isNaN(numValue)) {
      return `"${label}" debe ser un valor numérico válido.`;
    }

    if (
      validationRules.min !== undefined &&
      numValue < validationRules.min
    ) {
      return `"${label}" debe ser mayor o igual a ${validationRules.min}.`;
    }

    if (
      validationRules.max !== undefined &&
      numValue > validationRules.max
    ) {
      return `"${label}" no puede ser mayor a ${validationRules.max}.`;
    }
  }

  // 4. Validación de fecha y Regla LPAG de fines de semana
  if (widget === "date" && typeof value === "string") {
    if (validationRules.noWeekends && isWeekend(value)) {
      return `La fecha seleccionada en "${label}" corresponde a un día inhábil (sábado o domingo). Conforme a la Ley N° 27444, seleccione un día hábil.`;
    }
  }

  return null;
}

// =============================================================================
// 6. ESQUEMA CANÓNICO DE PRUEBA OFICIAL TUPA (mockTupaSchema)
// =============================================================================

/**
 * Esquema de prueba representativo que modela el procedimiento oficial:
 * TUPA N° 04 — Certificado Oficial de Estudios (IESTP "Suiza").
 * Contiene al menos 4 tipos de datos:
 * 1. Asunto (string con límites de caracteres)
 * 2. Número de Folios (integer con rango 1-100)
 * 3. Motivo de Solicitud (textarea con min/max)
 * 4. Fecha de Documento (date con restricción LPAG de fin de semana)
 * 5. Programa de Estudios (select con catálogo oficial de carreras)
 */
export const mockTupaSchema: JsonSchemaDraft2020_12 = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  $id: "https://sigd.iestpsuiza.edu.pe/schemas/tramites/tupa-04-certificado.json",
  title: "Solicitud de Certificado Oficial de Estudios Modulares",
  description:
    "Procedimiento TUPA N° 04 — Expedición de certificado oficial según directivas del MINEDU.",
  type: "object",
  required: [
    "asunto",
    "cantidadFolios",
    "motivoSolicitud",
    "fechaDocumento",
    "programaEstudios",
  ],
  properties: {
    asunto: {
      type: "string",
      title: "Asunto de la Solicitud",
      description: "Resumen sucinto del requerimiento institucional",
      minLength: 10,
      maxLength: 100,
    },
    cantidadFolios: {
      type: "integer",
      title: "Número de Folios Acompañados",
      description: "Cantidad total de hojas físicas o digitales",
      minimum: 1,
      maximum: 100,
      default: 1,
    },
    motivoSolicitud: {
      type: "string",
      title: "Motivo y Finalidad del Petitorio",
      description: "Fundamente detalladamente el propósito del certificado (ej. convalidación, titulación, laboral)",
      minLength: 10,
      maxLength: 250,
      widget: "textarea",
    },
    fechaDocumento: {
      type: "string",
      format: "date",
      title: "Fecha de Emisión del Documento",
      description: "Fecha legal de emisión (lunes a viernes según LPAG)",
    },
    programaEstudios: {
      type: "string",
      title: "Programa de Estudios",
      description: "Carrera técnica profesional cursada en el IESTP Suiza",
      enum: [
        "Administración de Empresas",
        "Administración de Operaciones Turísticas",
        "Asistencia Administrativa",
        "Contabilidad",
        "Construcción Civil",
        "Desarrollo de Sistemas de Información",
        "Electricidad Industrial",
        "Enfermería Técnica",
        "Manejo Forestal",
        "Mecánica Automotriz",
        "Producción Agropecuaria",
      ],
    },
  },
};
