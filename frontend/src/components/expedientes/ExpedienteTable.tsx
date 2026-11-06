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
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 sm:p-12 text-center text-xs sm:text-sm text-slate-500 shadow-2xs">
        No hay expedientes en esta pestaña con los filtros aplicados.
      </div>
    );
  }

  return (
    <div>
      {/* VISTA MÓVIL EN TARJETAS ADAPTATIVAS (block md:hidden) */}
      <div className="space-y-3 md:hidden">
        {expedientes.map((expediente) => (
          <div
            key={expediente.id}
            className="rounded-2xl border border-slate-200 bg-white p-4 shadow-xs transition hover:border-blue-300"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2.5">
              <span className="font-mono text-xs font-black text-blue-700">
                {expediente.codigoExpediente}
              </span>
              <SlaBadge
                fechaIngreso={expediente.fechaIngreso}
                fechaLimiteAtencion={expediente.fechaLimiteAtencion}
              />
            </div>

            <p className="mt-2 text-sm font-semibold text-slate-900 line-clamp-2">
              {expediente.asunto}
            </p>

            <div className="mt-2 space-y-1 text-xs text-slate-600">
              <p className="truncate">
                <strong className="text-slate-700">Solicitante:</strong>{" "}
                {expediente.solicitante.nombreOrazonSocial}
              </p>
              <p className="truncate">
                <strong className="text-slate-700">Serie CCD:</strong>{" "}
                {expediente.clasificacionCCD.serieDocumental}
              </p>
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
              <div className="text-slate-500">
                <span>{expediente.cantidadFolios} folios</span>
                <span className="mx-1.5">•</span>
                <span>{formateadorFecha.format(new Date(expediente.fechaIngreso))}</span>
              </div>
              <button
                type="button"
                onClick={() => onVerExpediente(expediente)}
                className="rounded-lg bg-blue-50 px-3.5 py-1.5 font-bold text-blue-700 hover:bg-blue-100 transition"
              >
                Ver Detalle →
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* VISTA TABLA DE ESCRITORIO CON SCROLL HORIZONTAL PROTEGIDO (hidden md:block) */}
      <div className="hidden md:block overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-xs">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-bold uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3.5">CUT</th>
              <th className="px-4 py-3.5">Asunto</th>
              <th className="px-4 py-3.5">Solicitante</th>
              <th className="px-4 py-3.5">Serie CCD</th>
              <th className="px-4 py-3.5 text-center">Folios</th>
              <th className="px-4 py-3.5">Fecha Ingreso</th>
              <th className="px-4 py-3.5">Plazo Restante</th>
              <th className="px-4 py-3.5 text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expedientes.map((expediente) => {
              return (
                <tr key={expediente.id} className="hover:bg-slate-50 transition">
                  <td className="whitespace-nowrap px-4 py-3.5 font-mono text-xs font-bold text-blue-700">
                    {expediente.codigoExpediente}
                  </td>
                  <td className="max-w-xs px-4 py-3.5 text-slate-800 line-clamp-2">
                    {expediente.asunto}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                    {expediente.solicitante.nombreOrazonSocial}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                    {expediente.clasificacionCCD.serieDocumental}
                  </td>
                  <td className="px-4 py-3.5 text-center text-slate-600 font-mono">
                    {expediente.cantidadFolios}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-slate-600">
                    {formateadorFecha.format(new Date(expediente.fechaIngreso))}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5">
                    <SlaBadge
                      fechaIngreso={expediente.fechaIngreso}
                      fechaLimiteAtencion={expediente.fechaLimiteAtencion}
                    />
                  </td>
                  <td className="whitespace-nowrap px-4 py-3.5 text-right">
                    <button
                      type="button"
                      onClick={() => onVerExpediente(expediente)}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-bold text-slate-700 transition hover:bg-slate-100 hover:text-blue-700"
                    >
                      Ver Detalle
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
