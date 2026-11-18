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
 * Arquitectura basada en useTramiteWizardReducer y subvistas modulares:
 * - Paso 1: StepIdentificacion (DNI, CE, RUC, contacto y validación en tiempo real).
 * - Paso 2: StepDocumentos (Catálogo TUPA, asunto, folios y carga probatoria PDF con SHA-256).
 * - Paso 3: StepDeclaracionJurada (Veracidad Art. 51 LPAG y aceptación de términos).
 * - Paso 4: StepConfirmacion (Consolidado integral, radicación formal y CargoDigitalModal).
 * 100% TypeScript estricto (cero 'any').
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
      {/* 1. RENDERIZADO MODULAR SEGÚN EL PASO ACTIVO */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
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
