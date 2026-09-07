/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/common/SearchableSelect.tsx
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R)
 * 
 * DESCRIPCIÓN:
 * Selector desplegable con búsqueda en tiempo real y accesibilidad WCAG 2.1 AA.
 * Muestra el placeholder en tono gris tenue (`text-slate-400`) mientras no haya
 * selección activa y conmuta inmediatamente a texto oscuro (`text-slate-900 font-medium`)
 * al elegir una opción. Soporta navegación por teclado, cierre al clic externo (escape),
 * filtrado por coincidencia y estados de validación/error sin recurrir a 'any'.
 * ==============================================================================
 */

import React, { useState, useRef, useEffect, useId, useMemo } from "react";

/**
 * Contrato canónico para cada elemento de la lista de opciones.
 */
export interface SelectOption {
  readonly value: string;
  readonly label: string;
  readonly description?: string;
  readonly disabled?: boolean;
}

export interface SearchableSelectProps {
  /** Lista de opciones disponibles */
  options: readonly SelectOption[];
  /** Valor seleccionado actual (coincide con el `value` de una opción) */
  value: string;
  /** Callback al cambiar la selección */
  onChange: (value: string) => void;
  /** Etiqueta visible del control */
  label?: string;
  /** Texto guía cuando no hay opción elegida (gris tenue `text-slate-400`) */
  placeholder?: string;
  /** Mensaje de error visual y semántico */
  error?: string;
  /** Texto descriptivo o instrucción de ayuda */
  helperText?: string;
  /** Deshabilita el selector */
  disabled?: boolean;
  /** Marca el campo como mandatorio */
  required?: boolean;
  /** Permite limpiar la selección actual */
  clearable?: boolean;
  /** Placeholder específico dentro de la barra de búsqueda */
  searchPlaceholder?: string;
  /** Mensaje si ningún resultado coincide con el filtro */
  emptyMessage?: string;
  /** Clases CSS adicionales para el contenedor */
  className?: string;
  /** ID personalizado opcional */
  id?: string;
}

export const SearchableSelect: React.FC<SearchableSelectProps> = ({
  options,
  value,
  onChange,
  label,
  placeholder = "Seleccione una opción...",
  error,
  helperText,
  disabled = false,
  required = false,
  clearable = false,
  searchPlaceholder = "Buscar en la lista...",
  emptyMessage = "No se encontraron coincidencias.",
  className = "",
  id,
}) => {
  const generatedId = useId();
  const selectId = id || generatedId;
  const listboxId = `${selectId}-listbox`;
  const errorId = `${selectId}-error`;
  const helperId = `${selectId}-helper`;

  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Opción actualmente seleccionada
  const selectedOption = useMemo(() => {
    return options.find((opt) => opt.value === value) || null;
  }, [options, value]);

  // Filtrado de opciones en tiempo real
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return options;
    return options.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        (opt.description && opt.description.toLowerCase().includes(term))
    );
  }, [options, searchTerm]);

  // Foco automático en el buscador al abrir el desplegable
  useEffect(() => {
    if (isOpen) {
      // Pequeño retardo para asegurar que el input esté montado en el DOM
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm("");
    }
  }, [isOpen]);

  // Cierre al hacer clic fuera del componente
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [isOpen]);

  // Manejador de teclado para accesibilidad (Escape cierra el panel)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;

    if (e.key === "Escape") {
      setIsOpen(false);
    } else if (e.key === "ArrowDown" && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    } else if (e.key === "Enter" && !isOpen) {
      e.preventDefault();
      setIsOpen(true);
    }
  };

  const handleSelect = (option: SelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
  };

  return (
    <div
      ref={containerRef}
      className={`relative w-full ${className}`}
      onKeyDown={handleKeyDown}
    >
      {/* Etiqueta del campo */}
      {label && (
        <label
          htmlFor={selectId}
          className="block text-xs font-semibold text-slate-700 mb-1.5"
        >
          {label}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
      )}

      {/* Botón principal del selector */}
      <button
        id={selectId}
        type="button"
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-invalid={error ? "true" : "false"}
        aria-describedby={
          error ? errorId : helperText ? helperId : undefined
        }
        disabled={disabled}
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex w-full items-center justify-between rounded-lg border bg-white px-3.5 py-2 text-left text-sm transition-colors cursor-pointer
          focus:outline-none focus:ring-2 focus:ring-offset-1
          disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400
          ${
            error
              ? "border-red-400 focus:border-red-500 focus:ring-red-200"
              : "border-slate-300 hover:border-slate-400 focus:border-[#006EC7] focus:ring-[#006EC7]/25"
          }
        `}
      >
        {/*
          REQUISITO ESPECÍFICO:
          - Si no hay opción seleccionada: placeholder en tono gris tenue (`text-slate-400 font-normal`).
          - Si hay opción seleccionada: texto oscuro institucional (`text-slate-900 font-medium`).
        */}
        <span
          className={`truncate ${
            selectedOption
              ? "text-slate-900 font-medium"
              : "text-slate-400 font-normal"
          }`}
        >
          {selectedOption ? selectedOption.label : placeholder}
        </span>

        <div className="flex items-center gap-1.5 ml-2 shrink-0">
          {clearable && selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              aria-label="Limpiar selección"
              className="p-0.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}

          {/* Flecha indicadora de apertura */}
          <svg
            className={`h-4 w-4 text-slate-400 transition-transform duration-200 ${
              isOpen ? "rotate-180 text-[#006EC7]" : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {/* Menú desplegable flotante */}
      {isOpen && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-50 mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-2 shadow-xl ring-1 ring-black/5"
        >
          {/* Barra de búsqueda interna */}
          <div className="relative mb-2">
            <div className="pointer-events-none absolute left-3 top-2.5 flex items-center text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={searchPlaceholder}
              aria-label={searchPlaceholder}
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#006EC7] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#006EC7]/20"
            />
          </div>

          {/* Lista de opciones scrolleable */}
          <div className="max-h-56 overflow-y-auto space-y-0.5">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(opt)}
                    className={`flex items-start justify-between rounded-lg px-3 py-2 text-xs transition cursor-pointer ${
                      opt.disabled
                        ? "opacity-50 cursor-not-allowed bg-slate-50"
                        : isSelected
                        ? "bg-blue-50/80 text-[#006EC7] font-semibold"
                        : "text-slate-700 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <div className="pr-2">
                      <p className="font-medium text-slate-900">{opt.label}</p>
                      {opt.description && (
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {opt.description}
                        </p>
                      )}
                    </div>

                    {isSelected && (
                      <svg
                        className="h-4 w-4 text-[#006EC7] shrink-0 mt-0.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2.5}
                        aria-hidden="true"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                );
              })
            ) : (
              <p className="py-4 text-center text-xs text-slate-500">
                {emptyMessage}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Mensaje de error o ayuda */}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="mt-1 text-xs font-medium text-red-600 flex items-center gap-1"
        >
          <svg className="h-3.5 w-3.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
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
};

export default SearchableSelect;
