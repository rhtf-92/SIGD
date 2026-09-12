import type { EventoTrazabilidadExpediente } from "../../types/trazabilidadExpediente";
import TimelineItemCard from "./TimelineItemCard";
import "./expedientes.css";

export interface ExpedienteTimelineProps {
  readonly eventos: readonly EventoTrazabilidadExpediente[];
}

function ordenarCronologicamente(
  eventos: readonly EventoTrazabilidadExpediente[],
): readonly EventoTrazabilidadExpediente[] {
  return eventos
    .map((evento, indice) => ({ evento, indice }))
    .sort((a, b) => {
      const diferencia = Date.parse(a.evento.fechaHora) - Date.parse(b.evento.fechaHora);
      return Number.isNaN(diferencia) || diferencia === 0
        ? a.indice - b.indice
        : diferencia;
    })
    .map(({ evento }) => evento);
}

export default function ExpedienteTimeline({ eventos }: ExpedienteTimelineProps) {
  const eventosOrdenados = ordenarCronologicamente(eventos);

  return (
    <section className="m03 m03-panel" aria-labelledby="timeline-titulo">
      <h2 id="timeline-titulo" className="m03-heading">
        Hoja de ruta y trazabilidad
      </h2>
      <p className="m03-help">
        Historial cronológico inmutable del expediente. Esta vista es de solo lectura.
      </p>

      {eventosOrdenados.length === 0 ? (
        <p className="m03-notice" role="status">
          No hay movimientos registrados para este expediente.
        </p>
      ) : (
        <ol className="m03-timeline" aria-label="Movimientos del expediente">
          {eventosOrdenados.map((evento) => (
            <li key={evento.id} className="m03-timeline-item">
              <TimelineItemCard evento={evento} />
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
