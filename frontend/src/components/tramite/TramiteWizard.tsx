/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLES:
 * - ENT-M02-01: Asistente Stepper Wizard MPV en 4 Pasos Canónicos (5 SP)
 * - ENT-M02-06: Cargo Digital con Generación Atómica de CUT y Código QR (3 SP)
 * TAREAS: T-FE-MPV-14, T-FE-MPV-15, T-FE-MPV-16
 * ARCHIVO: src/components/tramite/TramiteWizard.tsx
 * ==============================================================================
 * DESCRIPCIÓN:
 * Orquestador principal del Asistente Wizard de Tramitación de 4 Pasos.
 * Diseño institucional moderno:
 * - Barra superior del Stepper en azul marino oscuro (#05224a) con ícono y PASO X DE 4 dinámico.
 * - Indicador de progreso con círculos conectados por línea resaltando el paso activo en azul brillante (#1877f2).
 * - Contenedor blanco con bordes redondeados (rounded-2xl) y sombra limpia.
 * - Mantiene 100% íntegra la máquina de estados reactiva de useTramiteWizardReducer.
 * ==============================================================================
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTramiteWizardReducer } from "../../hooks/useTramiteWizardReducer";
import {
  StepIdentificacion,
  StepDocumentos,
  StepDeclaracionJurada,
  StepConfirmacion,
} from "./WizardSteps";
import CargoDigitalModal from "./CargoDigitalModal";
import type {
  WizardStep,
  CargoDigitalResponse,
} from "../../types/tramiteWizardState";

export interface TramiteWizardProps {
  /** Callback opcional ejecutado al completar satisfactoriamente la radicación oficial */
  onSuccess?: (cargo: CargoDigitalResponse, cutGenerado: string) => void;
  /** Clases CSS adicionales para el contenedor principal */
  className?: string;
  /** Datos iniciales opcionales */
  initialData?: unknown;
  /** Fechas inhábiles opcionales */
  holidays?: readonly string[];
}

export const TramiteWizard: React.FC<TramiteWizardProps> = ({
  onSuccess,
  className = "",
}) => {
  const { state, dispatch } = useTramiteWizardReducer();
  const [modalAbierto, setModalAbierto] = useState(false);

  // Apertura automática del modal institucional de cargo cuando se asienta el trámite
  useEffect(() => {
    if (state.cargoEmitido) {
      setModalAbierto(true);
    }
  }, [state.cargoEmitido]);

  const handleNext = useCallback(() => {
    if (state.currentStep < 4) {
      dispatch({
        type: "SET_STEP",
        payload: (state.currentStep + 1) as WizardStep,
      });
    }
  }, [state.currentStep, dispatch]);

  const handleBack = useCallback(() => {
    if (state.currentStep > 1) {
      dispatch({
        type: "SET_STEP",
        payload: (state.currentStep - 1) as WizardStep,
      });
    }
  }, [state.currentStep, dispatch]);

  const handleGoToStep = useCallback(
    (step: WizardStep) => {
      dispatch({ type: "SET_STEP", payload: step });
    },
    [dispatch],
  );

  const handleSuccess = useCallback(
    (cargo: CargoDigitalResponse, cut: string) => {
      setModalAbierto(true);
      if (onSuccess) {
        onSuccess(cargo, cut);
      }
    },
    [onSuccess],
  );

  return (
    <div className={`space-y-6 ${className}`}>
      {/* 1. TARJETA PRINCIPAL DEL FORMULARIO CON ENCABEZADO DEL STEPPER */}
      <div className="rounded-2xl border border-slate-200/90 bg-white shadow-sm overflow-hidden">
        {/* Encabezado del Stepper: Barra superior azul marino oscuro (#05224a) */}
        <div className="bg-[#05224a] px-6 sm:px-8 py-4 sm:py-5 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-sky-950">
          {/* Izquierda: Ícono de documento y texto dinámico PASO X DE 4 */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center text-sky-400 shrink-0 border border-white/10 shadow-inner">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-widest text-sky-300 block">
                ASISTENTE OFICIAL
              </span>
              <span className="text-sm sm:text-base font-extrabold text-white tracking-wide">
                PASO {state.currentStep} DE 4
              </span>
            </div>
          </div>

          {/* Derecha: Indicador visual de progreso con círculos numerados conectados por una línea */}
          <div className="flex items-center gap-2 sm:gap-3">
            {[1, 2, 3, 4].map((stepNumber, index) => {
              const isActive = state.currentStep === stepNumber;
              const isCompleted = state.currentStep > stepNumber;
              return (
                <React.Fragment key={stepNumber}>
                  {index > 0 && (
                    <div
                      className={`h-0.5 w-6 sm:w-10 transition-colors duration-300 ${
                        isCompleted ? "bg-[#1877f2]" : "bg-sky-950"
                      }`}
                    />
                  )}
                  <div className="flex items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (isCompleted) {
                          handleGoToStep(stepNumber as WizardStep);
                        }
                      }}
                      disabled={!isCompleted}
                      aria-current={isActive ? "step" : undefined}
                      className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-200 ${
                        isActive
                          ? "bg-[#1877f2] text-white ring-4 ring-[#1877f2]/30 shadow-md font-black scale-110 cursor-default"
                          : isCompleted
                          ? "bg-[#0a3a78] text-sky-200 border border-sky-400/40 cursor-pointer hover:bg-[#0c448d]"
                          : "bg-[#0b2b56] text-sky-400/50 border border-white/5 cursor-not-allowed"
                      }`}
                      title={
                        stepNumber === 1
                          ? "Identificación del Solicitante"
                          : stepNumber === 2
                          ? "Documentos del Trámite"
                          : stepNumber === 3
                          ? "Declaración Jurada"
                          : "Confirmación y Radicación"
                      }
                    >
                      {isCompleted ? (
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        stepNumber
                      )}
                    </button>
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* CUERPO DEL ASISTENTE */}
        <div className="p-6 sm:p-8 md:p-10">
          {state.currentStep === 1 && (
            <StepIdentificacion
              data={state.identificacion}
              dispatch={dispatch}
              onNext={handleNext}
              onBack={handleBack}
              isSubmitting={state.isSubmitting}
            />
          )}

          {state.currentStep === 2 && (
            <StepDocumentos
              data={state.documentos}
              dispatch={dispatch}
              onNext={handleNext}
              onBack={handleBack}
              isSubmitting={state.isSubmitting}
            />
          )}

          {state.currentStep === 3 && (
            <StepDeclaracionJurada
              data={state.declaracionJurada}
              dispatch={dispatch}
              onNext={handleNext}
              onBack={handleBack}
              isSubmitting={state.isSubmitting}
            />
          )}

          {state.currentStep === 4 && (
            <StepConfirmacion
              state={state}
              dispatch={dispatch}
              onBack={handleBack}
              onGoToStep={handleGoToStep}
              onSuccess={handleSuccess}
            />
          )}
        </div>
      </div>

      {/* 2. MODAL FORMAL DE CARGO DIGITAL CONMEMORATIVO Y PROBATORIO */}
      {state.cargoEmitido && (
        <CargoDigitalModal
          isOpen={modalAbierto}
          onClose={() => setModalAbierto(false)}
          cargo={state.cargoEmitido}
        />
      )}
    </div>
  );
};

export default TramiteWizard;
