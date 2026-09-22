import type { ExpedienteSGD } from "../../types/expediente";

interface ExpedienteTableProps {
  expedientes: ExpedienteSGD[];
  onVerExpediente: (expediente: ExpedienteSGD) => void;
}

const formateadorFecha = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * NOTA PARA EL EQUIPO: Este cálculo es un placeholder simplificado (días calendario)
 * únicamente para poder mostrar la columna "Plazo Restante" mientras se integra el
 * cálculo oficial en días hábiles de `slaCalculator.ts` (ENT-M03-02, responsable
 * Willfredo Soria). Cuando ese archivo exista, reemplazar esta función por
 * `calculateBusinessDays` + `getSlaAlertStatus` y por el componente `SlaBadge.tsx`.
 */
function calcularEstadoPlazoPlaceholder(fechaLimiteAtencion: string): {
  etiqueta: string;
  clase: string;
} {
  const hoy = new Date();
  const limite = new Date(fechaLimiteAtencion);
  const diffMs = limite.getTime() - hoy.getTime();
  const diffDias = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDias < 0) {
    return {
      etiqueta: `Vencido (${Math.abs(diffDias)} d.)`,
      clase: "bg-red-100 text-red-700",
    };
  }
  if (diffDias <= 2) {
    return {
      etiqueta: `${diffDias} día(s) [Advertencia]`,
      clase: "bg-amber-100 text-amber-700",
    };
  }
  return {
    etiqueta: `${diffDias} días [Normal]`,
    clase: "bg-emerald-100 text-emerald-700",
  };
}

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
            const plazo = calcularEstadoPlazoPlaceholder(
              expediente.fechaLimiteAtencion,
            );

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
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${plazo.clase}`}
                  >
                    {plazo.etiqueta}
                  </span>
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
