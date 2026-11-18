/**
 * ENT-M01-02: Componente UI Accesible de Selector en Cascada de Ubigeo
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Componente visual con cumplimiento WCAG 2.1 AA, iconos dinámicos y Tailwind CSS.
 * 
 * @author Ángel Jesús Vásquez Godoy (F_JESUS)
 * @role Especialista de Integración (Ubigeo y SIAGIE) - Sub-equipo Grupo 2
 * @version 1.0.0
 */

import React from 'react';
import { MapPin, RefreshCw } from 'lucide-react';
import { useUbigeoCascade } from '../../hooks/useUbigeoCascade';
import type { UseUbigeoCascadeOptions } from '../../hooks/useUbigeoCascade';

export interface UbigeoSelectorProps extends UseUbigeoCascadeOptions {
  label?: string;
  className?: string;
  disabled?: boolean;
  showCodeBadge?: boolean;
}

export const UbigeoSelector: React.FC<UbigeoSelectorProps> = ({
  initialProvinciaId,
  initialDistritoId,
  onChange,
  label = 'Ubicación Territorial (Ucayali)',
  className = '',
  disabled = false,
  showCodeBadge = true,
}) => {
  const {
    departamento,
    provinciaSeleccionada,
    distritoSeleccionado,
    provincias,
    distritosDisponibles,
    ubigeoCod,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  } = useUbigeoCascade({
    initialProvinciaId,
    initialDistritoId,
    onChange,
  });

  return (
    <div className={`w-full p-4 bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Encabezado del Componente */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-800">{label}</h3>
        </div>

        {/* Badge con el Código INEI Resultante de 6 dígitos */}
        {showCodeBadge && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-100 text-blue-800">
            INEI: {ubigeoCod}
          </span>
        )}
      </div>

      {/* Grid de Selectores Encadenados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Selector 1: Departamento (Fijo: Ucayali - Código 25) */}
        <div>
          <label htmlFor="ubigeo-departamento" className="block text-xs font-medium text-gray-600 mb-1">
            Departamento
          </label>
          <div className="relative">
            <select
              id="ubigeo-departamento"
              disabled
              value={departamento.id}
              aria-label="Departamento seleccionado"
              className="w-full pl-3 pr-8 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md text-gray-700 cursor-not-allowed appearance-none"
            >
              <option value={departamento.id}>{departamento.nombre}</option>
            </select>
          </div>
        </div>

        {/* Selector 2: Provincia */}
        <div>
          <label htmlFor="ubigeo-provincia" className="block text-xs font-medium text-gray-600 mb-1">
            Provincia <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ubigeo-provincia"
              disabled={disabled}
              value={provinciaSeleccionada?.id || ''}
              onChange={(e) => seleccionarProvincia(e.target.value)}
              aria-label="Seleccionar Provincia de Ucayali"
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">-- Seleccione Provincia --</option>
              {provincias.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selector 3: Distrito (Dependiente de Provincia) */}
        <div>
          <label htmlFor="ubigeo-distrito" className="block text-xs font-medium text-gray-600 mb-1">
            Distrito <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ubigeo-distrito"
              disabled={disabled || !provinciaSeleccionada}
              value={distritoSeleccionado?.id || ''}
              onChange={(e) => seleccionarDistrito(e.target.value)}
              aria-label="Seleccionar Distrito"
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {provinciaSeleccionada ? '-- Seleccione Distrito --' : '-- Elija Provincia primero --'}
              </option>
              {distritosDisponibles.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Botón de Limpieza de Selección */}
      {(provinciaSeleccionada || distritoSeleccionado) && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={limpiarSeleccion}
            disabled={disabled}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
            aria-label="Restablecer selección de Ubigeo"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Limpiar Selección
          </button>
        </div>
      )}
    </div>
  );
};