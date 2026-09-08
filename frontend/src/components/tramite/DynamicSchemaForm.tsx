/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-02 — Motor Dinámico de Formularios JSON Schema (Draft 2020-12)
 * ARCHIVO: src/components/tramite/DynamicSchemaForm.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Componente visual interactivo y accesible (WCAG 2.1 AA) para el renderizado
 * dinámico de formularios gobernados por esquemas formales JSON Schema Draft 2020-12.
 * - Integra React Hook Form para gestión reactiva de estado de alto rendimiento.
 * - Soporta 6 tipologías de widgets: text, textarea, number, select, date, checkbox.
 * - Aplica regla de negocio LPAG (Ley N° 27444) para bloqueo y error en fines de semana.
 * - Sincronización automática ante cambio de esquema (reset reactivo de estado).
 * - 100% TypeScript estricto: cero uso de 'any' (cumplimiento penalización PEN-06).
 * - Emisión continua de validez y payload sanitizado compatible con PostgreSQL JSONB.
 * ==============================================================================
 */

import React, { useEffect, useMemo, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import {
  type JsonSchemaDraft2020_12,
  type ParsedFormField,
  type DynamicFormValues,
} from "../../types/jsonSchema";
import {
  parseJsonSchema,
  extractDefaultValues,
  validateFieldValue,
} from "../../utils/schemaFormParser";

// =============================================================================
// CONTRATO DE PROPS DEL COMPONENTE
// =============================================================================

export interface DynamicSchemaFormProps {
  /** Esquema formal JSON Schema Draft 2020-12 a renderizar */
  schema: JsonSchemaDraft2020_12;
  /** Valores iniciales para hidratar el formulario (ej. al retroceder en el Wizard) */
  initialValues?: Record<string, unknown>;
  /** Callback reactivo emitido continuamente al cambiar valores o estado de validez */
  onChange?: (values: Record<string, unknown>, isValid: boolean) => void;
  /** Callback al enviar el formulario con payload limpio para PostgreSQL JSONB */
  onSubmit?: (values: Record<string, unknown>) => void;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
  /** Identificador HTML para vinculación de botones externos mediante form="id" */
  id?: string;
  /** Flag opcional para desplegar un botón de envío interno (por defecto false) */
  showSubmitButton?: boolean;
  /** Texto del botón de envío si showSubmitButton es true */
  submitButtonText?: string;
}

// =============================================================================
// FUNCIONES AUXILIARES DE TRANSFORMACIÓN Y SANITIZACIÓN
// =============================================================================

/**
 * Sanitiza y castea los valores del formulario de acuerdo al tipo de dato declarado
 * en el esquema, garantizando compatibilidad con columnas PostgreSQL JSONB.
 */
function sanitizeValuesForPayload(
  fields: readonly ParsedFormField[],
  rawValues: Record<string, unknown>
): DynamicFormValues {
  const payload: DynamicFormValues = {};

  for (const field of fields) {
    const rawVal = rawValues[field.name];

    if (rawVal === undefined || rawVal === null || rawVal === "") {
      payload[field.name] = null;
      continue;
    }

    switch (field.widget) {
      case "number": {
        const parsedNum =
          typeof rawVal === "number" ? rawVal : parseFloat(String(rawVal));
        payload[field.name] = isNaN(parsedNum) ? null : parsedNum;
        break;
      }
      case "checkbox":
        payload[field.name] = Boolean(rawVal);
        break;
      case "text":
      case "textarea":
        payload[field.name] =
          typeof rawVal === "string" ? rawVal.trim() : String(rawVal);
        break;
      default:
        payload[field.name] = rawVal;
        break;
    }
  }

  return payload;
}

/**
 * Evalúa exhaustivamente la validez de todos los campos del formulario
 * conforme a las reglas deducidas del esquema y la LPAG (Ley N° 27444).
 */
function computeFormValidity(
  fields: readonly ParsedFormField[],
  values: Record<string, unknown>
): boolean {
  for (const field of fields) {
    const error = validateFieldValue(field, values[field.name]);
    if (error !== null) {
      return false;
    }
  }
  return true;
}

// =============================================================================
// SUBCOMPONENTE DE MENSAJE DE ERROR ACCESIBLE
// =============================================================================

interface FieldErrorMessageProps {
  id?: string;
  message?: string;
}

const FieldErrorMessage: React.FC<FieldErrorMessageProps> = ({ id, message }) => {
  if (!message) return null;

  return (
    <p
      id={id}
      role="alert"
      className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-red-600 transition-all"
    >
      <svg
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500"
        fill="currentColor"
        viewBox="0 0 20 20"
        aria-hidden="true"
      >
        <path
          fillRule="evenodd"
          d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
          clipRule="evenodd"
        />
      </svg>
      <span className="leading-snug">{message}</span>
    </p>
  );
};

// =============================================================================
// COMPONENTE PRINCIPAL: DynamicSchemaForm
// =============================================================================

export const DynamicSchemaForm: React.FC<DynamicSchemaFormProps> = ({
  schema,
  initialValues,
  onChange,
  onSubmit,
  className = "",
  id = "dynamic-schema-form",
  showSubmitButton = false,
  submitButtonText = "Guardar Datos del Formulario",
}) => {
  // 1. Parseo memoizado del esquema a lista plana de campos UI
  const parsedFields = useMemo(() => parseJsonSchema(schema), [schema]);

  // 2. Cálculo memoizado de valores por defecto combinados con initialValues
  const defaultValues = useMemo(() => {
    const schemaDefaults = extractDefaultValues(schema);
    return {
      ...schemaDefaults,
      ...(initialValues ?? {}),
    };
  }, [schema, initialValues]);

  // 3. Inicialización del hook useForm con tipado Record<string, unknown>
  const {
    register,
    handleSubmit,
    reset,
    watch,
    getValues,
    formState: { errors },
  } = useForm<Record<string, unknown>>({
    mode: "onChange",
    defaultValues,
  });

  // Clave unívoca del esquema para detectar alternancia de trámite TUPA
  const schemaKey =
    schema.$id ||
    schema.title ||
    Object.keys(schema.properties || {}).sort().join(",");
  const prevSchemaKeyRef = useRef<string>(schemaKey);

  // Serialización controlada de initialValues para detectar hidrataciones externas
  const initialValuesHash = JSON.stringify(initialValues ?? {});
  const prevInitialValuesHashRef = useRef<string>(initialValuesHash);

  // 4. Sincronización automática: si el esquema cambia, resetear inmediatamente el formulario
  useEffect(() => {
    const schemaChanged = prevSchemaKeyRef.current !== schemaKey;
    const initialChanged = prevInitialValuesHashRef.current !== initialValuesHash;

    if (schemaChanged || initialChanged) {
      prevSchemaKeyRef.current = schemaKey;
      prevInitialValuesHashRef.current = initialValuesHash;
      reset(defaultValues);
    }
  }, [schemaKey, initialValuesHash, defaultValues, reset]);

  // 5. Emisión inicial de valores y validez al montar o alternar de esquema
  useEffect(() => {
    if (onChange) {
      const currentValues = getValues();
      const sanitized = sanitizeValuesForPayload(parsedFields, currentValues);
      const isValid = computeFormValidity(parsedFields, sanitized);
      onChange(sanitized, isValid);
    }
  }, [schemaKey, onChange, parsedFields, getValues]);

  // 6. Suscripción reactiva continua a los cambios de valor para actualizar al Wizard
  useEffect(() => {
    const subscription = watch((currentRawValues) => {
      if (onChange) {
        const sanitized = sanitizeValuesForPayload(
          parsedFields,
          currentRawValues as Record<string, unknown>
        );
        const isValid = computeFormValidity(parsedFields, sanitized);
        onChange(sanitized, isValid);
      }
    });

    return () => subscription.unsubscribe();
  }, [watch, onChange, parsedFields]);

  // 7. Handler de envío final del formulario
  const handleFormSubmit = useCallback(
    (rawFormData: Record<string, unknown>) => {
      const sanitizedPayload = sanitizeValuesForPayload(parsedFields, rawFormData);
      if (onSubmit) {
        onSubmit(sanitizedPayload);
      }
    },
    [parsedFields, onSubmit]
  );

  // Observador de valores actuales para reactividad visual (longitud de textarea, etc.)
  const watchedValues = watch();

  return (
    <form
      id={id}
      onSubmit={handleSubmit(handleFormSubmit)}
      noValidate
      className={`space-y-6 ${className}`}
    >
      {/* Encabezado descriptivo del esquema si dispone de título o descripción */}
      {(schema.title || schema.description) && (
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 transition-colors">
          {schema.title && (
            <h3 className="text-sm font-bold text-slate-800 tracking-tight">
              {schema.title}
            </h3>
          )}
          {schema.description && (
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {schema.description}
            </p>
          )}
        </div>
      )}

      {/* Renderizado declarativo de controles según su widget inferido */}
      <div className="space-y-5">
        {parsedFields.map((field) => {
          const fieldError = errors[field.name];
          const hasError = Boolean(fieldError);
          const errorMessage = fieldError?.message
            ? String(fieldError.message)
            : undefined;

          const inputId = `field-${field.name}`;
          const errorId = `error-${field.name}`;
          const descId = `desc-${field.name}`;
          const describedBy = [
            hasError ? errorId : null,
            field.description ? descId : null,
          ]
            .filter(Boolean)
            .join(" ");

          const currentValue = watchedValues[field.name];

          // =================================================================
          // WIDGET: CHECKBOX (Booleanos / Declaraciones simples)
          // =================================================================
          if (field.widget === "checkbox") {
            return (
              <div key={field.name} className="space-y-1">
                <div
                  className={`flex items-start gap-3 rounded-lg border p-3.5 transition-colors ${
                    hasError
                      ? "border-red-300 bg-red-50/30"
                      : "border-slate-200 bg-slate-50/50 hover:bg-slate-50"
                  }`}
                >
                  <input
                    id={inputId}
                    type="checkbox"
                    aria-invalid={hasError ? "true" : "false"}
                    aria-describedby={describedBy || undefined}
                    className="mt-0.5 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
                    {...register(field.name, {
                      validate: (val) => validateFieldValue(field, val) ?? true,
                    })}
                  />
                  <label
                    htmlFor={inputId}
                    className="cursor-pointer select-none text-xs leading-relaxed"
                  >
                    <span className="font-semibold text-slate-800">
                      {field.label}
                      {field.required && (
                        <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                          *
                        </span>
                      )}
                    </span>
                    {field.description && (
                      <span id={descId} className="mt-0.5 block text-slate-500">
                        {field.description}
                      </span>
                    )}
                  </label>
                </div>
                <FieldErrorMessage id={errorId} message={errorMessage} />
              </div>
            );
          }

          // =================================================================
          // WIDGET: SELECT (Selector desplegable accesible)
          // =================================================================
          if (field.widget === "select") {
            const isPlaceholderSelected =
              currentValue === undefined ||
              currentValue === null ||
              currentValue === "";

            return (
              <div key={field.name} className="space-y-1.5">
                <label
                  htmlFor={inputId}
                  className="block text-xs font-semibold text-slate-700"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>

                {field.description && (
                  <p id={descId} className="text-xs text-slate-500">
                    {field.description}
                  </p>
                )}

                <div className="relative">
                  <select
                    id={inputId}
                    aria-invalid={hasError ? "true" : "false"}
                    aria-describedby={describedBy || undefined}
                    className={`w-full appearance-none rounded-lg border bg-white px-3.5 py-2.5 pr-10 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer ${
                      isPlaceholderSelected
                        ? "text-slate-400 font-normal"
                        : "text-slate-900 font-medium"
                    } ${
                      hasError
                        ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                        : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
                    }`}
                    {...register(field.name, {
                      validate: (val) => validateFieldValue(field, val) ?? true,
                    })}
                  >
                    <option value="" disabled className="text-slate-400">
                      {field.placeholder || "-- Seleccione una opción --"}
                    </option>
                    {field.options?.map((option) => (
                      <option
                        key={String(option.value)}
                        value={option.value}
                        className="text-slate-900 font-normal"
                      >
                        {option.label}
                      </option>
                    ))}
                  </select>

                  <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      aria-hidden="true"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </div>
                </div>

                <FieldErrorMessage id={errorId} message={errorMessage} />
              </div>
            );
          }

          // =================================================================
          // WIDGET: TEXTAREA (Área de texto multilínea)
          // =================================================================
          if (field.widget === "textarea") {
            const currentTextLength =
              typeof currentValue === "string" ? currentValue.length : 0;

            return (
              <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={inputId}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  {field.validationRules.maxLength && (
                    <span className="text-[11px] font-mono text-slate-400">
                      {currentTextLength} / {field.validationRules.maxLength}
                    </span>
                  )}
                </div>

                {field.description && (
                  <p id={descId} className="text-xs text-slate-500">
                    {field.description}
                  </p>
                )}

                <textarea
                  id={inputId}
                  rows={4}
                  placeholder={field.placeholder}
                  maxLength={field.validationRules.maxLength}
                  aria-invalid={hasError ? "true" : "false"}
                  aria-describedby={describedBy || undefined}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 resize-y ${
                    hasError
                      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
                  }`}
                  {...register(field.name, {
                    validate: (val) => validateFieldValue(field, val) ?? true,
                  })}
                />

                <FieldErrorMessage id={errorId} message={errorMessage} />
              </div>
            );
          }

          // =================================================================
          // WIDGET: NUMBER (Numérico con límites minimum y maximum)
          // =================================================================
          if (field.widget === "number") {
            return (
              <div key={field.name} className="space-y-1.5">
                <label
                  htmlFor={inputId}
                  className="block text-xs font-semibold text-slate-700"
                >
                  {field.label}
                  {field.required && (
                    <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                      *
                    </span>
                  )}
                </label>

                {field.description && (
                  <p id={descId} className="text-xs text-slate-500">
                    {field.description}
                  </p>
                )}

                <input
                  id={inputId}
                  type="number"
                  min={field.validationRules.min}
                  max={field.validationRules.max}
                  step="1"
                  placeholder={field.placeholder || "0"}
                  aria-invalid={hasError ? "true" : "false"}
                  aria-describedby={describedBy || undefined}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                    hasError
                      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
                  }`}
                  {...register(field.name, {
                    validate: (val) => validateFieldValue(field, val) ?? true,
                  })}
                />

                <FieldErrorMessage id={errorId} message={errorMessage} />
              </div>
            );
          }

          // =================================================================
          // WIDGET: DATE (Fecha con regla de días hábiles LPAG Ley 27444)
          // =================================================================
          if (field.widget === "date") {
            return (
              <div key={field.name} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label
                    htmlFor={inputId}
                    className="block text-xs font-semibold text-slate-700"
                  >
                    {field.label}
                    {field.required && (
                      <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                        *
                      </span>
                    )}
                  </label>
                  <span className="text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    Días hábiles (LPAG Ley 27444)
                  </span>
                </div>

                {field.description && (
                  <p id={descId} className="text-xs text-slate-500">
                    {field.description}
                  </p>
                )}

                <input
                  id={inputId}
                  type="date"
                  aria-invalid={hasError ? "true" : "false"}
                  aria-describedby={describedBy || undefined}
                  className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 cursor-pointer ${
                    hasError
                      ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                      : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
                  }`}
                  {...register(field.name, {
                    validate: (val) => validateFieldValue(field, val) ?? true,
                  })}
                />

                <FieldErrorMessage id={errorId} message={errorMessage} />
              </div>
            );
          }

          // =================================================================
          // WIDGET DEFAULT: TEXT (Input de texto estándar)
          // =================================================================
          return (
            <div key={field.name} className="space-y-1.5">
              <label
                htmlFor={inputId}
                className="block text-xs font-semibold text-slate-700"
              >
                {field.label}
                {field.required && (
                  <span className="text-red-500 ml-1 font-bold" aria-hidden="true">
                    *
                  </span>
                )}
              </label>

              {field.description && (
                <p id={descId} className="text-xs text-slate-500">
                  {field.description}
                </p>
              )}

              <input
                id={inputId}
                type="text"
                placeholder={field.placeholder}
                aria-invalid={hasError ? "true" : "false"}
                aria-describedby={describedBy || undefined}
                className={`w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-slate-900 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-offset-1 ${
                  hasError
                    ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                    : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
                }`}
                {...register(field.name, {
                  validate: (val) => validateFieldValue(field, val) ?? true,
                })}
              />

              <FieldErrorMessage id={errorId} message={errorMessage} />
            </div>
          );
        })}
      </div>

      {/* Botón de envío opcional para escenarios autónomos */}
      {showSubmitButton && (
        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            className="inline-flex items-center justify-center rounded-lg bg-[#006EC7] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[#005ba3] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#006EC7] transition-all cursor-pointer"
          >
            {submitButtonText}
          </button>
        </div>
      )}
    </form>
  );
};

export default DynamicSchemaForm;
