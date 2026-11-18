/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-15 — Subvista Modular 3: Declaración Jurada y Condiciones Legales
 * ARCHIVO: src/components/tramite/WizardSteps/StepDeclaracionJurada.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Subvista desacoplada para la aceptación de declaraciones juradas de veracidad
 * (Art. 51 del TUO de la Ley N° 27444 - LPAG) y autorización de notificación
 * a Casilla Electrónica institucional.
 *
 * Características:
 * - Validación reactiva de checks obligatorios con feedback visual de error en rojo.
 * - Advertencias de responsabilidad penal y fiscalización posterior administrativa.
 * - Accesibilidad WCAG 2.1 AA con estados visuales y aria-checked.
 * - Cero 'any', 100% tipado estricto con contratos de tramiteWizardState.ts.
 * ==============================================================================
 */

import React, { useId, useMemo, useState } from 'react';
import type {
  DeclaracionJuradaData,
  WizardAction,
} from '../../../types/tramiteWizardState';

export interface StepDeclaracionJuradaProps {
  /** Datos reactivos del paso de declaración jurada */
  data: DeclaracionJuradaData;
  /** Despachador de acciones atómicas hacia el reducer del wizard */
  dispatch: React.Dispatch<WizardAction>;
  /** Callback para avanzar al siguiente paso del asistente */
  onNext: () => void;
  /** Callback para retroceder al paso anterior */
  onBack: () => void;
  /** Indicador de procesamiento asíncrono o bloqueo de formulario */
  isSubmitting?: boolean;
}

export const StepDeclaracionJurada: React.FC<StepDeclaracionJuradaProps> = ({
  data,
  dispatch,
  onNext,
  onBack,
  isSubmitting = false,
}) => {
  const formId = useId();
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  // ===========================================================================
  // VALIDACIÓN REACTIVA EN TIEMPO REAL
  // ===========================================================================
  const errors = useMemo(() => {
    const errs: Record<string, string> = {};

    if (!data.declaracionVeracidad) {
      errs.declaracionVeracidad =
        'Debe aceptar la Declaración Jurada de Veracidad conforme al Art. 51 de la Ley N° 27444 para continuar.';
    }

    if (!data.aceptaTerminos) {
      errs.aceptaTerminos =
        'Debe aceptar los Términos y Condiciones de Uso de la Mesa de Partes Virtual.';
    }

    return errs;
  }, [data]);

  const isValid = Object.keys(errors).length === 0;

  const markTouched = (field: string) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const handleCheckboxChange = (
    field: keyof DeclaracionJuradaData,
    checked: boolean
  ) => {
    dispatch({
      type: 'UPDATE_DECLARACION',
      payload: { [field]: checked },
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setTouched({
      declaracionVeracidad: true,
      aceptaTerminos: true,
    });

    if (isValid && !isSubmitting) {
      onNext();
    }
  };

  return (
    <form
      id={`${formId}-form`}
      onSubmit={handleSubmit}
      noValidate
      className="space-y-6"
    >
      <header className="border-b border-slate-200 pb-4">
        <span className="text-xs font-bold uppercase tracking-wider text-[#006EC7]">
          Paso 3 de 4
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
          Declaración Jurada y Condiciones Legales
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Revise las declaraciones de veracidad y condiciones de notificación conforme al Texto Único Ordenado de la Ley N° 27444.
        </p>
      </header>

      {/* Recuadro de Advertencia Legal LPAG */}
      <div className="rounded-xl border border-blue-200 bg-blue-50/70 p-4.5 text-xs text-blue-900 space-y-2">
        <div className="flex items-center gap-2 font-bold text-blue-800 text-sm">
          <svg
            className="h-5 w-5 shrink-0 text-[#006EC7]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span>Principio de Presunción de Veracidad (Art. 51 TUO Ley N° 27444)</span>
        </div>
        <p className="leading-relaxed">
          En la tramitación de los procedimientos administrativos, se presume que los documentos y declaraciones formulados por los administrados responden a la verdad de los hechos que en ellos se afirman. La presentación fraudulenta acarrea la nulidad del acto administrativo y responsabilidad conforme a los artículos 411 y 427 del Código Penal.
        </p>
      </div>

      <div className="space-y-4 pt-1">
        {/* Checkbox 1: Declaración Jurada de Veracidad */}
        <div
          className={`rounded-xl border p-4.5 transition ${
            touched.declaracionVeracidad && errors.declaracionVeracidad
              ? 'border-red-300 bg-red-50/30'
              : 'border-slate-200 bg-white hover:border-[#006EC7]'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              id={`${formId}-declaracionVeracidad`}
              name="declaracionVeracidad"
              type="checkbox"
              required
              aria-required="true"
              aria-invalid={
                touched.declaracionVeracidad && Boolean(errors.declaracionVeracidad)
              }
              aria-describedby={
                touched.declaracionVeracidad && errors.declaracionVeracidad
                  ? `${formId}-declaracionVeracidad-error`
                  : undefined
              }
              checked={data.declaracionVeracidad}
              onChange={(e) => {
                handleCheckboxChange('declaracionVeracidad', e.target.checked);
                markTouched('declaracionVeracidad');
              }}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
            />
            <label
              htmlFor={`${formId}-declaracionVeracidad`}
              className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
            >
              <strong className="font-bold text-slate-900 block mb-0.5">
                Declaración Jurada de Veracidad (Art. 51 LPAG) <span className="text-red-600">*</span>
              </strong>
              Declaro bajo juramento que los datos personales consignados, los documentos adjuntos y las manifestaciones contenidas en la presente solicitud responden estrictamente a la verdad, sometiéndome al procedimiento de fiscalización posterior que determine la autoridad competente del IESTP &ldquo;Suiza&rdquo;.
            </label>
          </div>

          {touched.declaracionVeracidad && errors.declaracionVeracidad && (
            <p
              id={`${formId}-declaracionVeracidad-error`}
              role="alert"
              className="mt-2 text-xs text-red-600 font-medium pl-7"
            >
              ⚠️ {errors.declaracionVeracidad}
            </p>
          )}
        </div>

        {/* Checkbox 2: Términos y Condiciones */}
        <div
          className={`rounded-xl border p-4.5 transition ${
            touched.aceptaTerminos && errors.aceptaTerminos
              ? 'border-red-300 bg-red-50/30'
              : 'border-slate-200 bg-white hover:border-[#006EC7]'
          }`}
        >
          <div className="flex items-start gap-3">
            <input
              id={`${formId}-aceptaTerminos`}
              name="aceptaTerminos"
              type="checkbox"
              required
              aria-required="true"
              aria-invalid={
                touched.aceptaTerminos && Boolean(errors.aceptaTerminos)
              }
              aria-describedby={
                touched.aceptaTerminos && errors.aceptaTerminos
                  ? `${formId}-aceptaTerminos-error`
                  : undefined
              }
              checked={data.aceptaTerminos}
              onChange={(e) => {
                handleCheckboxChange('aceptaTerminos', e.target.checked);
                markTouched('aceptaTerminos');
              }}
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
            />
            <label
              htmlFor={`${formId}-aceptaTerminos`}
              className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
            >
              <strong className="font-bold text-slate-900 block mb-0.5">
                Aceptación de Términos y Condiciones de Uso <span className="text-red-600">*</span>
              </strong>
              Acepto las condiciones operativas de la Mesa de Partes Virtual, manifestando conocer el horario oficial de corte para la recepción de documentos (08:00 a 16:30 horas en días hábiles) y las directivas de trámite institucional vigentes.
            </label>
          </div>

          {touched.aceptaTerminos && errors.aceptaTerminos && (
            <p
              id={`${formId}-aceptaTerminos-error`}
              role="alert"
              className="mt-2 text-xs text-red-600 font-medium pl-7"
            >
              ⚠️ {errors.aceptaTerminos}
            </p>
          )}
        </div>

        {/* Checkbox 3: Notificación en Casilla Electrónica */}
        <div className="rounded-xl border border-slate-200 bg-white p-4.5 hover:border-[#006EC7] transition">
          <div className="flex items-start gap-3">
            <input
              id={`${formId}-autorizaNotificacionCasilla`}
              name="autorizaNotificacionCasilla"
              type="checkbox"
              checked={data.autorizaNotificacionCasilla}
              onChange={(e) =>
                handleCheckboxChange('autorizaNotificacionCasilla', e.target.checked)
              }
              disabled={isSubmitting}
              className="mt-1 h-4 w-4 rounded border-slate-300 text-[#006EC7] focus:ring-[#006EC7] cursor-pointer"
            />
            <label
              htmlFor={`${formId}-autorizaNotificacionCasilla`}
              className="text-xs sm:text-sm text-slate-700 cursor-pointer select-none leading-relaxed"
            >
              <strong className="font-bold text-slate-900 block mb-0.5">
                Autorización Expresa para Notificación por Casilla Electrónica{' '}
                <span className="text-emerald-700 font-normal">(Recomendado)</span>
              </strong>
              Autorizo de forma expresa y voluntaria al IESTP &ldquo;Suiza&rdquo; a notificar válidamente las resoluciones, proveídos y actos administrativos vinculados al presente trámite a través del buzón de mi Casilla Electrónica Institucional y correo electrónico consignado.
            </label>
          </div>
        </div>
      </div>

      {/* BOTONERA DE NAVEGACIÓN ACCESIBLE */}
      <footer className="mt-8 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onBack}
          disabled={isSubmitting}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-xs font-bold text-slate-700 shadow-xs transition hover:bg-slate-50 cursor-pointer"
        >
          ← Anterior
        </button>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-lg px-6 py-2.5 text-xs font-bold text-white shadow-xs transition ${
            isValid && !isSubmitting
              ? 'bg-[#006EC7] hover:bg-[#005ba3] cursor-pointer'
              : 'bg-slate-300 text-slate-500 cursor-not-allowed'
          }`}
        >
          Siguiente →
        </button>
      </footer>
    </form>
  );
};

export default StepDeclaracionJurada;
