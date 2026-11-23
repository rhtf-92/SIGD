import type { ExpedienteSGD, ExpedienteResumenRutaDoc } from "../../types/expediente";
import SlaBadge from "./SlaBadge";

interface ExpedienteTableProps<T> {
  expedientes: T[];
  onVerExpediente: (expediente: T) => void;
  seleccionados?: string[];
  onToggleSeleccion?: (idExpediente: string) => void;
  onSeleccionarTodos?: () => void;
  permitirSeleccion?: boolean;
}

const formateadorFecha = new Intl.DateTimeFormat("es-PE", {
  timeZone: "America/Lima",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatearFechaIngreso(fecha: string | null | undefined): string {
  if (!fecha) return '—';
  const instante = new Date(fecha);
  return Number.isNaN(instante.getTime()) ? '—' : formateadorFecha.format(instante);
}

export default function ExpedienteTable<T extends ExpedienteSGD | ExpedienteResumenRutaDoc>({
  expedientes,
  onVerExpediente,
  seleccionados = [],
  onToggleSeleccion,
  onSeleccionarTodos,
  permitirSeleccion = false,
}: ExpedienteTableProps<T>) {
  if (expedientes.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No hay expedientes en esta pestaña con los filtros aplicados.
      </div>
    );
  }

  const todosSeleccionados =
    expedientes.length > 0 &&
    expedientes.every((e) => {
      const id = "idExpediente" in e ? e.idExpediente : e.id;
      return seleccionados.includes(id);
    });

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            {permitirSeleccion && (
              <th className="w-10 px-4 py-3 text-center">
                <input
                  type="checkbox"
                  checked={todosSeleccionados}
                  onChange={() => onSeleccionarTodos && onSeleccionarTodos()}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  aria-label="Seleccionar todos los expedientes de la página"
                />
              </th>
            )}
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
            const real = "idExpediente" in expediente;
            const id = real ? expediente.idExpediente : expediente.id;
            const estaSeleccionado = seleccionados.includes(id);

            return (
              <tr
                key={id}
                className={`transition-colors hover:bg-slate-50 ${
                  estaSeleccionado ? "bg-blue-50/50" : ""
                }`}
              >
                {permitirSeleccion && (
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={estaSeleccionado}
                      onChange={() => onToggleSeleccion && onToggleSeleccion(id)}
                      className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      aria-label={`Seleccionar expediente ${real ? expediente.cut : expediente.codigoExpediente}`}
                    />
                  </td>
                )}
                <td className="whitespace-nowrap px-4 py-3 font-mono text-xs font-semibold text-blue-700">
                  <div>{real ? expediente.cut : expediente.codigoExpediente}</div>
                  {real && expediente.habilitacionInfo && (
                    <div className="mt-1">
                      {expediente.habilitacionInfo.habilitado ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-200">
                          ✓ Habilitado
                        </span>
                      ) : expediente.habilitacionInfo.estadoPago === 'PENDIENTE' ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                          Pendiente Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-medium text-blue-700 border border-blue-200" title={`Espera legal de 15 días hábiles (${expediente.habilitacionInfo.diasHabilesRestantes} días restantes)`}>
                          Espera legal ({expediente.habilitacionInfo.diasHabilesRestantes}d)
                        </span>
                      )}
                    </div>
                  )}
                </td>
                <td className="max-w-xs px-4 py-3 text-slate-800">
                  {expediente.asunto}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {real ? "No disponible en la respuesta" : expediente.solicitante.nombreOrazonSocial}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {real ? "No disponible" : expediente.clasificacionCCD.serieDocumental}
                </td>
                <td className="px-4 py-3 text-center text-slate-600">
                  {real ? "No disponible" : expediente.cantidadFolios}
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                  {formatearFechaIngreso(expediente.fechaIngreso)}
                </td>
                <td className="whitespace-nowrap px-4 py-3">
                  {real ? "No disponible" : <SlaBadge
                    fechaIngreso={expediente.fechaIngreso}
                    fechaLimiteAtencion={expediente.fechaLimiteAtencion}
                  />}
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
