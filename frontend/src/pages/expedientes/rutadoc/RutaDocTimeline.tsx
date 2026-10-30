import type { Trazabilidad } from "./rutadoc.dto";
import { FechaRutaDoc } from "./RutaDocEstado";

const titulosMovimiento: Record<string, string> = {
  RECEPCION: "Solicitud recibida",
  INICIAR_CALIFICACION: "Calificación iniciada",
  DERIVACION: "Expediente derivado",
  OBSERVACION: "Expediente observado",
  CORRECCION: "Subsanación presentada",
  INICIAR_REVISION: "Revisión iniciada",
};

export default function RutaDocTimeline({ datos }: { datos: Trazabilidad }) {
  const eventos = datos.eventos.length > 0
    ? datos.eventos
    : datos.actuaciones.map((actuacion) => ({
        id: `MOVIMIENTO:${actuacion.movimientoId}`,
        fechaHora: actuacion.fechaHora,
        titulo: titulosMovimiento[actuacion.evento] ?? "Actuación administrativa registrada",
        detalle: null,
      }));

  if (eventos.length === 0) return <p>Sin eventos registrados para este expediente.</p>;

  return (
    <ol className="space-y-3" aria-label="Historial cronológico del expediente">
      {eventos.map((evento) => (
        <li key={evento.id} className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-semibold text-slate-800">{evento.titulo}</p>
          <p className="text-xs text-slate-500"><FechaRutaDoc valor={evento.fechaHora} /></p>
          {evento.detalle && <p className="mt-1 text-sm text-slate-600">{evento.detalle}</p>}
        </li>
      ))}
    </ol>
  );
}
