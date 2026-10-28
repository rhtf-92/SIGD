/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ARCHIVO: src/components/tramite/TupaCatalogEstados.tsx
 * ==============================================================================
 * Componentes reutilizables de estado para el catálogo TUPA (cargando, vacío y
 * error). Se comparten entre el asistente (/tramite) y la ventanilla para evitar
 * duplicar la visualización de estados.
 * ==============================================================================
 */

import React from 'react';

import type { ErrorCatalogoTupa } from '../../hooks/useProcedimientosTupa';

export const TupaCatalogoCargando: React.FC = () => (
  <p
    role="status"
    aria-live="polite"
    className="mt-1.5 flex items-center gap-2 text-xs font-medium text-slate-500"
  >
    <svg className="h-3.5 w-3.5 animate-spin text-[#006EC7]" fill="none" viewBox="0 0 24 24" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
    Cargando catálogo oficial de procedimientos TUPA…
  </p>
);

export const TupaCatalogoVacio: React.FC = () => (
  <p
    role="status"
    aria-live="polite"
    className="mt-1.5 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800"
  >
    El catálogo TUPA no tiene procedimientos aprobados disponibles por el momento.
  </p>
);

export interface TupaCatalogoErrorProps {
  error: ErrorCatalogoTupa;
  onRetry: () => void;
}

export const TupaCatalogoError: React.FC<TupaCatalogoErrorProps> = ({ error, onRetry }) => (
  <div
    role="alert"
    aria-live="assertive"
    className="mt-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-800"
  >
    <p>{error.mensaje}</p>
    <button
      type="button"
      onClick={onRetry}
      className="mt-1.5 inline-flex items-center gap-1 rounded border border-red-300 bg-white px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-100 cursor-pointer"
    >
      Reintentar
    </button>
  </div>
);
