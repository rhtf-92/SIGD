/**
 * ==============================================================================
 * PROYECTO: SIGD (Sistema Integral de Gestión Documentaria) - IESTP "Suiza"
 * ENTREGABLE: ENT-M02-01 — Asistente Wizard de Tramitación de 4 Pasos
 * ARCHIVO: src/components/tramite/WizardStepBar.tsx
 * AUTORA: Anllely Melgarejo V. (F_ANLLELY)
 * REVISIÓN: Patricia Marina (R)
 * 
 * DESCRIPCIÓN:
 * Componente visual accesible (WCAG 2.1 AA) de barra de progreso secuencial.
 * Proyecta los 4 pasos del trámite documentario con indicadores de estado
 * (completado, activo, pendiente), soporte completo para lectores de pantalla
 * (aria-current, roles, sr-only) y navegación por teclado con foco visible.
 * ==============================================================================
 */

import React from "react";
import {
  type WizardStepId,
  type WizardStepBarProps,
  type StepStatus,
  WIZARD_STEPS,
} from "../../types/tramiteWizard";

/**
 * Icono de verificación para pasos completados satisfactoriamente.
 */
function CheckIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2.5}
      aria-hidden="true"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  );
}

/**
 * Componente principal WizardStepBar.
 */
export const WizardStepBar: React.FC<WizardStepBarProps> = ({
  currentStep,
  completedSteps = [],
  maxStepReached = currentStep,
  isInteractive = false,
  onStepClick,
  className = "",
  ariaLabel = "Progreso de tramitación documentaria en 4 pasos",
}) => {
  /**
   * Determina el estado de un paso: completado, activo o pendiente.
   */
  const getStepStatus = (stepId: WizardStepId): StepStatus => {
    if (stepId === currentStep) {
      return "active";
    }
    if (completedSteps.includes(stepId) || stepId < currentStep) {
      return "completed";
    }
    return "pending";
  };

  /**
   * Determina si un paso específico es clickeable por el usuario.
   */
  const isStepClickable = (stepId: WizardStepId): boolean => {
    if (!isInteractive || !onStepClick) return false;
    // Se puede hacer clic si es menor o igual al paso máximo alcanzado o si ya está completado
    return stepId <= maxStepReached || completedSteps.includes(stepId);
  };

  const handleStepClick = (stepId: WizardStepId) => {
    if (isStepClickable(stepId) && onStepClick) {
      onStepClick(stepId);
    }
  };

  // Cálculo del porcentaje para la barra de progreso accesible
  const progressPercent = Math.round(((currentStep - 1) / (WIZARD_STEPS.length - 1)) * 100);

  return (
    <nav
      aria-label={ariaLabel}
      className={`w-full bg-white rounded-xl shadow-xs border border-slate-200/80 p-4 sm:p-6 ${className}`}
    >
      {/* Barra de progreso complementaria para lectores de pantalla y soporte móvil */}
      <div className="mb-4 sm:hidden">
        <div className="flex items-center justify-between text-xs font-semibold text-slate-600 mb-1.5">
          <span>
            Paso <strong className="text-[#006EC7]">{currentStep}</strong> de {WIZARD_STEPS.length}:{" "}
            {WIZARD_STEPS[currentStep - 1]?.shortTitle}
          </span>
          <span className="text-slate-500 font-medium">{progressPercent}%</span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={currentStep}
          aria-valuemin={1}
          aria-valuemax={4}
          aria-label={`Progreso del trámite: Paso ${currentStep} de 4`}
          className="h-2 w-full bg-slate-100 rounded-full overflow-hidden"
        >
          <div
            className="h-full bg-[#006EC7] transition-all duration-300 ease-out"
            style={{ width: `${((currentStep) / 4) * 100}%` }}
          />
        </div>
      </div>

      {/* Lista ordenada semántica de los 4 pasos (WCAG 2.1 AA) */}
      <ol role="list" className="flex items-center justify-between w-full">
        {WIZARD_STEPS.map((step, index) => {
          const status = getStepStatus(step.id);
          const clickable = isStepClickable(step.id);
          const isLast = index === WIZARD_STEPS.length - 1;

          // Etiqueta legible exclusiva para tecnologías de asistencia
          const statusReadable =
            status === "completed"
              ? "Completado"
              : status === "active"
              ? "Paso actual"
              : "Pendiente de completar";

          return (
            <li
              key={step.id}
              className={`relative flex-1 ${!isLast ? "pr-4 sm:pr-8" : ""}`}
            >
              <div className="flex items-center">
                {/* Conector o botón interactivo del paso */}
                <div className="relative flex items-center justify-center">
                  {clickable ? (
                    <button
                      type="button"
                      onClick={() => handleStepClick(step.id)}
                      aria-current={status === "active" ? "step" : undefined}
                      aria-label={`Ir al Paso ${step.id}: ${step.title} (${statusReadable})`}
                      className={`group flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full transition-all duration-200 cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#006EC7] focus:ring-offset-2 ${
                        status === "completed"
                          ? "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
                          : status === "active"
                          ? "bg-[#006EC7] text-white ring-4 ring-blue-100 shadow-md"
                          : "bg-slate-100 text-slate-500 border border-slate-300 hover:bg-slate-200"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      ) : (
                        <span className="text-sm sm:text-base font-bold">
                          {step.id}
                        </span>
                      )}
                    </button>
                  ) : (
                    <div
                      aria-current={status === "active" ? "step" : undefined}
                      aria-disabled={status === "pending" ? true : undefined}
                      className={`flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full select-none transition-all duration-200 ${
                        status === "completed"
                          ? "bg-emerald-600 text-white shadow-sm"
                          : status === "active"
                          ? "bg-[#006EC7] text-white ring-4 ring-blue-100 shadow-md"
                          : "bg-slate-100 text-slate-400 border border-slate-200"
                      }`}
                    >
                      {status === "completed" ? (
                        <CheckIcon className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      ) : (
                        <span className="text-sm sm:text-base font-bold">
                          {step.id}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Texto accesible invisible en pantalla pero perceptible por lectores */}
                  <span className="sr-only">
                    {`Paso ${step.id} de 4: ${step.title} — ${statusReadable}`}
                  </span>
                </div>

                {/* Línea conectora visual entre pasos */}
                {!isLast && (
                  <div
                    aria-hidden="true"
                    className="flex-1 ml-2 sm:ml-4 mr-2 sm:mr-4 h-1 rounded-full bg-slate-200 overflow-hidden"
                  >
                    <div
                      className={`h-full transition-all duration-500 ease-out ${
                        status === "completed" ? "bg-emerald-500 w-full" : "w-0"
                      }`}
                    />
                  </div>
                )}
              </div>

              {/* Títulos y descripción para pantallas medianas y grandes */}
              <div className="mt-2.5 hidden sm:block">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`text-xs font-bold uppercase tracking-wider ${
                      status === "active"
                        ? "text-[#006EC7]"
                        : status === "completed"
                        ? "text-emerald-700"
                        : "text-slate-600"
                    }`}
                  >
                    Paso {step.id}
                  </span>
                  {status === "completed" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                      Listo
                    </span>
                  )}
                  {status === "active" && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-100 text-[#006EC7]">
                      En curso
                    </span>
                  )}
                </div>

                <p
                  className={`text-sm font-semibold truncate ${
                    status === "active"
                      ? "text-slate-900 font-bold"
                      : status === "completed"
                      ? "text-slate-800"
                      : "text-slate-600"
                  }`}
                  title={step.title}
                >
                  {step.title}
                </p>

                <p className="text-xs text-slate-600 line-clamp-1 mt-0.5 hidden md:block">
                  {step.description}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

export default WizardStepBar;
