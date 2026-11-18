/**
 * ENT-M01-02: Componente UI Accesible de Selector en Cascada de Ubigeo Nacional
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
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
  initialDepartamentoId,
  initialProvinciaId,
  initialDistritoId,
  onChange,
  label = 'Ubicación Territorial (Perú)',
  className = '',
  disabled = false,
  showCodeBadge = true,
}) => {
  const {
    departamentos,
    departamentoSeleccionado,
    provinciaSeleccionada,
    distritoSeleccionado,
    provinciasDisponibles,
    distritosDisponibles,
    ubigeoCod,
    seleccionarDepartamento,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  } = useUbigeoCascade({
    initialDepartamentoId,
    initialProvinciaId,
    initialDistritoId,
    onChange,
  });

  return (
    <div className={`w-full p-6 bg-white rounded-xl border border-gray-200 shadow-md ${className}`}>
      {/* Encabezado del Componente */}
      <div className="flex items-center justify-between mb-4 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
          <h3 className="text-base font-semibold text-gray-800">{label}</h3>
        </div>

        {showCodeBadge && ubigeoCod && (
          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-mono font-medium bg-blue-50 text-blue-700 border border-blue-200">
            INEI: {ubigeoCod}
          </span>
        )}
      </div>

      {/* Grid de 3 Selectores Encadenados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Selector 1: Región / Departamento */}
        <div>
          <label htmlFor="ubigeo-departamento" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
            Región / Departamento <span className="text-red-500">*</span>
          </label>
          <select
            id="ubigeo-departamento"
            disabled={disabled}
            value={departamentoSeleccionado?.id || ''}
            onChange={(e) => seleccionarDepartamento(e.target.value)}
            aria-label="Seleccionar Región o Departamento"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed shadow-sm truncate"
          >
            <option value="">-- Seleccione Región --</option>
            {departamentos.map((d) => (
              <option key={d.id} value={d.id}>
                {d.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Selector 2: Provincia (Sin candado, texto limpio) */}
        <div>
          <label htmlFor="ubigeo-provincia" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
            Provincia <span className="text-red-500">*</span>
          </label>
          <select
            id="ubigeo-provincia"
            disabled={disabled || !departamentoSeleccionado}
            value={provinciaSeleccionada?.id || ''}
            onChange={(e) => seleccionarProvincia(e.target.value)}
            aria-label="Seleccionar Provincia"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm truncate"
          >
            <option value="">
              {departamentoSeleccionado ? '-- Seleccione Provincia --' : '-- Elija Región primero --'}
            </option>
            {provinciasDisponibles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Selector 3: Distrito (Sin candado, texto limpio) */}
        <div>
          <label htmlFor="ubigeo-distrito" className="block text-xs font-semibold text-gray-700 mb-1.5 uppercase tracking-wider">
            Distrito <span className="text-red-500">*</span>
          </label>
          <select
            id="ubigeo-distrito"
            disabled={disabled || !provinciaSeleccionada}
            value={distritoSeleccionado?.id || ''}
            onChange={(e) => seleccionarDistrito(e.target.value)}
            aria-label="Seleccionar Distrito"
            className="w-full px-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed shadow-sm truncate"
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

      {/* Botón de Limpieza */}
      {(departamentoSeleccionado || provinciaSeleccionada || distritoSeleccionado) && (
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={limpiarSeleccion}
            disabled={disabled}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 hover:bg-red-50 hover:text-red-600 rounded-md border border-gray-200 transition-colors"
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