/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * MÓDULO 2: Registro Documentario - Mesa de Partes Virtual
 * TAREA: T-FE-MPV-14 / T-FE-MPV-15 — Asistente Wizard con Subvistas Modulares
 * ARCHIVO: src/components/tramite/TramiteWizard.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Orquestador principal del Asistente Wizard de Tramitación de 4 Pasos Canónicos.
 * Integra las 4 subvistas modulares y desacopladas (T-FE-MPV-15):
 * - StepIdentificacion
 * - StepDocumentos
 * - StepDeclaracionJurada
 * - StepConfirmacion
 *
 * Características:
 * - Gobernado íntegramente por la máquina de estados useTramiteWizardReducer.
 * - Persistencia defensiva sincronizada con sessionStorage (recuperación ante F5).
 * - Navegación canónica accesible (WCAG 2.1 AA) y validaciones en tiempo real.
 * - 100% TypeScript estricto (cero 'any', cumplimiento estricto PEN-06).
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback } from 'react';
import type {
  CargoDigitalResponse,
} from '../../types/tramiteWizardState';
import { CANONICAL_STEPS } from '../../types/tramiteWizardState';
import { useTramiteWizardReducer } from '../../hooks/useTramiteWizardReducer';
import CargoDigitalModal from './CargoDigitalModal';
import {
  StepIdentificacion,
  StepDocumentos,
  StepDeclaracionJurada,
  StepConfirmacion,
} from './WizardSteps';

export interface TramiteWizardProps {
  /** Callback opcional ejecutado al completar satisfactoriamente la radicación oficial */
  onSuccess?: (cargo: CargoDigitalResponse, cutGenerado: string) => void;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
}

export const TramiteWizard: React.FC<TramiteWizardProps> = ({
  onSuccess,
  className = '',
}) => {
  const {
    state,
    dispatch,
    setStep,
    nextStep,
    prevStep,
    setError,
    reset,
  } = useTramiteWizardReducer();

  const {
    currentStep,
    identificacion,
    documentos,
    declaracionJurada,
    cargoEmitido,
    isSubmitting,
    error,
  } = state;

  const [showCargoModal, setShowCargoModal] = useState(false);

  // Apertura automática del CargoDigitalModal al emitir satisfactoriamente el cargo
  useEffect(() => {
    if (cargoEmitido) {
      setShowCargoModal(true);
    }
  }, [cargoEmitido]);

  const handleResetWithConfirm = useCallback(() => {
    setShowCargoModal(false);
    if (cargoEmitido) {
      reset();
      return;
    }
    if (
      window.confirm(
        '¿Está seguro de reiniciar el asistente? Se borrarán los datos ingresados en este borrador.'
      )
    ) {
      reset();
    }
  }, [cargoEmitido, reset]);

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. BARRA STEPPER ACCESIBLE DE 4 PASOS CANÓNICOS */}
      <nav
        aria-label="Progreso del trámite"
        className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-6 shadow-xs"
      >
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-semibold text-slate-500">
              Mesa de Partes Virtual · IESTP &ldquo;Suiza&rdquo;
            </span>
          </div>

          {!cargoEmitido && (
            <div className="flex items-center gap-3">
              <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] text-slate-400 font-mono">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                Borrador persistido en navegador
              </span>
              <button
                type="button"
                onClick={handleResetWithConfirm}
                disabled={isSubmitting}
                className="text-xs font-semibold text-slate-400 hover:text-slate-700 hover:underline cursor-pointer disabled:opacity-40"
              >
                Reiniciar Borrador
              </button>
            </div>
          )}
        </div>

        <ol className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {CANONICAL_STEPS.map((stepMeta) => {
            const isCurrent = currentStep === stepMeta.step;
            const isCompleted = currentStep > stepMeta.step || cargoEmitido !== null;
            const isClickable = (currentStep > stepMeta.step && !cargoEmitido) || isCurrent;

            return (
              <li
                key={stepMeta.step}
                className="flex items-center gap-3 cursor-default"
              >
                <button
                  type="button"
                  disabled={!isClickable || isSubmitting}
                  onClick={() => setStep(stepMeta.step)}
                  className={`flex items-center gap-3 text-left transition ${
                    isClickable
                      ? 'cursor-pointer hover:opacity-80'
                      : 'cursor-not-allowed opacity-70'
                  }`}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-all shadow-xs ${
                      isCompleted
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-[#006EC7] text-white ring-4 ring-[#006EC7]/20'
                        : 'bg-slate-100 text-slate-500 border border-slate-200'
                    }`}
                  >
                    {isCompleted ? '✓' : stepMeta.step}
                  </span>
                  <div className="hidden sm:block">
                    <p
                      className={`text-xs font-bold leading-tight ${
                        isCurrent
                          ? 'text-[#006EC7]'
                          : isCompleted
                          ? 'text-slate-900'
                          : 'text-slate-500'
                      }`}
                    >
                      {stepMeta.shortTitle}
                    </p>
                    <p className="text-[10px] text-slate-400">Paso {stepMeta.step} de 4</p>
                  </div>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* 2. ALERTA DE ERROR GLOBAL SI EXISTE */}
      {error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-medium text-red-800 shadow-xs flex items-center justify-between"
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">⚠️ Error:</span>
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-red-700 hover:underline font-bold cursor-pointer ml-3"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* 3. CONTENEDOR MODULAR DE SUBVISTAS DESACOPLADAS (T-FE-MPV-15) */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        {currentStep === 1 && (
          <StepIdentificacion
            data={identificacion}
            dispatch={dispatch}
            onNext={nextStep}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === 2 && (
          <StepDocumentos
            data={documentos}
            dispatch={dispatch}
            onNext={nextStep}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === 3 && (
          <StepDeclaracionJurada
            data={declaracionJurada}
            dispatch={dispatch}
            onNext={nextStep}
            onBack={prevStep}
            isSubmitting={isSubmitting}
          />
        )}

        {currentStep === 4 && (
          <StepConfirmacion
            state={state}
            dispatch={dispatch}
            onBack={prevStep}
            onGoToStep={(step) => setStep(step)}
            onSuccess={onSuccess}
          />
        )}
      </div>

      {/* 4. MODAL INSTITUCIONAL DE CARGO DIGITAL (LPAG TUO LEY 27444) */}
      <CargoDigitalModal
        isOpen={showCargoModal && Boolean(cargoEmitido)}
        cargoData={cargoEmitido ?? undefined}
        onClose={() => setShowCargoModal(false)}
      />
    </div>
  );
};

export default TramiteWizard;
