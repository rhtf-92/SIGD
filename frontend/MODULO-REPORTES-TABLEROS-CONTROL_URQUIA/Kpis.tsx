import React from 'react';

export const Kpis = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
        <h3 className="text-gray-500 text-sm font-medium">Total de Registros</h3>
        <p className="text-2xl font-bold text-gray-800 mt-1">1,245</p>
      </div>
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
        <h3 className="text-gray-500 text-sm font-medium">Procesos Activos</h3>
        <p className="text-2xl font-bold text-blue-600 mt-1">320</p>
      </div>
      <div className="bg-white p-4 rounded-xl shadow border border-gray-100">
        <h3 className="text-gray-500 text-sm font-medium">Eficiencia del Sistema</h3>
        <p className="text-2xl font-bold text-green-600 mt-1">94.2%</p>
      </div>
    </div>
  );
};

export default Kpis;