/**
 * EtapasStepper — F_ADRIANO / ENT-M04-01 / T-FE-DOC-02.
 * Stepper visual de 5 etapas FSM con cronómetro de permanencia (días hábiles)
 * y estado visual: completado · en curso · pendiente · rechazado/observado.
 * Permite detectar cuellos de botella por carrera profesional.
 */
import type {
  EstadoTramite,
  EtapaWorkflowVisual,
} from "../../types/workflowAcademico";
import { ETIQUETA_ESTADO_TRAMITE } from "../../types/workflowAcademico";
import {
  clasificarPermanencia,
  diasHabilesEntre,
} from "../../utils/diasHabiles";

export interface EtapasStepperProps {
  etapas: EtapaWorkflowVisual[];
  estadoTramite: EstadoTramite;
  feriadosExtra?: string[];
}

export type EstadoVisualPaso =
  | "completado"
  | "en_curso"
  | "pendiente"
  | "rechazado";

export function mapearEstadoVisual(
  estadoEtapa: EtapaWorkflowVisual["estado"],
): EstadoVisualPaso {
  switch (estadoEtapa) {
    case "COMPLETADA":
      return "completado";
    case "EN_CURSO":
      return "en_curso";
    case "OBSERVADA":
      return "rechazado";
    case "BLOQUEADA":
    default:
      return "pendiente";
  }
}

const ESTILOS_PASO: Record<EstadoVisualPaso, string> = {
  completado: "border-emerald-500 bg-emerald-50",
  en_curso: "border-blue-500 bg-blue-50",
  pendiente: "border-dashed border-slate-300 bg-slate-50",
  rechazado: "border-red-400 bg-red-50",
};

const ESTILOS_PERMANENCIA: Record<string, string> = {
  EN_PLAZO: "border-emerald-200 bg-emerald-50 text-emerald-700",
  POR_VENCER: "border-amber-200 bg-amber-50 text-amber-700",
  VENCIDA: "border-red-200 bg-red-50 text-red-700",
};

const ETIQUETA_PERMANENCIA: Record<string, string> = {
  EN_PLAZO: "En plazo",
  POR_VENCER: "Por vencer",
  VENCIDA: "Vencida",
};

function IconoPaso({ estado }: { estado: EstadoVisualPaso }) {
  if (estado === "completado") {
    return (
      <svg className="h-5 w-5 text-emerald-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (estado === "rechazado") {
    return (
      <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (estado === "en_curso") {
    return <span className="text-sm font-bold text-blue-700" aria-hidden="true">●</span>;
  }
  return (
    <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function EtapasStepper({
  etapas,
  estadoTramite,
  feriadosExtra = [],
}: EtapasStepperProps) {
  return (
    <section
      aria-label={`Etapas del procedimiento (estado del trámite: ${ETIQUETA_ESTADO_TRAMITE[estadoTramite]})`}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">Workflow académico — 5 etapas</h2>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          PROC-ACA-01 · Expedientes Académicos
        </span>
      </div>

      <ol className="flex items-start gap-2 overflow-x-auto pb-2 lg:justify-between">
        {etapas.map((etapa, indice) => {
          const visual = mapearEstadoVisual(etapa.estado);
          const dias = diasHabilesEntre(etapa.fechaInicio, etapa.fechaFin, feriadosExtra);
          const semaforo = clasificarPermanencia(dias, etapa.plazoSlaDias);
          const conectado = indice < etapas.length - 1;
          const lineaActiva =
            conectado && (visual === "completado" || visual === "en_curso" || visual === "rechazado");

          return (
            <li
              key={etapa.idEtapa}
              className="flex min-w-[170px] flex-col items-center gap-2 text-center"
              aria-current={visual === "en_curso" ? "step" : undefined}
            >
              <div className="flex w-full items-center">
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 ${ESTILOS_PASO[visual]}`}
                  title={`Etapa ${indice + 1}: ${visual}`}
                >
                  {visual === "en_curso" ? (
                    <span className="text-sm font-bold text-blue-700">{indice + 1}</span>
                  ) : (
                    <IconoPaso estado={visual} />
                  )}
                </div>
                <div
                  className={`h-0.5 flex-1 ${lineaActiva ? "bg-emerald-400" : "bg-slate-200"}`}
                  aria-hidden="true"
                />
              </div>

              <div className="w-full">
                <p
                  className={`text-[0.65rem] font-bold uppercase tracking-wide ${
                    visual === "rechazado" ? "text-red-600" : "text-slate-400"
                  }`}
                >
                  {etapa.codigo}
                </p>
                <p className="text-sm font-bold leading-tight text-slate-800">
                  {etapa.nombreEtapa}
                </p>
                <p className="mt-0.5 text-xs leading-4 text-slate-500">{etapa.unidadOrganica}</p>
                <p
                  className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[0.7rem] font-bold ${ESTILOS_PERMANENCIA[semaforo]}`}
                  title={`Permanencia: ${dias} día(s) hábil(es) de ${etapa.plazoSlaDias} de SLA`}
                >
                  <span aria-hidden="true">◷</span>
                  {dias} d hábil(es) · {ETIQUETA_PERMANENCIA[semaforo]}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Completado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
          En curso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          Rechazado / observado
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" aria-hidden="true" />
          Pendiente
        </span>
      </div>
    </section>
  );
}
