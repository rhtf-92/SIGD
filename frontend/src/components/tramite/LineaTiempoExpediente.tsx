import type { ReactElement } from "react";
import type { DtoProveidoPublico } from "../../pages/tramite/ConsultaPublicaPage";

export interface LineaTiempoExpedienteProps {
  fechaEnvioReal?: string | null;
  fechaRadicacionLegal?: string | null;
  proveidos?: DtoProveidoPublico[] | null;
  className?: string;
}

interface EventoPaso {
  id: string;
  tipo: "envio" | "radicacion" | "proveido";
  titulo: string;
  fecha: string;
  fechaTimestamp: number;
  ordenLogico: number;
  resumen?: string;
  numero?: string;
}

function esFechaValida(fechaStr: unknown): fechaStr is string {
  if (!fechaStr || typeof fechaStr !== "string" || !fechaStr.trim()) {
    return false;
  }
  const timestamp = new Date(fechaStr).getTime();
  return !Number.isNaN(timestamp);
}

export function formatearFecha(fechaStr: string): string {
  if (!fechaStr) return "";
  const d = new Date(fechaStr);
  if (Number.isNaN(d.getTime())) return fechaStr;

  const matchSoloFecha = /^\d{4}-\d{2}-\d{2}$/.test(fechaStr.trim());
  if (matchSoloFecha) {
    const [anio, mes, dia] = fechaStr.trim().split("-");
    return `${dia}/${mes}/${anio}`;
  }

  const dia = String(d.getDate()).padStart(2, "0");
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const anio = d.getFullYear();
  const horas = String(d.getHours()).padStart(2, "0");
  const minutos = String(d.getMinutes()).padStart(2, "0");

  if (fechaStr.includes("T") || fechaStr.includes(":")) {
    return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
  }

  return `${dia}/${mes}/${anio}`;
}

export function LineaTiempoExpediente({
  fechaEnvioReal,
  fechaRadicacionLegal,
  proveidos,
  className = "",
}: LineaTiempoExpedienteProps): ReactElement {
  const pasos: EventoPaso[] = [];

  // 1. Envío
  if (esFechaValida(fechaEnvioReal)) {
    pasos.push({
      id: "evento-envio",
      tipo: "envio",
      titulo: "Envío del trámite",
      fecha: fechaEnvioReal,
      fechaTimestamp: new Date(fechaEnvioReal).getTime(),
      ordenLogico: 1,
      resumen: "Recepción inicial del expediente en mesa de partes.",
    });
  }

  // 2. Radicación Legal
  if (esFechaValida(fechaRadicacionLegal)) {
    pasos.push({
      id: "evento-radicacion",
      tipo: "radicacion",
      titulo: "Radicación legal",
      fecha: fechaRadicacionLegal,
      fechaTimestamp: new Date(fechaRadicacionLegal).getTime(),
      ordenLogico: 2,
      resumen: "Asiento registral formal en horario hábil institucional.",
    });
  }

  // 3. Proveídos públicos con fecha
  if (Array.isArray(proveidos)) {
    proveidos.forEach((prov, idx) => {
      if (prov && esFechaValida(prov.fechaEmision)) {
        pasos.push({
          id: `evento-proveido-${prov.numero || idx}`,
          tipo: "proveido",
          titulo: prov.numero ? `Proveído ${prov.numero}` : "Proveído",
          fecha: prov.fechaEmision,
          fechaTimestamp: new Date(prov.fechaEmision).getTime(),
          ordenLogico: 3 + idx,
          resumen: prov.resumen,
          numero: prov.numero,
        });
      }
    });
  }

  // Orden cronológico estricto (menor timestamp a mayor timestamp)
  pasos.sort((a, b) => {
    if (a.fechaTimestamp !== b.fechaTimestamp) {
      return a.fechaTimestamp - b.fechaTimestamp;
    }
    return a.ordenLogico - b.ordenLogico;
  });

  if (pasos.length === 0) {
    return (
      <ol
        aria-label="Línea de tiempo del expediente"
        className={`sigd-timeline ${className}`}
      >
        <li className="text-xs text-slate-500 italic py-2">
          No se registran eventos con fecha para este expediente.
        </li>
      </ol>
    );
  }

  return (
    <ol
      aria-label="Línea de tiempo del expediente"
      className={`sigd-timeline relative border-l-2 border-slate-200 ml-3 sm:ml-4 space-y-6 ${className}`}
    >
      {pasos.map((paso) => (
        <li key={paso.id} className="relative pl-6">
          <span
            aria-hidden="true"
            className={`absolute -left-[9px] top-1 h-4 w-4 rounded-full border-2 border-white shadow-xs ${
              paso.tipo === "envio"
                ? "bg-blue-600"
                : paso.tipo === "radicacion"
                ? "bg-emerald-600"
                : "bg-sky-600"
            }`}
          />
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-1">
            <h4 className="text-sm font-bold text-slate-900">{paso.titulo}</h4>
            <time
              dateTime={paso.fecha}
              className="font-mono text-xs text-slate-600"
            >
              {formatearFecha(paso.fecha)}
            </time>
          </div>
          {paso.resumen && (
            <p className="mt-1 text-xs text-slate-600 leading-relaxed">
              {paso.resumen}
            </p>
          )}
        </li>
      ))}
    </ol>
  );
}

export default LineaTiempoExpediente;
