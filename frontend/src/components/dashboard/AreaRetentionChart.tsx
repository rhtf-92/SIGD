import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Cell } from 'recharts';

// Interfaz para tipar los datos que recibirá el gráfico
interface AreaRetentionData {
  area: string;
  horasPromedio: number;
}

interface AreaRetentionChartProps {
  data: AreaRetentionData[];
}

export const AreaRetentionChart: React.FC<AreaRetentionChartProps> = ({ data }) => {
  // Función para pintar la barra de rojo si supera el límite de 48 horas
  const getBarColor = (horas: number) => {
    return horas > 48 ? '#ef4444' : '#3b82f6'; // Rojo (Crítico) o Azul (Normal)
  };

  return (
    <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
      <h3 className="text-lg font-semibold text-gray-800 mb-4">Retención Promedio de Expedientes por Área</h3>
      
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{ top: 20, right: 30, left: 20, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            
            {/* Ejes X e Y */}
            <XAxis 
              dataKey="area" 
              stroke="#6b7280" 
              fontSize={12} 
              angle={-45} 
              textAnchor="end" 
              interval={0}
            />
            <YAxis 
              stroke="#6b7280" 
              fontSize={12} 
              label={{ value: 'Horas', angle: -90, position: 'insideLeft', fill: '#6b7280' }} 
            />
            
            <Tooltip 
              cursor={{ fill: '#f3f4f6' }}
              contentStyle={{ borderRadius: '8px', border: '1px solid #e5e7eb', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
              formatter={(value: any) => [`${value} horas`, 'Retención Promedio']}
            />
            
            {/* Línea de límite crítico oficial de 48 horas */}
            <ReferenceLine 
              y={48} 
              stroke="#ef4444" 
              strokeDasharray="4 4" 
              label={{ position: 'top', value: 'Límite Crítico (48h)', fill: '#ef4444', fontSize: 12, fontWeight: 'bold' }} 
            />
            
            {/* Barras dinámicas */}
            <Bar dataKey="horasPromedio" radius={[4, 4, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.horasPromedio)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-6 text-sm text-gray-500 bg-red-50 p-2 rounded border border-red-100">
        <span className="font-semibold text-red-600">Alerta:</span> Las áreas marcadas en rojo superan el límite de retención permitido, generando posibles cuellos de botella.
      </div>
    </div>
  );
};