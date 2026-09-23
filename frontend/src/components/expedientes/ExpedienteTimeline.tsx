import type { BitacoraEventoExpediente } from "../../types/trazabilidadExpediente";
import TimelineItemCard from "./TimelineItemCard";

interface ExpedienteTimelineProps {
  eventos: BitacoraEventoExpediente[];
  cargando?: boolean;
}

/**
 * Timeline inmutable de trazabilidad (ENT-M03-03).
 * Componente de SOLO LECTURA (Write Once, Read Many): no expone ninguna acción de
 * edición o eliminación sobre los eventos de la bitácora, salvaguardando la cadena
 * de custodia del expediente.
 */
export default function ExpedienteTimeline({
  eventos,
  cargando = false,
}: ExpedienteTimelineProps) {
  if (cargando) {
    return (
      <p className="text-sm text-slate-500">Cargando trazabilidad del expediente…</p>
    );
  }

  if (eventos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
        Este expediente todavía no registra movimientos en su bitácora.
      </div>
    );
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-bold text-slate-900">
        Hoja de Ruta y Trazabilidad
      </h2>
      <ol className="relative space-y-4 border-l-2 border-slate-200 pl-0">
        {eventos.map((evento, indice) => (
          <TimelineItemCard
            key={evento.eventoId}
            evento={evento}
            esMasReciente={indice === eventos.length - 1}
          />
        ))}
      </ol>
    </div>
  );
}
