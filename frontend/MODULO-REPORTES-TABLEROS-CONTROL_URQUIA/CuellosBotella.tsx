import React from 'react';

export const CuellosBotella = () => {
  const alertas = [
    { id: 1, proceso: 'Validación de Documentos', tiempo: '45 mins', estado: 'Crítico' },
    { id: 2, proceso: 'Generación de Reportes PDF', tiempo: '30 mins', estado: 'Advertencia' },
    { id: 3, proceso: 'Sincronización con Base de Datos', tiempo: '15 mins', estado: 'Normal' },
  ];

  return (
    <div className="bg-white p-4 rounded-xl shadow border border-gray-100 mt-6">
      <h3 className="text-lg font-bold text-gray-800 mb-3">Análisis de Cuellos de Botella</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b text-gray-500 text-sm">
              <th className="py-2 px-3">Proceso / Módulo</th>
              <th className="py-2 px-3">Tiempo Promedio</th>
              <th className="py-2 px-3">Estado</th>
            </tr>
          </thead>
          <tbody>
            {alertas.map((item) => (
              <tr key={item.id} className="border-b hover:bg-gray-50 text-sm">
                <td className="py-2 px-3 font-medium text-gray-700">{item.proceso}</td>
                <td className="py-2 px-3 text-gray-600">{item.tiempo}</td>
                <td className="py-2 px-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                    item.estado === 'Crítico' ? 'bg-red-100 text-red-600' :
                    item.estado === 'Advertencia' ? 'bg-yellow-100 text-yellow-600' :
                    'bg-green-100 text-green-600'
                  }`}>
                    {item.estado}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CuellosBotella;