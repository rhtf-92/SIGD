/**
 * ============================================================================
 * PROYECTO: SIGD - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual (MPV 24x7)
 * ENTREGABLE: Vista pública de radicación ciudadana
 * ARCHIVO: src/pages/MesaPartesVirtualPage.tsx
 * ============================================================================
 */

import React from 'react';
import { TramiteWizard } from '../features/tramites/TramiteWizard';

export const MesaPartesVirtualPage: React.FC = () => {
  return (
    <main className="min-h-screen bg-slate-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Cabecera Institucional */}
        <header className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <span className="inline-block bg-sky-100 text-sky-800 text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
                Atención 24×7 · TUO Ley 27444
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                Mesa de Partes Virtual
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                IESTP «Suiza» · Sistema Integral de Gestión Documentaria
              </p>
            </div>
            <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
              <p className="font-semibold text-slate-700">Horario de Corte Hábil:</p>
              <p>Lunes a Viernes: 08:00 a 16:30 hrs</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Envíos posteriores computan al día hábil siguiente.</p>
            </div>
          </div>
        </header>

        {/* Contenedor del Asistente Wizard (Entregable Principal) */}
        <section aria-label="Formulario de Trámite Documentario">
          <TramiteWizard />
        </section>
      </div>
    </main>
  );
};

export default MesaPartesVirtualPage;