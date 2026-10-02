import React from 'react';
import { useForm } from 'react-hook-form';

// Estructura básica de un JSON Schema Draft 2020-12 simplificado
export interface JSONSchemaProperty {
  type: 'string' | 'number' | 'integer' | 'boolean' | 'array';
  title?: string;
  description?: string;
  enum?: string[];
  format?: 'date' | 'email' | 'uri';
  minLength?: number;
}

export interface JSONSchema {
  type: string;
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
}

interface DynamicSchemaFormProps {
  schema: JSONSchema | null;
  onSubmit: (data: Record<string, unknown>) => void;
  isSubmitting?: boolean;
}

export const DynamicSchemaForm: React.FC<DynamicSchemaFormProps> = ({
  schema,
  onSubmit,
  isSubmitting = false,
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Record<string, unknown>>();

  if (!schema || !schema.properties) {
    return <div className="p-4 text-amber-600">Esquema de formulario no válido o vacío.</div>;
  }

  const renderField = (key: string, field: JSONSchemaProperty) => {
    const isRequired = schema.required?.includes(key);

    // Renderizar select para campos con opciones (enum)
    if (field.enum && field.enum.length > 0) {
      return (
        <select
          {...register(key, { required: isRequired ? 'Este campo es requerido' : false })}
          className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
        >
          <option value="">Seleccione una opción...</option>
          {field.enum.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      );
    }

    // Renderizar inputs según formato/tipo
    switch (field.type) {
      case 'boolean':
        return (
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              {...register(key)}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">{field.title || key}</span>
          </div>
        );

      case 'string':
      {
        const inputType = field.format === 'date' ? 'date' : field.format === 'email' ? 'email' : 'text';
        return (
          <input
            type={inputType}
            {...register(key, {
              required: isRequired ? 'Este campo es requerido' : false,
              minLength: field.minLength
                ? { value: field.minLength, message: `Mínimo ${field.minLength} caracteres` }
                : undefined,
            })}
            placeholder={field.description || ''}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        );
      }

      case 'number':
      case 'integer':
        return (
          <input
            type="number"
            {...register(key, { required: isRequired ? 'Este campo es requerido' : false })}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        );

      default:
        return (
          <input
            type="text"
            {...register(key, { required: isRequired ? 'Este campo es requerido' : false })}
            className="w-full rounded-md border border-gray-300 p-2 focus:border-blue-500 focus:outline-none"
          />
        );
    }
  };

  return (
    <form onSubmit={handleSubmit((data) => onSubmit(data))} className="space-y-4">
      {Object.entries(schema.properties).map(([key, field]) => {
        const isRequired = schema.required?.includes(key);

        return (
          <div key={key} className="flex flex-col space-y-1">
            {field.type !== 'boolean' && (
              <label className="text-sm font-medium text-gray-700">
                {field.title || key}
                {isRequired && <span className="ml-1 text-red-500">*</span>}
              </label>
            )}

            {renderField(key, field)}

            {errors[key] && (
              <span className="text-xs text-red-500">
                {errors[key]?.message as string}
              </span>
            )}
          </div>
        );
      })}

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-md bg-blue-600 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        {isSubmitting ? 'Procesando...' : 'Registrar Trámite'}
      </button>
    </form>
  );
};