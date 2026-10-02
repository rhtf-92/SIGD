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
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No hay expedientes en esta pestaña con los filtros aplicados.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
              <tr key={expediente.id} className="hover:bg-slate-50">
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                  {expediente.codigoExpediente}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-800">
                  {expediente.asunto}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {expediente.solicitante.nombreOrazonSocial}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {expediente.clasificacionCCD.serieDocumental}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {expediente.cantidadFolios}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
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
                    className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                  >
                    Ver
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
