import React from 'react';

export const Graficos = () => {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 my-6">
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Rendimiento Mensual del Sistema</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
          [ Espacio para Gráfico de Líneas / Barras ]
        </div>
      </div>
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 mb-3">Distribución de Solicitudes</h3>
        <div className="h-64 flex items-center justify-center bg-gray-50 rounded-lg border border-dashed border-gray-300 text-gray-400 text-sm">
          [ Espacio para Gráfico Circular / Pastel ]
        </div>
      </div>
    </div>
  );
};

export default Graficos;