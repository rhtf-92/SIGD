import { Check, AlertCircle } from "lucide-react";

export type StepStatus = "completed" | "current" | "pending" | "error";

export interface ProcessStep {
  id: string;
  title: string;
  description?: string;
  status: StepStatus;
}

export interface ProcessStepperProps {
  steps: ProcessStep[];
  orientation?: "horizontal" | "vertical";
  className?: string;
}

export function ProcessStepper({
  steps,
  orientation = "horizontal",
  className = "",
}: ProcessStepperProps) {
  if (orientation === "vertical") {
    return (
      <div className={`space-y-4 ${className}`} aria-label="Progreso del proceso">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          return (
            <div key={step.id} className="relative flex items-start gap-3">
              {/* Línea conectora */}
              {!isLast && (
                <div
                  className={`absolute left-3.5 top-8 -bottom-4 w-0.5 ${
                    step.status === "completed" ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                  aria-hidden="true"
                />
              )}

              {/* Indicador de estado */}
              <div
                className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                  step.status === "completed"
                    ? "bg-emerald-600 text-white"
                    : step.status === "current"
                    ? "bg-suiza-primary text-white ring-4 ring-suiza-primary/20"
                    : step.status === "error"
                    ? "bg-red-600 text-white"
                    : "bg-slate-100 text-slate-500 border border-slate-300"
                }`}
                aria-current={step.status === "current" ? "step" : undefined}
              >
                {step.status === "completed" ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : step.status === "error" ? (
                  <AlertCircle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <span>{idx + 1}</span>
                )}
              </div>

              {/* Texto */}
              <div className="min-w-0 pt-0.5">
                <p
                  className={`text-xs font-bold leading-tight ${
                    step.status === "current"
                      ? "text-suiza-primary"
                      : step.status === "error"
                      ? "text-red-700"
                      : "text-slate-800"
                  }`}
                >
                  {step.title}
                </p>
                {step.description && (
                  <p className="mt-0.5 text-[11px] text-slate-500 leading-snug">
                    {step.description}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  // Horizontal (default)
  return (
    <nav aria-label="Progreso del proceso" className={`w-full ${className}`}>
      <ol className="flex items-center justify-between gap-2 overflow-x-auto py-2">
        {steps.map((step, idx) => {
          const isLast = idx === steps.length - 1;

          return (
            <li
              key={step.id}
              className="flex items-center flex-1 min-w-[120px] last:flex-none"
            >
              <div className="flex items-center gap-2.5">
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition ${
                    step.status === "completed"
                      ? "bg-emerald-600 text-white"
                      : step.status === "current"
                      ? "bg-suiza-primary text-white ring-4 ring-suiza-primary/20 shadow-2xs"
                      : step.status === "error"
                      ? "bg-red-600 text-white"
                      : "bg-slate-100 text-slate-500 border border-slate-300"
                  }`}
                  aria-current={step.status === "current" ? "step" : undefined}
                >
                  {step.status === "completed" ? (
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : step.status === "error" ? (
                    <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : (
                    <span>{idx + 1}</span>
                  )}
                </div>

                <div className="min-w-0 pr-2">
                  <p
                    className={`text-xs font-bold truncate leading-tight ${
                      step.status === "current"
                        ? "text-suiza-primary"
                        : step.status === "error"
                        ? "text-red-700"
                        : "text-slate-800"
                    }`}
                  >
                    {step.title}
                  </p>
                  {step.description && (
                    <p className="text-[10px] text-slate-400 truncate leading-tight">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>

              {!isLast && (
                <div
                  className={`h-0.5 flex-1 mx-2 ${
                    step.status === "completed" ? "bg-emerald-500" : "bg-slate-200"
                  }`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export default ProcessStepper;
