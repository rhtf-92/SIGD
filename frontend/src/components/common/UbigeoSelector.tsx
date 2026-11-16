/**
 * ENT-M01-02 / M01-UBIGEO: Componente UI Accesible de Selector en Cascada de Ubigeo Nacional
 * Sistema Integral de Gestión Documentaria (SIGD) - IESTP "Suiza"
 * 
 * Cumplimiento WCAG 2.1 AA, 25 Departamentos, 196 Provincias y 1,893 Distritos del Perú.
 * Conectado en tiempo real a PostgreSQL como única fuente de verdad con manejo de loading y errores.
 */

import React, { useState, useMemo } from 'react';
import { MapPin, RefreshCw, Search, Loader2, AlertCircle } from 'lucide-react';
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
  soloUcayali = true,
  onChange,
  label,
  className = '',
  disabled = false,
  showCodeBadge = true,
}) => {
  const {
    departamento,
    departamentos,
    provinciaSeleccionada,
    distritoSeleccionado,
    provincias,
    distritosDisponibles,
    ubigeoCod,
    cargando,
    error,
    seleccionarDepartamento,
    seleccionarProvincia,
    seleccionarDistrito,
    limpiarSeleccion,
  } = useUbigeoCascade({
    initialDepartamentoId,
    initialProvinciaId,
    initialDistritoId,
    soloUcayali,
    onChange,
  });

  const [filtroDistrito, setFiltroDistrito] = useState<string>('');

  const distritosFiltrados = useMemo(() => {
    if (!filtroDistrito.trim()) return distritosDisponibles;
    const q = filtroDistrito.toLowerCase().trim();
    return distritosDisponibles.filter((d) => d.nombre.toLowerCase().includes(q));
  }, [distritosDisponibles, filtroDistrito]);

  const tituloLabel = label || (soloUcayali ? 'Ubicación Territorial (Ucayali)' : 'Ubicación Territorial (Departamento / Provincia / Distrito)');

  return (
    <div className={`w-full p-4 bg-white rounded-lg border border-gray-200 shadow-sm ${className}`}>
      {/* Encabezado del Componente */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-blue-600" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-gray-800">{tituloLabel}</h3>
          {cargando && (
            <span className="inline-flex items-center gap-1 text-xs text-blue-600 font-medium">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              <span>Cargando catálogo...</span>
            </span>
          )}
        </div>

        {/* Badge con el Código INEI Resultante de 6 dígitos */}
        {showCodeBadge && (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-mono font-medium bg-blue-100 text-blue-800">
            INEI: {ubigeoCod}
          </span>
        )}
      </div>

      {/* Alerta de Error si falla la conexión */}
      {error && (
        <div
          role="alert"
          className="mb-3 p-2.5 bg-red-50 border border-red-200 text-red-700 rounded-md text-xs flex items-center gap-2"
        >
          <AlertCircle className="w-4 h-4 flex-shrink-0 text-red-600" />
          <div className="flex-1">
            <span className="font-semibold">Incidencia de red o servicio:</span> {error}
          </div>
        </div>
      )}

      {/* Grid de Selectores Encadenados */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Selector 1: Departamento */}
        <div>
          <label htmlFor="ubigeo-departamento" className="block text-xs font-medium text-gray-600 mb-1">
            Departamento <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            {soloUcayali ? (
              <select
                id="ubigeo-departamento"
                disabled
                value={departamento?.id || '25'}
                aria-label="Departamento seleccionado"
                className="w-full pl-3 pr-8 py-2 text-sm bg-gray-100 border border-gray-300 rounded-md text-gray-700 cursor-not-allowed appearance-none"
              >
                <option value="25">UCAYALI</option>
              </select>
            ) : (
              <select
                id="ubigeo-departamento"
                disabled={disabled || cargando}
                value={departamento?.id || ''}
                onChange={(e) => {
                  setFiltroDistrito('');
                  seleccionarDepartamento(e.target.value);
                }}
                aria-label="Seleccionar Departamento"
                className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="">-- Seleccione Departamento --</option>
                {departamentos.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.nombre}
                  </option>
                ))}
              </select>
            )}
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
              disabled={disabled || cargando || (!soloUcayali && !departamentoIdActual(departamento, soloUcayali))}
              value={provinciaSeleccionada?.id || ''}
              onChange={(e) => {
                setFiltroDistrito('');
                seleccionarProvincia(e.target.value);
              }}
              aria-label={soloUcayali ? 'Seleccionar Provincia de Ucayali' : 'Seleccionar Provincia de Ucayali o Nacional'}
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!soloUcayali && !departamento
                  ? '-- Elija Departamento primero --'
                  : cargando
                    ? '-- Cargando Provincias... --'
                    : '-- Seleccione Provincia --'}
              </option>
              {provincias.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Selector 3: Distrito */}
        <div>
          <label htmlFor="ubigeo-distrito" className="block text-xs font-medium text-gray-600 mb-1">
            Distrito <span className="text-red-500">*</span>
          </label>
          <div className="relative">
            <select
              id="ubigeo-distrito"
              disabled={disabled || cargando || !provinciaSeleccionada}
              value={distritoSeleccionado?.id || ''}
              onChange={(e) => seleccionarDistrito(e.target.value)}
              aria-label="Seleccionar Distrito"
              className="w-full pl-3 pr-8 py-2 text-sm bg-white border border-gray-300 rounded-md text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
            >
              <option value="">
                {!provinciaSeleccionada
                  ? '-- Elija Provincia primero --'
                  : cargando
                    ? '-- Cargando Distritos... --'
                    : '-- Seleccione Distrito --'}
              </option>
              {distritosFiltrados.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.nombre}
                </option>
              ))}
            </select>
          </div>

          {/* Búsqueda rápida si la provincia tiene más de 8 distritos */}
          {provinciaSeleccionada && distritosDisponibles.length > 8 && (
            <div className="relative mt-1.5">
              <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2 top-2" />
              <input
                type="text"
                placeholder="Filtrar distritos..."
                value={filtroDistrito}
                onChange={(e) => setFiltroDistrito(e.target.value)}
                className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          )}
        </div>
      </div>

      {/* Botón de Limpieza de Selección */}
      {(soloUcayali ? (provinciaSeleccionada || distritoSeleccionado) : (departamento || provinciaSeleccionada || distritoSeleccionado)) && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={() => {
              setFiltroDistrito('');
              limpiarSeleccion();
            }}
            disabled={disabled || cargando}
            className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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

function departamentoIdActual(departamento: { id: string } | null, soloUcayali: boolean): boolean {
  if (soloUcayali) return true;
  return Boolean(departamento && departamento.id);
}
