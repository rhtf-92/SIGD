import type {
  EstadoTramite,
  EtapaWorkflowVisual,
} from "../../types/workflowAcademico";
import { ETIQUETA_ESTADO_TRAMITE } from "../../types/workflowAcademico";

interface AcademicWorkflowStepperProps {
  etapas: EtapaWorkflowVisual[];
  estadoTramite: EstadoTramite;
}

function IconoVerificado() {
  return (
    <svg
      className="h-5 w-5 text-emerald-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoAdvertencia() {
  return (
    <svg
      className="h-5 w-5 text-red-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoCandado() {
  return (
    <svg
      className="h-5 w-5 text-slate-400"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 1a4.5 4.5 0 0 0-4.5 4.5V9H5a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2h-.5V5.5A4.5 4.5 0 0 0 10 1Zm3 8V5.5a3 3 0 1 0-6 0V9h6Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function AcademicWorkflowStepper({
  etapas,
  estadoTramite,
}: AcademicWorkflowStepperProps) {
  return (
    <section
      aria-label={`Etapas del procedimiento (estado del trámite: ${ETIQUETA_ESTADO_TRAMITE[estadoTramite]})`}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold">Workflow académico — 5 etapas</h2>
        <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-bold text-blue-700">
          PROC-ACA-01 · Titulación Profesional Técnica
        </span>
      </div>

      <ol className="flex items-start gap-2 overflow-x-auto pb-2 lg:justify-between">
        {etapas.map((etapa, indice) => {
          const conectado = indice < etapas.length - 1;
          const siguiente = etapas[indice + 1];
          const lineaActiva =
            conectado &&
            (siguiente.estado === "COMPLETADA" ||
              siguiente.estado === "EN_CURSO" ||
              siguiente.estado === "OBSERVADA");

          return (
            <li
              key={etapa.idEtapa}
              className="flex min-w-[150px] flex-col items-center gap-2 text-center"
            >
              <div className="flex w-full items-center">
                <div
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-2 ${
                    etapa.estado === "COMPLETADA"
                      ? "border-emerald-500 bg-emerald-50"
                      : etapa.estado === "EN_CURSO"
                        ? "border-blue-500 bg-blue-50"
                        : etapa.estado === "OBSERVADA"
                          ? "border-red-400 bg-red-50"
                          : "border-dashed border-slate-300 bg-slate-50"
                  }`}
                >
                  {etapa.estado === "COMPLETADA" ? (
                    <IconoVerificado />
                  ) : etapa.estado === "EN_CURSO" ? (
                    <span className="text-sm font-bold text-blue-700">
                      {indice + 1}
                    </span>
                  ) : etapa.estado === "OBSERVADA" ? (
                    <IconoAdvertencia />
                  ) : (
                    <IconoCandado />
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
                    etapa.estado === "OBSERVADA" ? "text-red-600" : "text-slate-400"
                  }`}
                >
                  {etapa.codigo}
                </p>
                <p className="text-sm font-bold leading-tight text-slate-800">
                  {etapa.nombreEtapa}
                </p>
                <p className="mt-0.5 text-xs leading-4 text-slate-500">
                  {etapa.unidadOrganica}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
          Completada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" aria-hidden="true" />
          En curso
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-red-500" aria-hidden="true" />
          Observada
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border border-dashed border-slate-400" aria-hidden="true" />
          Bloqueada
        </span>
      </div>
    </section>
  );
}