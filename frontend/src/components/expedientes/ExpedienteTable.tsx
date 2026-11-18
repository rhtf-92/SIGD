import type { Resumen } from "../../pages/expedientes/rutadoc/rutadoc.dto";
import { FechaRutaDoc } from "../../pages/expedientes/rutadoc/RutaDocEstado";
import { obtenerInfoArea } from "../../utils/areaPresentacion";
import { Inbox, Eye, FileText } from "lucide-react";

export default function ExpedienteTable({
  expedientes,
  onVerExpediente,
}: {
  expedientes: Resumen[];
  onVerExpediente: (expediente: Resumen) => void;
}) {
  if (!expedientes.length) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/60 p-8 sm:p-12 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-white border border-slate-200 text-slate-400 shadow-2xs mb-3.5">
          <Inbox className="h-7 w-7 text-slate-400" />
        </div>
        <h3 className="text-base font-bold text-slate-800">
          No se encontraron expedientes
        </h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          No hay requerimientos en esta bandeja con los criterios de búsqueda seleccionados.
        </p>
      </div>
    );
  }

  return (
    <div
      role="region"
      aria-label="Tabla de expedientes, desplazamiento horizontal"
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-2xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
    >
      <table className="w-full min-w-[56rem] table-fixed text-left text-xs sm:text-sm">
        <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px] tracking-wider">
          <tr>
            <th scope="col" className="px-4 py-3 w-44">CUT / Identificador</th>
            <th scope="col" className="px-4 py-3">Asunto del Trámite</th>
            <th scope="col" className="px-4 py-3 w-36">Estado Actual</th>
            <th scope="col" className="px-4 py-3 w-48">Área en Custodia</th>
            <th scope="col" className="px-4 py-3 w-36">Radicación</th>
            <th scope="col" className="px-4 py-3 w-28 text-center">Acción</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {expedientes.map((e) => {
            const area = obtenerInfoArea(e.areaActualId, e.areaActualNombre);
            return (
              <tr
                key={e.idExpediente}
                className="hover:bg-blue-50/30 transition group"
              >
                <td className="px-4 py-3 font-mono font-bold text-blue-950 flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-blue-800 shrink-0" />
                  <span>{e.cut}</span>
                </td>
                <td className="px-4 py-3 font-medium text-slate-800 max-w-xs truncate" title={e.asunto}>
                  {e.asunto}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold border border-slate-200 bg-slate-50 text-slate-700">
                    {e.estadoActual}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block rounded-md px-2.5 py-0.5 text-xs font-semibold border ${area.badgeClase}`}
                    title={area.descripcion}
                  >
                    {area.nombre}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 text-xs">
                  <FechaRutaDoc valor={e.fechaRadicacion} />
                </td>
                <td className="px-4 py-3 text-center">
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-lg border border-blue-900/30 bg-blue-50/60 hover:bg-blue-900 hover:text-white px-3 py-1.5 text-xs font-bold text-blue-950 transition cursor-pointer"
                    onClick={() => onVerExpediente(e)}
                    aria-label={`Ver ${e.cut}`}
                  >
                    <Eye className="h-3.5 w-3.5" />
                    <span>Ver</span>
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
