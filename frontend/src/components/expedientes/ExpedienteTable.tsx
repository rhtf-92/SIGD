import { ArrowRight } from "lucide-react";
import type { ExpedienteSGD } from "../../types/expediente";
import SlaBadge from "./SlaBadge";

interface ExpedienteTableProps {
  expedientes: ExpedienteSGD[];
  onVerExpediente: (expediente: ExpedienteSGD) => void;
}

const formateadorFecha = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export default function ExpedienteTable({
  expedientes,
  onVerExpediente,
}: ExpedienteTableProps) {
  if (expedientes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-cyan-400/30 bg-slate-950/55 p-10 text-center text-sm text-slate-300 shadow-sm backdrop-blur-md">
        No hay expedientes en esta pestaña con los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-rose-400/25 bg-slate-950/70 shadow-[0_0_28px_rgba(244,63,94,0.08),0_16px_40px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <table className="min-w-full divide-y divide-cyan-300/10 text-sm">
        <thead className="bg-slate-900/90 text-left text-xs font-bold uppercase tracking-wide text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.35)]">
          <tr>
            <th className="px-4 py-3">CUT</th>
            <th className="px-4 py-3">Asunto</th>
            <th className="px-4 py-3">Solicitante</th>
            <th className="px-4 py-3">Serie CCD</th>
            <th className="px-4 py-3 text-center">Folios</th>
            <th className="px-4 py-3">Fecha Ingreso</th>
            <th className="px-4 py-3">Plazo Restante</th>
            <th className="px-4 py-3 text-right">Acciones</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-700/60">
          {expedientes.map((expediente) => {
            return (
              <tr key={expediente.id} className="transition-colors hover:bg-cyan-950/35">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-cyan-300">
                  {expediente.codigoExpediente}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-100">
                  {expediente.asunto}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {expediente.solicitante.nombreOrazonSocial}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {expediente.clasificacionCCD.serieDocumental}
                </td>
                <td className="px-4 py-3 text-center text-slate-300">
                  {expediente.cantidadFolios}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-300">
                  {formateadorFecha.format(new Date(expediente.fechaIngreso))}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <SlaBadge
                    fechaIngreso={expediente.fechaIngreso}
                    fechaLimiteAtencion={expediente.fechaLimiteAtencion}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onVerExpediente(expediente)}
                    className="inline-flex items-center gap-2 rounded-full border border-cyan-300/50 bg-slate-900/80 py-1 pl-3 pr-1.5 text-xs font-semibold text-cyan-100 shadow-[0_0_14px_rgba(34,211,238,0.15)] transition hover:border-cyan-200 hover:bg-blue-950 hover:text-white hover:shadow-[0_0_18px_rgba(34,211,238,0.38)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-300"
                  >
                    Ver
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cyan-400/15">
                      <ArrowRight aria-hidden="true" className="h-3 w-3 text-cyan-300" />
                    </span>
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
