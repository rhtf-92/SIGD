/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * SUBVISTA: Paso 3 — Declaración Jurada y Condiciones Legales
 * ARCHIVO: src/components/tramite/wizardSteps/Step3DeclaracionJurada.tsx
 * ==============================================================================
 */

import React from 'react';
import type { DeclaracionJuradaData } from '../../../types/tramiteWizardState';

interface Step3DeclaracionJuradaProps {
  data: DeclaracionJuradaData;
  onChange: (fields: Partial<DeclaracionJuradaData>) => void;
  disabled?: boolean;
}

export const Step3DeclaracionJurada: React.FC<Step3DeclaracionJuradaProps> = ({
  data,
  onChange,
  disabled = false,
}) => {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-4">
        <h3 className="text-lg font-bold text-slate-900">
          Paso 3: Declaración Jurada y Condiciones Legales
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Revise y confirme las declaraciones juradas exigidas por el marco normativo de la Ley del Procedimiento Administrativo General (Ley N° 27444).
        </p>
      </div>

      {/* Recuadro de Marco Legal Institucional */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4 text-xs text-blue-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-blue-800">
          <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Marco Normativo Aplicable (Art. 51 TUO Ley N° 27444)</span>
        </div>
        <p className="leading-relaxed">
          Todas las declaraciones juradas, testimonios y documentación adjuntada se presumen verificadas por el principio de presunción de veracidad. La presentación de documentos apócrifos o declaraciones falsas conlleva responsabilidad administrativa, civil y penal conforme al Código Penal del Perú.
        </p>
      </div>

      <div className="space-y-4 pt-2">
        {/* Checkbox 1: Declaración de Veracidad */}
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:border-[#006EC7]">
          <input
            id="declaracionVeracidad"
            name="declaracionVeracidad"
            type="checkbox"
            required
            checked={data.declaracionVeracidad}
            onChange={(e) => onChange({ declaracionVeracidad: e.target.checked })}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
          />
          <label
            htmlFor="declaracionVeracidad"
            className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
          >
            <strong className="font-bold text-slate-900 block mb-0.5">
              Declaración Jurada de Veracidad (Obligatorio) *
            </strong>
            Declaro bajo juramento que los datos ingresados y la documentación adjuntada son auténticos y veraces, sometiéndome al principio de fiscalización posterior y responsabilidades legales pertinentes.
          </label>
        </div>

        {/* Checkbox 2: Términos y Condiciones de la MPV */}
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:border-[#006EC7]">
          <input
            id="aceptaTerminos"
            name="aceptaTerminos"
            type="checkbox"
            required
            checked={data.aceptaTerminos}
            onChange={(e) => onChange({ aceptaTerminos: e.target.checked })}
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
          />
          <label
            htmlFor="aceptaTerminos"
            className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
          >
            <strong className="font-bold text-slate-900 block mb-0.5">
              Aceptación de Términos y Condiciones de Uso (Obligatorio) *
            </strong>
            Acepto las condiciones de operación de la Mesa de Partes Virtual del IESTP &ldquo;Suiza&rdquo;, incluyendo el cómputo de plazos conforme al horario hábil institucional y reglas de recepción documentaria.
          </label>
        </div>

        {/* Checkbox 3: Autorización de Notificación en Casilla Electrónica */}
        <div className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-xs transition hover:border-[#006EC7]">
          <input
            id="autorizaNotificacionCasilla"
            name="autorizaNotificacionCasilla"
            type="checkbox"
            checked={data.autorizaNotificacionCasilla}
            onChange={(e) =>
              onChange({ autorizaNotificacionCasilla: e.target.checked })
            }
            disabled={disabled}
            className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
          />
          <label
            htmlFor="autorizaNotificacionCasilla"
            className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
          >
            <strong className="font-bold text-slate-900 block mb-0.5">
              Autorización para Notificación Electrónica (Recomendado)
            </strong>
            Autorizo expresamente al IESTP &ldquo;Suiza&rdquo; a remitir todas las comunicaciones y actos administrativos derivados del presente expediente a mi Casilla Electrónica y correo notificado.
          </label>
        </div>
      </div>
    </div>
  );
};

export default Step3DeclaracionJurada;
