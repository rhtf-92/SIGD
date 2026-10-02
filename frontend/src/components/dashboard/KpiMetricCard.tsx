import React from 'react';

interface KpiMetricCardProps {
  title: string;
  value: number;
  target: number;
  unit?: string;
  isLowerBetter?: boolean; // true para TPR y TEO, false para VTEP y TRO
}

export const KpiMetricCard: React.FC<KpiMetricCardProps> = ({
  title,
  value,
  target,
  unit = '%',
  isLowerBetter = false
}) => {
  // Lógica para determinar el estado según las normativas del MGD
  let status = 'Por Mejorar';
  let progressPercent = 0;

  if (isLowerBetter) {
    // Lógica para indicadores donde "menor es mejor" (Ej: TEO <= 5, TPR <= 24)
    if (value <= target) status = 'Cumplido';
    else if (value <= target * 1.5) status = 'Por Mejorar';
    else status = 'Crítico';
    
    // Cálculo invertido para la barra de progreso
    progressPercent = value === 0 ? 100 : Math.max(0, 100 - ((value - target) / target) * 100);
  } else {
    // Lógica para indicadores donde "mayor es mejor" (Ej: VTEP >= 95, TRO >= 90)
    if (value >= target) status = 'Cumplido';
    else if (value >= target * 0.8) status = 'Por Mejorar';
    else status = 'Crítico';
    
    progressPercent = Math.min((value / target) * 100, 100);
  }

  // Estilos de Tailwind CSS según el estado
  const getStatusColors = () => {
    switch (status) {
      case 'Cumplido': return 'bg-green-100 text-green-800 border-green-200';
      case 'Crítico': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    }
  };

  const getProgressBarColors = () => {
    switch (status) {
      case 'Cumplido': return 'bg-green-500';
      case 'Crítico': return 'bg-red-500';
      default: return 'bg-yellow-500';
    }
  };

  return (
    <div className="p-4 bg-white rounded-lg shadow border border-gray-200">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-sm font-semibold text-gray-700">{title}</h3>
        <span className={`text-xs px-2 py-1 rounded-full border font-medium ${getStatusColors()}`}>
          {status}
        </span>
      </div>
      
      <div className="my-3">
        <span className="text-2xl font-bold text-gray-900">
          {value}{unit}
        </span>
        <span className="text-sm text-gray-500 ml-2">
          / Meta: {target}{unit}
        </span>
      </div>

      {/* Barra de progreso visual */}
      <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
        <div 
          className={`h-2 rounded-full ${getProgressBarColors()} transition-all duration-500`} 
          style={{ width: `${progressPercent}%` }}
        ></div>
      </div>
    </div>
  );
};