/**
 * @file KpiFormulaExplanationCard.tsx
 * @description Componente que explica de forma clara y accesible cómo se calcula cada KPI
 * @module components/reportes/KpiFormulaExplanationCard
 * @author Jennifer Gatica Saavedra
 * @version 1.0.0
 * @since 2026-09-10
 */

import React from 'react';
import type { KpiCalculationResult } from '../../types/kpiCalculations';

interface KpiFormulaExplanationCardProps {
  /** Resultado del cálculo del KPI a explicar */
  kpiResult: KpiCalculationResult;

  /** Valores utilizados para el cálculo (opcional, para mostrar detalles) */
  calculationDetails?: {
    label: string;
    value: string | number;
  }[];

  /** Callback cuando se hace clic en el card (opcional) */
  onClick?: () => void;

  /** Clase CSS adicional para personalización */
  className?: string;
}

/**
 * Retorna la fórmula matemática en formato legible para cada KPI
 */
function getFormulaDisplay(kpiId: string): {
  formula: string;
  description: string;
} {
  switch (kpiId) {
    case 'KPI-01':
      return {
        formula: 'VTEP = Σ(Resueltos) + Σ(Archivados) / Total Radicados × 100',
        description:
          'Proporción de expedientes procesados (resueltos o archivados) respecto al total radicado en el período.',
      };
    case 'KPI-02':
      return {
        formula: 'TPR = Σ(Horas Hábiles) / N',
        description:
          'Promedio de horas hábiles (excluyendo fines de semana y feriados) desde la recepción hasta la resolución.',
      };
    case 'KPI-03':
      return {
        formula: 'TRO = (Atendidos en Plazo / Total Resueltos) × 100',
        description:
          'Porcentaje de expedientes que fueron resueltos dentro del plazo normativo establecido.',
      };
    case 'KPI-04':
      return {
        formula: 'TEO = (Expedientes Observados / Total Radicados) × 100',
        description:
          'Porcentaje de expedientes que presentan observaciones o están en estado crítico.',
      };
    default:
      return { formula: 'No disponible', description: 'KPI desconocido' };
  }
}

/**
 * Obtiene el color de fondo basado en el estado del semáforo
 */
function getStatusColor(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'green':
      return 'bg-green-50 border-green-200';
    case 'yellow':
      return 'bg-yellow-50 border-yellow-200';
    case 'red':
      return 'bg-red-50 border-red-200';
    default:
      return 'bg-slate-50 border-slate-200';
  }
}

/**
 * Obtiene el color del texto/indicador basado en el estado
 */
function getStatusTextColor(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'green':
      return 'text-green-700';
    case 'yellow':
      return 'text-yellow-700';
    case 'red':
      return 'text-red-700';
    default:
      return 'text-slate-700';
  }
}

/**
 * Obtiene el icono de tendencia
 */
function getTrendIcon(trend: 'up' | 'down' | 'neutral'): string {
  switch (trend) {
    case 'up':
      return '↑';
    case 'down':
      return '↓';
    case 'neutral':
      return '→';
    default:
      return '';
  }
}

/**
 * Obtiene el etiqueta de estado en español
 */
function getStatusLabel(status: 'green' | 'yellow' | 'red'): string {
  switch (status) {
    case 'green':
      return 'En Meta (Verde)';
    case 'yellow':
      return 'Precaución (Ámbar)';
    case 'red':
      return 'Crítico (Rojo)';
    default:
      return 'Desconocido';
  }
}

/**
 * KpiFormulaExplanationCard
 *
 * Componente que muestra de forma clara y accesible:
 * - El nombre del indicador
 * - La fórmula utilizada
 * - Los valores utilizados (si se proporcionan)
 * - El resultado obtenido
 * - La unidad de medida
 * - Una explicación sencilla
 * - El estado del semáforo
 * - La tendencia respecto al período anterior
 */
export const KpiFormulaExplanationCard: React.FC<
  KpiFormulaExplanationCardProps
> = ({
  kpiResult,
  calculationDetails,
  onClick,
  className = '',
}) => {
  const formulaInfo = getFormulaDisplay(kpiResult.id);
  const statusColor = getStatusColor(kpiResult.status);
  const statusTextColor = getStatusTextColor(kpiResult.status);
  const statusLabel = getStatusLabel(kpiResult.status);
  const trendIcon = getTrendIcon(kpiResult.trend);

  return (
    <div
      className={`
        border-2 rounded-lg p-6 transition-all duration-300 ease-in-out
        hover:shadow-md cursor-pointer
        ${statusColor}
        ${className}
      `}
      onClick={onClick}
      role="region"
      aria-label={`Detalle de ${kpiResult.name}`}
    >
      {/* Encabezado: Título y Estado */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">
            {kpiResult.id}
          </h3>
          <h2 className="text-xl font-bold text-slate-900 mt-1">
            {kpiResult.name}
          </h2>
        </div>
        <div className={`text-2xl font-bold ${statusTextColor} ml-4`}>
          {kpiResult.value.toFixed(2)}
          <span className="text-sm ml-1">{kpiResult.unit}</span>
        </div>
      </div>

      {/* Indicador de Meta */}
      <div className="mb-4 p-3 bg-white rounded border border-slate-200">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-600">Meta Institucional</span>
          <span className="text-sm font-semibold text-slate-900">
            {kpiResult.target.toFixed(2)} {kpiResult.unit}
          </span>
        </div>
        {/* Barra de Progreso */}
        <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-300 ${
              kpiResult.status === 'green'
                ? 'bg-green-500'
                : kpiResult.status === 'yellow'
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            }`}
            style={{
              width: `${Math.min((kpiResult.value / kpiResult.target) * 100, 100)}%`,
            }}
            role="progressbar"
            aria-valuenow={Math.min(kpiResult.value, kpiResult.target)}
            aria-valuemin={0}
            aria-valuemax={kpiResult.target}
          />
        </div>
      </div>

      {/* Fórmula */}
      <div className="mb-4 p-4 bg-white rounded border border-slate-200 font-mono text-sm">
        <p className="text-xs font-semibold text-slate-600 mb-2">FÓRMULA MATEMÁTICA:</p>
        <p className="text-slate-800 break-words">{formulaInfo.formula}</p>
      </div>

      {/* Detalles de Cálculo (si están disponibles) */}
      {calculationDetails && calculationDetails.length > 0 && (
        <div className="mb-4 p-4 bg-white rounded border border-slate-200">
          <p className="text-xs font-semibold text-slate-600 mb-3">
            VALORES UTILIZADOS:
          </p>
          <div className="grid grid-cols-2 gap-3">
            {calculationDetails.map((detail, index) => (
              <div key={index} className="flex justify-between items-center">
                <span className="text-xs text-slate-600">{detail.label}</span>
                <span className="text-sm font-semibold text-slate-900">
                  {detail.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Descripción y Estado */}
      <div className="mb-4">
        <p className="text-sm text-slate-700 leading-relaxed">
          {formulaInfo.description}
        </p>
      </div>

      {/* Indicadores de Estado y Tendencia */}
      <div className="flex items-center justify-between pt-4 border-t border-slate-200">
        <div className="flex flex-col">
          <span className="text-xs font-medium text-slate-600">ESTADO:</span>
          <span className={`text-sm font-semibold ${statusTextColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Tendencia */}
        <div className="flex flex-col items-end">
          <span className="text-xs font-medium text-slate-600">
            TENDENCIA VS PERÍODO ANTERIOR:
          </span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xl">{trendIcon}</span>
            <span
              className={`text-sm font-bold ${
                kpiResult.deltaPercentage > 0
                  ? 'text-green-600'
                  : kpiResult.deltaPercentage < 0
                    ? 'text-red-600'
                    : 'text-slate-600'
              }`}
            >
              {kpiResult.deltaPercentage > 0 ? '+' : ''}
              {kpiResult.deltaPercentage.toFixed(2)}%
            </span>
          </div>
        </div>
      </div>

      {/* Descripción de Accesibilidad (aria-live para actualizaciones) */}
      <div
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {kpiResult.name}: {kpiResult.value.toFixed(2)} {kpiResult.unit}.
        {statusLabel}. Tendencia: {kpiResult.deltaPercentage > 0 ? 'aumentó' : kpiResult.deltaPercentage < 0 ? 'disminuyó' : 'sin cambios'} un {Math.abs(kpiResult.deltaPercentage).toFixed(2)}% respecto al período anterior.
      </div>
    </div>
  );
};

export default KpiFormulaExplanationCard;
