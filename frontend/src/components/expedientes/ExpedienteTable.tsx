import type { Resumen } from "../../pages/expedientes/rutadoc/rutadoc.dto";
import type { Sla } from "../../pages/expedientes/rutadoc/rutadoc.dto";
import { esEstadoSlaTerminal } from "../../pages/expedientes/rutadoc/rutadoc.summary";
import { FechaRutaDoc } from "../../pages/expedientes/rutadoc/RutaDocEstado";
import { obtenerInfoArea } from "../../utils/areaPresentacion";

const etiquetasSla: Record<Sla["estado"], string> = {
  VERDE: "En plazo",
  AMARILLO: "Por vencer",
  ROJO: "Vencido",
};

const clasesSla: Record<Sla["estado"], string> = {
  VERDE: "border-emerald-200 bg-emerald-50 text-emerald-800",
  AMARILLO: "border-amber-200 bg-amber-50 text-amber-900",
  ROJO: "border-rose-200 bg-rose-50 text-rose-800",
};

export default function ExpedienteTable({ expedientes, onVerExpediente, estadosSla, slaPendiente }: {
  expedientes: Resumen[]; onVerExpediente: (expediente: Resumen) => void;
  estadosSla: ReadonlyMap<string, Sla["estado"]>;
  slaPendiente: boolean;
}) {
  if (!expedientes.length) return <p>No hay expedientes con los filtros aplicados.</p>;
  return <div role="region" aria-label="Tabla de expedientes, desplazamiento horizontal" tabIndex={0}
    className="max-w-full overflow-x-auto rounded border border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700">
    <table className="w-full min-w-[56rem] table-fixed text-left text-sm [&_td]:break-words [&_td]:px-3 [&_td]:py-3 [&_td]:align-top [&_th]:px-3 [&_th]:py-2">
    <thead className="bg-slate-100"><tr>{["CUT", "Asunto", "Estado", "Estado SLA", "Área actual", "Radicación", "Detalle"].map(t => <th scope="col" key={t}>{t}</th>)}</tr></thead>
    <tbody>{expedientes.map(e => {
      const area = obtenerInfoArea(e.areaActualId, e.areaActualNombre);
      const estadoSla = estadosSla.get(e.idExpediente);
      const terminal = esEstadoSlaTerminal(e.estadoActual);
      const estadoSlaEtiqueta = terminal ? "No aplica" : estadoSla ? etiquetasSla[estadoSla] : slaPendiente ? "Calculando…" : "No disponible";
      const estadoClase = e.estadoActual === "EN_REVISION"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-slate-200 bg-slate-50 text-slate-700";
      return (
        <tr key={e.idExpediente}>
          <td className="font-semibold text-slate-900">{e.cut}</td>
          <td>{e.asunto}</td>
          <td>
            <span title={e.estadoActual === "EN_REVISION" ? "En trámite" : e.estadoActual}
              className={`inline-block rounded px-2 py-0.5 text-xs font-medium border ${estadoClase}`}>
              {e.estadoActual}
            </span>
          </td>
          <td>
            <span aria-label={`Estado SLA: ${estadoSlaEtiqueta}`}
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${estadoSla ? clasesSla[estadoSla] : "border-slate-200 bg-slate-50 text-slate-600"}`}>
              {estadoSlaEtiqueta}
            </span>
          </td>
          <td>
            <span
              className={`inline-block rounded px-2 py-0.5 text-xs font-semibold border ${area.badgeClase}`}
              title={area.descripcion}
            >
              {area.nombre}
            </span>
          </td>
          <td><FechaRutaDoc valor={e.fechaRadicacion} /></td>
          <td>
            <button
              type="button"
              className="rounded border border-blue-800 px-3 py-1 text-blue-800 underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-700"
              onClick={() => onVerExpediente(e)}
              aria-label={`Ver ${e.cut}`}
            >
              Ver
            </button>
          </td>
        </tr>
      );
    })}</tbody>
  </table></div>;
}
