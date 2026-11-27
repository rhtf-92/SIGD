import { ArrowRight } from "lucide-react";
import type { ExpedienteFilaBandeja } from "../../types/expediente";
import SlaBadge from "./SlaBadge";

interface ExpedienteTableProps {
  expedientes: ExpedienteFilaBandeja[];
  onVerExpediente: (expediente: ExpedienteFilaBandeja) => void;
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
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm text-slate-600">
        No hay expedientes en esta pestaña con los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
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
        <tbody className="divide-y divide-slate-100">
          {expedientes.map((expediente) => {
            return (
              <tr key={expediente.id} className="transition-colors hover:bg-blue-50/60">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-blue-800">
                  {expediente.codigoExpediente}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-800">
                  {expediente.asunto}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {expediente.solicitanteNombre ?? "No identificado"}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {expediente.nombreSerie ?? expediente.codigoSerie ?? "Sin clasificar"}
                </td>
                <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                  {expediente.cantidadFolios}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formateadorFecha.format(new Date(expediente.fechaIngreso))}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  <SlaBadge
                    fechaIngreso={expediente.fechaIngreso}
                  />
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onVerExpediente(expediente)}
                    className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-white py-1 pl-3 pr-1.5 text-xs font-semibold text-blue-800 transition hover:border-blue-400 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                  >
                    Ver
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-50">
                      <ArrowRight aria-hidden="true" className="h-3 w-3 text-blue-700" />
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
