import type { ReactElement } from "react";

export interface InsigniaEstadoTramiteProps {
  estado: string;
  className?: string;
}

export function InsigniaEstadoTramite({
  estado,
  className = "",
}: InsigniaEstadoTramiteProps): ReactElement {
  const normalizado = (estado || "").trim().toUpperCase();

  let estilos = "bg-slate-100 text-slate-800 border-slate-300";
  let dotColor = "bg-slate-600";

  if (
    normalizado === "REGISTRADO" ||
    normalizado.includes("REGISTRAD") ||
    normalizado.includes("RECIBID")
  ) {
    estilos = "bg-blue-100 text-blue-900 border-blue-300";
    dotColor = "bg-blue-700";
  } else if (
    normalizado === "EN_TRAMITE" ||
    normalizado === "EN_PROCESO" ||
    normalizado.includes("TRAMITE") ||
    normalizado.includes("PROCESO") ||
    normalizado.includes("REVISION")
  ) {
    estilos = "bg-indigo-100 text-indigo-900 border-indigo-300";
    dotColor = "bg-indigo-700";
  } else if (
    normalizado === "OBSERVADO" ||
    normalizado.includes("OBSERVAD")
  ) {
    estilos = "bg-amber-100 text-amber-900 border-amber-400";
    dotColor = "bg-amber-700";
  } else if (
    normalizado === "SUBSANADO" ||
    normalizado.includes("SUBSANAD")
  ) {
    estilos = "bg-cyan-100 text-cyan-900 border-cyan-300";
    dotColor = "bg-cyan-700";
  } else if (
    normalizado === "APROBADO" ||
    normalizado === "RESUELTO" ||
    normalizado === "FINALIZADO" ||
    normalizado.includes("APROBAD") ||
    normalizado.includes("RESUELT")
  ) {
    estilos = "bg-emerald-100 text-emerald-900 border-emerald-300";
    dotColor = "bg-emerald-700";
  } else if (
    normalizado === "ANULADO" ||
    normalizado === "RECHAZADO" ||
    normalizado.includes("ANULAD") ||
    normalizado.includes("RECHAZ")
  ) {
    estilos = "bg-rose-100 text-rose-900 border-rose-300";
    dotColor = "bg-rose-700";
  }

  const textoVisible = estado || "SIN ESTADO";

  return (
    <span
      role="status"
      data-testid="insignia-estado"
      aria-label={`Estado del trámite: ${textoVisible}`}
      className={`sigd-badge-estado inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border shadow-xs ${estilos} ${className}`}
    >
      <span aria-hidden="true" className={`h-2 w-2 rounded-full shrink-0 ${dotColor}`} />
      <span>{textoVisible}</span>
    </span>
  );
}

export default InsigniaEstadoTramite;
