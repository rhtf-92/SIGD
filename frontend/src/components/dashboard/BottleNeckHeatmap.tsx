import React from 'react';

interface HeatmapData {
  area: string;
  tramite: string;
  horas: number;
}

interface BottleNeckHeatmapProps {
  data: HeatmapData[];
}

export const BottleNeckHeatmap: React.FC<BottleNeckHeatmapProps> = ({ data }) => {
  // Función para determinar el color de la celda según el tiempo de retención
  const getCellColor = (horas: number) => {
    if (horas <= 24) return 'bg-green-100 text-green-800'; // Óptimo
    if (horas <= 48) return 'bg-yellow-100 text-yellow-800'; // Riesgo medio (Límite)
    if (horas <= 72) return 'bg-orange-200 text-orange-900'; // Cuello de botella
    return 'bg-red-500 text-white font-bold'; // Crítico
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200 mt-4">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Mapa de Calor: Cuellos de Botella por Área</h3>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm text-left">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50">
            <tr>
              <th className="px-6 py-3">Unidad Orgánica (Área)</th>
              <th className="px-6 py-3">Tipo de Trámite</th>
              <th className="px-6 py-3 text-center">Horas Retenidas</th>
              <th className="px-6 py-3 text-center">Estado MGD</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr key={index} className="border-b hover:bg-gray-50">
                <td className="px-6 py-4 font-medium text-gray-900">{row.area}</td>
                <td className="px-6 py-4">{row.tramite}</td>
                <td className={`px-6 py-4 text-center ${getCellColor(row.horas)} transition-colors`}>
                  {row.horas} hrs
                </td>
                <td className="px-6 py-4 text-center font-semibold">
                  {row.horas > 48 ? (
                    <span className="text-red-600">Supera Límite</span>
                  ) : (
                    <span className="text-green-600">Conforme</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};