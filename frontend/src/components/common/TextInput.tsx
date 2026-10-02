/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/common/TextInput.tsx
 * RESPONSABLE: Anllely Melgarejo V. (F_ANLLELY)
 * COLABORADORAS: Lucy Panduro Ramos, Noelia Alva (Grupo 1)
 * 
 * DESCRIPCIÓN:
 * Componente atómico de entrada de texto accesible (WCAG 2.1 AA).
 * Provee soporte para placeholder estándar (`placeholder:text-slate-400`),
 * estados de error y foco de alto contraste (`focus:ring-[#006EC7]`), iconos
 * opcionales y vinculación ARIA (`aria-invalid`, `aria-describedby`).
 * 100% TypeScript estricto (cero 'any').
 * ==============================================================================
 */

import React, { useId, forwardRef } from "react";

export interface TextInputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Etiqueta visible sobre el input */
  label?: string;
  /** Mensaje de error a desplegar debajo del campo */
  error?: string;
  /** Texto de ayuda o instrucción secundaria */
  helperText?: string;
  /** Elemento o icono posicionado al lado izquierdo */
  leftIcon?: React.ReactNode;
  /** Elemento o icono posicionado al lado derecho */
  rightIcon?: React.ReactNode;
  /** Clases adicionales para el contenedor exterior */
  containerClassName?: string;
}

export const TextInput = forwardRef<HTMLInputElement, TextInputProps>(
  (
    {
      id,
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      required,
      disabled,
      className = "",
      containerClassName = "",
      placeholder,
      ...rest
    },
    ref
  ) => {
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Composición de identificadores para lectores de pantalla
    const describedBy = [
      error ? errorId : null,
      helperText ? helperId : null,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div className={`w-full ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            {label}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3 flex items-center text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            required={required}
            placeholder={placeholder}
            aria-invalid={error ? "true" : "false"}
            aria-describedby={describedBy || undefined}
            className={`w-full rounded-lg border bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors
              placeholder:text-slate-400
              focus:outline-none focus:ring-2 focus:ring-offset-1
              disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400
              ${leftIcon ? "pl-10" : ""}
              ${rightIcon ? "pr-10" : ""}
              ${
                error
                  ? "border-red-400 focus:border-red-500 focus:ring-red-200"
                  : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
              }
              ${className}
            `}
            {...rest}
          />

          {rightIcon && (
            <div className="pointer-events-none absolute right-3 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}
        </div>

        {error ? (
          <p
            id={errorId}
            role="alert"
            className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1"
          >
            <svg
              className="h-3.5 w-3.5 shrink-0"
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
            <span>{error}</span>
          </p>
        ) : helperText ? (
          <p id={helperId} className="mt-1 text-xs text-slate-500">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

TextInput.displayName = "TextInput";

export default TextInput;
