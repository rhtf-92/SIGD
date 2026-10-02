import type { EtapaWorkflowVisual } from "../../types/workflowAcademico";

interface StageDetailCardProps {
  etapa: EtapaWorkflowVisual;
  indice: number;
  esActual: boolean;
}

const ESTILOS_ESTADO_ETAPA: Record<
  EtapaWorkflowVisual["estado"],
  { insignia: string; borde: string; texto: string }
> = {
  COMPLETADA: {
    insignia:
      "bg-emerald-50 text-emerald-700 border border-emerald-200",
    borde: "border-emerald-300",
    texto: "Completada",
  },
  EN_CURSO: {
    insignia: "bg-blue-50 text-blue-700 border border-blue-200",
    borde: "border-blue-400",
    texto: "En curso",
  },
  BLOQUEADA: {
    insignia: "bg-slate-100 text-slate-500 border border-slate-200",
    borde: "border-slate-200",
    texto: "Bloqueada",
  },
  OBSERVADA: {
    insignia: "bg-red-50 text-red-700 border border-red-200",
    borde: "border-red-300",
    texto: "Observada",
  },
};

function IconoCheque() {
  return (
    <svg
      className="h-4 w-4 text-emerald-600"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16Zm3.857-9.809a.75.75 0 0 0-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 1 0-1.06 1.061l2.5 2.5a.75.75 0 0 0 1.137-.089l4-5.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function IconoX() {
  return (
    <svg
      className="h-4 w-4 text-red-500"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden="true"
    >
      <path
        fillRule="evenodd"
        d="M10 18a8 8 0 1 0 0-16 8 8 0 0 0 0 16ZM8.28 7.22a.75.75 0 0 0-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 1 0 1.06 1.06L10 11.06l1.72 1.72a.75.75 0 1 0 1.06-1.06L11.06 10l1.72-1.72a.75.75 0 0 0-1.06-1.06L10 8.94 8.28 7.22Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function formatoFecha(fecha?: string): string | null {
  if (!fecha) return null;
  const fechaLocal = new Date(fecha);
  if (Number.isNaN(fechaLocal.getTime())) return null;
  return new Intl.DateTimeFormat("es-PE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Lima",
  }).format(fechaLocal);
}

export default function StageDetailCard({
  etapa,
  indice,
  esActual,
}: StageDetailCardProps) {
  const estilo = ESTILOS_ESTADO_ETAPA[etapa.estado];

  return (
    <article
      className={`rounded-xl border bg-white shadow-sm ${esActual ? "ring-2 ring-blue-200" : ""} ${estilo.borde}`}
    >
      <header className="flex items-start justify-between gap-3 border-b border-slate-100 p-5">
        <div className="flex items-center gap-3">
          <span
            className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold ${
              etapa.estado === "COMPLETADA"
                ? "bg-emerald-100 text-emerald-700"
                : etapa.estado === "EN_CURSO"
                  ? "bg-blue-100 text-blue-700"
                  : etapa.estado === "OBSERVADA"
                    ? "bg-red-100 text-red-700"
                    : "bg-slate-100 text-slate-500"
            }`}
            aria-hidden="true"
          >
            {indice + 1}
          </span>
          <div>
            <p className="text-[0.65rem] font-bold uppercase tracking-wide text-slate-400">
              {etapa.codigo} · SLA {etapa.plazoSlaDias} días hábiles
            </p>
            <h3 className="text-sm font-bold text-slate-900">
              {etapa.nombreEtapa}
            </h3>
            <p className="text-xs text-slate-500">{etapa.unidadOrganica}</p>
          </div>
        </div>

        <span className={`rounded-full px-2.5 py-1 text-[0.65rem] font-bold ${estilo.insignia}`}>
          {estilo.texto}
        </span>
      </header>

      <div className="p-5">
        <p className="text-sm leading-6 text-slate-600">{etapa.descripcion}</p>

        <ul className="mt-4 space-y-2.5">
          {etapa.requisitos.map((requisito) => (
            <li key={requisito.idRequisito} className="flex items-start gap-2.5">
              <span className="mt-0.5 shrink-0">
                {requisito.cumplido ? <IconoCheque /> : <IconoX />}
              </span>
              <div>
                <p
                  className={`text-sm ${requisito.cumplido ? "text-slate-700" : "text-slate-500"}`}
                >
                  {requisito.descripcion}
                </p>
                {requisito.fechaCumplimiento && (
                  <p className="text-xs text-slate-400">
                    Cumplido el {formatoFecha(requisito.fechaCumplimiento)}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>

        {etapa.observacion && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          >
            <p className="font-bold">Observación de la etapa</p>
            <p className="mt-1">{etapa.observacion}</p>
          </div>
        )}

        {(etapa.fechaInicio || etapa.fechaFin) && (
          <footer className="mt-4 flex flex-wrap gap-x-5 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
            {etapa.fechaInicio && (
              <span>
                Inicio: <strong>{formatoFecha(etapa.fechaInicio)}</strong>
              </span>
            )}
            {etapa.fechaFin && (
              <span>
                Fin: <strong>{formatoFecha(etapa.fechaFin)}</strong>
              </span>
            )}
          </footer>
        )}
      </div>
    </article>
  );
}