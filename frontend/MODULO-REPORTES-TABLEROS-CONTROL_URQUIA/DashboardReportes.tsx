import React from 'react';
import { Kpis } from './Kpis';
import { CuellosBotella } from './CuellosBotella';
import { Graficos } from './Graficos';

export const DashboardReportes = () => {
  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableros de Control y Reportes</h1>
        <p className="text-sm text-gray-500">Módulo de monitoreo y análisis del sistema</p>
      </div>
      
      <Kpis />
      <Graficos />
      <CuellosBotella />
    </div>
  );
};

export default DashboardReportes;