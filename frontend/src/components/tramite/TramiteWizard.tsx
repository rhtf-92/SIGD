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
import { useInRouterContext, useNavigate } from "react-router-dom";
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

/** Botón 'Volver al inicio' adaptativo con navegación SPA o enlace seguro */
function BotonVolverInicio() {
  const inRouter = useInRouterContext();
  if (inRouter) {
    return <BotonVolverInicioRouter />;
  }
  return <BotonVolverInicioFallback />;
}

function BotonVolverInicioRouter() {
  const navigate = useNavigate();
  return (
    <button
      type="button"
      onClick={() => navigate("/")}
      className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#0073E6] bg-slate-50 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-200 transition-all shadow-2xs cursor-pointer select-none"
      title="Regresar a la portada principal"
      aria-label="Volver al inicio"
    >
      <svg
        className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#0073E6] transition-transform group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Volver al inicio</span>
    </button>
  );
}

function BotonVolverInicioFallback() {
  return (
    <a
      href="/"
      className="group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-slate-600 hover:text-[#0073E6] bg-slate-50 hover:bg-blue-50/80 border border-slate-200/80 hover:border-blue-200 transition-all shadow-2xs cursor-pointer select-none"
      title="Regresar a la portada principal"
      aria-label="Volver al inicio"
    >
      <svg
        className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#0073E6] transition-transform group-hover:-translate-x-0.5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
      </svg>
      <span>Volver al inicio</span>
    </a>
  );
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
    <div className={`w-full ${className}`}>
      {/* DISTRIBUCIÓN EN 2 COLUMNAS: PANEL LATERAL IZQUIERDO Y TARJETA PRINCIPAL */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] xl:grid-cols-[320px_1fr] gap-6 lg:gap-8 items-start">
        {/* PANEL LATERAL IZQUIERDO */}
        <div className="space-y-6">
          <aside className="rounded-2xl border border-sky-100 bg-white/95 p-6 shadow-[0_8px_30px_rgba(2,30,80,0.08)] backdrop-blur-sm space-y-6">
            {/* Encabezado del panel: Fila superior con 'ATENCIÓN DIGITAL' + Botón 'Volver al inicio' en la esquina */}
            <div className="border-b border-slate-100 pb-4">
              <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#0073E6]">
                  ATENCIÓN DIGITAL
                </span>
                <BotonVolverInicio />
              </div>

              <div className="flex items-center gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#0073E6] text-white shadow-md shadow-blue-500/25">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14 16l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-black text-[#082F7C] tracking-tight leading-tight">
                    Mesa de Partes
                  </h2>
                </div>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed font-normal">
              Presente sus solicitudes y trámites oficiales en línea con plena validez legal conforme al TUO de la Ley N° 27444.
            </p>

            {/* Guía de pasos verticales */}
            <div className="space-y-3 pt-1">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                PASOS DEL TRÁMITE
              </p>
              <nav aria-label="Progreso vertical del trámite" className="relative space-y-2">
                <div className="absolute left-3.5 top-3 bottom-3 w-0.5 bg-slate-200 -z-0" />

                {[
                  { num: 1, title: "Identificación del Solicitante" },
                  { num: 2, title: "Documentos del Trámite" },
                  { num: 3, title: "Declaración Jurada" },
                  { num: 4, title: "Confirmación y Radicación" },
                ].map((step) => {
                  const isActive = state.currentStep === step.num;
                  const isCompleted = state.currentStep > step.num;
                  return (
                    <div
                      key={step.num}
                      onClick={() => {
                        if (isCompleted) {
                          handleGoToStep(step.num as WizardStep);
                        }
                      }}
                      className={`relative z-10 flex items-center gap-3 rounded-xl p-2 transition ${
                        isActive
                          ? "bg-blue-50/80 border border-blue-200/80 shadow-2xs"
                          : isCompleted
                          ? "cursor-pointer hover:bg-slate-50"
                          : "opacity-60 cursor-not-allowed"
                      }`}
                    >
                      <div
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                          isActive
                            ? "bg-[#0073E6] text-white ring-4 ring-blue-100 shadow-sm font-black"
                            : isCompleted
                            ? "bg-emerald-500 text-white"
                            : "bg-slate-200 text-slate-500"
                        }`}
                      >
                        {isCompleted ? (
                          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          step.num
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className={`text-xs font-bold leading-tight ${isActive ? "text-[#082F7C]" : isCompleted ? "text-slate-800" : "text-slate-500"}`}>
                          {step.title}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </nav>
            </div>

            {/* Enlace inferior de ayuda */}
            <div className="border-t border-slate-100 pt-4">
              <a
                href="mailto:mesadepartes@iestpsuiza.edu.pe"
                className="inline-flex items-center gap-2 text-xs font-semibold text-[#0073E6] hover:text-[#005bb5] transition hover:underline"
              >
                <svg className="w-4 h-4 text-[#0073E6] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>¿Necesitas ayuda? Contáctanos</span>
              </a>
            </div>
          </aside>

          {/* Tarjeta Recuerda: Pautas para la presentación y validación documental (Exclusivo para el Paso 2) */}
          {state.currentStep === 2 && (
            <aside className="rounded-2xl border border-sky-200/80 bg-white/95 p-6 shadow-[0_8px_30px_rgba(2,30,80,0.08)] backdrop-blur-sm space-y-4 animate-fadeIn">
              {/* Ícono superior */}
              <div className="w-10 h-10 rounded-xl bg-blue-50 border border-blue-200/80 flex items-center justify-center text-[#1877f2] shadow-2xs">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>

              {/* Título Recuerda */}
              <div>
                <h3 className="text-base font-extrabold text-[#062856]">
                  Recuerda
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Pautas para la presentación y validación documental
                </p>
              </div>

              {/* Los tres puntos clave con check azul */}
              <ul className="space-y-3 pt-1 text-xs text-slate-600 leading-relaxed">
                <li className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#1877f2] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>El archivo debe estar en formato <strong className="text-slate-800">PDF</strong>.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#1877f2] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Tamaño máximo: <strong className="text-slate-800">20 MB</strong> por archivo.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#1877f2] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Asegúrate de que los documentos estén <strong className="text-slate-800">legibles y completos</strong>.</span>
                </li>
              </ul>

              {/* Pie de apoyo informativo sobre seguridad y LPAG */}
              <div className="pt-3 border-t border-sky-100/80 text-[11px] text-slate-500 space-y-1.5">
                <p className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                  <span>Integridad certificada con hash SHA-256</span>
                </p>
                <p className="text-[10px] text-slate-400">
                  Horario de atención: 08:00 a 16:30 h (Ley N° 27444).
                </p>
              </div>
            </aside>
          )}
        </div>

        {/* COLUMNA DERECHA: TARJETA PRINCIPAL DEL FORMULARIO */}
        <div className="min-w-0">
          {/* Indicador accesible (sr-only) del paso actual para lectores de pantalla y verificación WCAG */}
          <span className="sr-only">Paso {state.currentStep} de 4</span>

          {/* CUERPO DEL ASISTENTE */}
          <div className="transition-all duration-300">
            {state.currentStep === 1 && (
              <div className="rounded-2xl border border-sky-100 bg-white p-6 sm:p-8 md:p-10 shadow-[0_16px_40px_-8px_rgba(2,30,80,0.09),0_4px_16px_-2px_rgba(2,30,80,0.04)] ring-1 ring-slate-900/5 transition-all duration-300">
                <StepIdentificacion
                  data={state.identificacion}
                  dispatch={dispatch}
                  onNext={handleNext}
                  onBack={handleBack}
                  isSubmitting={state.isSubmitting}
                />
              </div>
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
              <div className="rounded-2xl border border-sky-100 bg-white p-6 sm:p-8 md:p-10 shadow-[0_16px_40px_-8px_rgba(2,30,80,0.09),0_4px_16px_-2px_rgba(2,30,80,0.04)] ring-1 ring-slate-900/5 transition-all duration-300">
                <StepDeclaracionJurada
                  data={state.declaracionJurada}
                  dispatch={dispatch}
                  onNext={handleNext}
                  onBack={handleBack}
                  isSubmitting={state.isSubmitting}
                />
              </div>
            )}

            {state.currentStep === 4 && (
              <div className="rounded-2xl border border-sky-100 bg-white p-6 sm:p-8 md:p-10 shadow-[0_16px_40px_-8px_rgba(2,30,80,0.09),0_4px_16px_-2px_rgba(2,30,80,0.04)] ring-1 ring-slate-900/5 transition-all duration-300">
                <StepConfirmacion
                  state={state}
                  dispatch={dispatch}
                  onBack={handleBack}
                  onGoToStep={handleGoToStep}
                  onSuccess={handleSuccess}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3. MODAL FORMAL DE CARGO DIGITAL CONMEMORATIVO Y PROBATORIO */}
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
